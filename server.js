const express = require("express");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");

const app = express();

const PORT = process.env.PORT || 10000;
const BACKEND_URL =
    process.env.BACKEND_URL ||
    "https://nyota-funds-backend-xhcb.onrender.com";

const PAYLOR_API_URL =
    "https://api.paylorke.com/api/v1/merchants/payments/stk-push";

/*
|--------------------------------------------------------------------------
| IMPORTANT
|--------------------------------------------------------------------------
| We need the raw request body for Paylor's signed webhook.
|--------------------------------------------------------------------------
*/

app.use(
    express.json({
        verify: (req, res, buffer) => {
            if (req.originalUrl === "/api/paylor-callback") {
                req.rawBody = Buffer.from(buffer);
            }
        }
    })
);

app.use(express.urlencoded({ extended: true }));

/*
|--------------------------------------------------------------------------
| Static website
|--------------------------------------------------------------------------
*/

app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

/*
|--------------------------------------------------------------------------
| Health check
|--------------------------------------------------------------------------
*/

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Backend is running"
    });
});

/*
|--------------------------------------------------------------------------
| Configuration check
|--------------------------------------------------------------------------
| Does NOT expose the actual secrets.
|--------------------------------------------------------------------------
*/

app.get("/api/paylor/status", (req, res) => {
    res.json({
        success: true,
        paylorConfigured: {
            apiKey: Boolean(process.env.PAYLOR_API_KEY),
            channelId: Boolean(process.env.PAYLOR_CHANNEL_ID),
            webhookSecret: Boolean(
                process.env.PAYLOR_WEBHOOK_SECRET
            )
        },
        callbackUrl:
            `${BACKEND_URL}/api/paylor-callback`
    });
});

/*
|--------------------------------------------------------------------------
| LIVE PAYLOR STK PUSH
|--------------------------------------------------------------------------
|
| This is the actual Paylor request.
|
| Keep PAYLOR_API_KEY on Render.
| Never put it inside paylor-test.html.
|--------------------------------------------------------------------------
*/

app.post("/api/payment", async (req, res) => {
    try {
        const {
            phone,
            amount,
            reference,
            description
        } = req.body;

        /*
        |--------------------------------------------------------------------------
        | Validate environment variables
        |--------------------------------------------------------------------------
        */

        if (!process.env.PAYLOR_API_KEY) {
            return res.status(500).json({
                success: false,
                message: "PAYLOR_API_KEY is not configured"
            });
        }

        if (!process.env.PAYLOR_CHANNEL_ID) {
            return res.status(500).json({
                success: false,
                message: "PAYLOR_CHANNEL_ID is not configured"
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Validate request
        |--------------------------------------------------------------------------
        */

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "Phone number is required"
            });
        }

        if (!amount || Number(amount) <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid amount is required"
            });
        }

        if (!reference) {
            return res.status(400).json({
                success: false,
                message: "Payment reference is required"
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Normalize Kenyan phone number
        |--------------------------------------------------------------------------
        */

        let normalizedPhone = String(phone).trim();

        if (/^0[17][0-9]{8}$/.test(normalizedPhone)) {
            normalizedPhone =
                "254" + normalizedPhone.substring(1);
        }

        if (!/^254[17][0-9]{8}$/.test(normalizedPhone)) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid Kenyan phone number. Use 0712345678 or 254712345678."
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Idempotency key
        |--------------------------------------------------------------------------
        */

        const idempotencyKey =
            crypto.randomUUID();

        /*
        |--------------------------------------------------------------------------
        | Paylor STK Push request
        |--------------------------------------------------------------------------
        */

        const payload = {
            phone: normalizedPhone,
            amount: Number(amount),
            reference: String(reference),
            channelId:
                process.env.PAYLOR_CHANNEL_ID,
            description:
                description ||
                "Merchant payment",
            callbackUrl:
                `${BACKEND_URL}/api/paylor-callback`
        };

        console.log(
            "Sending Paylor STK request:",
            {
                phone: normalizedPhone,
                amount: Number(amount),
                reference: String(reference)
            }
        );

        const paylorResponse =
            await axios.post(
                PAYLOR_API_URL,
                payload,
                {
                    headers: {
                        Authorization:
                            `Bearer ${process.env.PAYLOR_API_KEY}`,

                        "Content-Type":
                            "application/json",

                        Accept:
                            "application/json",

                        "Idempotency-Key":
                            idempotencyKey
                    },

                    timeout: 30000
                }
            );

        console.log(
            "Paylor response:",
            paylorResponse.data
        );

        /*
        |--------------------------------------------------------------------------
        | Return Paylor response to frontend
        |--------------------------------------------------------------------------
        */

        return res.status(200).json({
            success: true,
            message:
                "STK Push request sent to Paylor.",
            data:
                paylorResponse.data
        });

    } catch (error) {

        console.error(
            "Paylor STK Push error:",
            error.response?.data ||
            error.message
        );

        const status =
            error.response?.status || 500;

        return res.status(status).json({
            success: false,
            message:
                error.response?.data?.message ||
                "Unable to initiate Paylor STK Push.",
            error:
                error.response?.data ||
                error.message
        });
    }
});

/*
|--------------------------------------------------------------------------
| PAYLOR SIGNED WEBHOOK
|--------------------------------------------------------------------------
|
| Paylor signs the RAW request body using:
|
| HMAC-SHA256(rawBody, PAYLOR_WEBHOOK_SECRET)
|
| Header:
|
| X-Webhook-Signature
|--------------------------------------------------------------------------
*/

app.post(
    "/api/paylor-callback",
    (req, res) => {

        try {

            const secret =
                process.env.PAYLOR_WEBHOOK_SECRET;

            if (!secret) {

                console.error(
                    "PAYLOR_WEBHOOK_SECRET is not configured"
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Webhook secret is not configured"
                });
            }

            const receivedSignature =
                req.headers[
                    "x-webhook-signature"
                ];

            if (!receivedSignature) {

                console.warn(
                    "Paylor webhook missing X-Webhook-Signature"
                );

                return res.status(401).json({
                    success: false,
                    message:
                        "Missing webhook signature"
                });
            }

            if (!req.rawBody) {

                console.error(
                    "Raw webhook body was not captured"
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Raw webhook body unavailable"
                });
            }

            /*
            |--------------------------------------------------------------------------
            | Calculate expected signature
            |--------------------------------------------------------------------------
            */

            const expectedSignature =
                crypto
                    .createHmac(
                        "sha256",
                        secret
                    )
                    .update(req.rawBody)
                    .digest("hex");

            const received =
                Buffer.from(
                    String(receivedSignature),
                    "utf8"
                );

            const expected =
                Buffer.from(
                    expectedSignature,
                    "utf8"
                );

            /*
            |--------------------------------------------------------------------------
            | Timing-safe comparison
            |--------------------------------------------------------------------------
            */

            if (
                received.length !==
                expected.length
            ) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid webhook signature"
                });
            }

            if (
                !crypto.timingSafeEqual(
                    received,
                    expected
                )
            ) {

                console.warn(
                    "Invalid Paylor webhook signature"
                );

                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid webhook signature"
                });
            }

            /*
            |--------------------------------------------------------------------------
            | Signature verified
            |--------------------------------------------------------------------------
            */

            const webhook = req.body;

            console.log(
                "Verified Paylor webhook:",
                webhook
            );

            const event =
                webhook.event;

            const transaction =
                webhook.transaction;

            /*
            |--------------------------------------------------------------------------
            | Successful payment
            |--------------------------------------------------------------------------
            */

            if (
                event ===
                "payment.success"
            ) {

                console.log(
                    "PAYMENT SUCCESS",
                    {
                        transactionId:
                            transaction?.transactionId ||
                            transaction?.id,

                        reference:
                            transaction?.reference,

                        amount:
                            transaction?.amount,

                        status:
                            transaction?.status,

                        provider:
                            transaction?.provider,

                        providerRef:
                            transaction?.providerRef,

                        mpesaReceipt:
                            transaction?.metadata
                                ?.mpesaReceipt
                    }
                );

                /*
                 * IMPORTANT:
                 * Update your legitimate merchant
                 * order/payment record here.
                 *
                 * Reconcile using the original
                 * payment reference.
                 */
            }

            /*
            |--------------------------------------------------------------------------
            | Failed payment
            |--------------------------------------------------------------------------
            */

            if (
                event ===
                "payment.failed"
            ) {

                console.log(
                    "PAYMENT FAILED",
                    {
                        reference:
                            transaction?.reference,

                        status:
                            transaction?.status
                    }
                );

                /*
                 * Mark the legitimate merchant
                 * payment/order as failed here.
                 */
            }

            /*
            |--------------------------------------------------------------------------
            | Acknowledge webhook
            |--------------------------------------------------------------------------
            */

            return res.status(200).json({
                received: true
            });

        } catch (error) {

            console.error(
                "Webhook processing error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Webhook processing failed"
            });
        }
    }
);

/*
|--------------------------------------------------------------------------
| API 404
|--------------------------------------------------------------------------
*/

app.use("/api", (req, res) => {

    res.status(404).json({
        success: false,
        message:
            "API endpoint not found"
    });

});

/*
|--------------------------------------------------------------------------
| Global error handler
|--------------------------------------------------------------------------
*/

app.use(
    (error, req, res, next) => {

        console.error(
            "Server error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Server error"
        });
    }
);

/*
|--------------------------------------------------------------------------
| Start server
|--------------------------------------------------------------------------
*/

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            `Paylor callback: ${BACKEND_URL}/api/paylor-callback`
        );
    }
);
