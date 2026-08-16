const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 10000;

/*
|--------------------------------------------------------------------------
| IMPORTANT
|--------------------------------------------------------------------------
| Keep the raw request body.
| Paylor signs the exact bytes it sends.
|--------------------------------------------------------------------------
*/

app.use(
    express.json({
        verify: (req, res, buffer) => {
            req.rawBody = buffer;
        }
    })
);


/*
|--------------------------------------------------------------------------
| Health check
|--------------------------------------------------------------------------
*/

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Backend is running"
    });
});


/*
|--------------------------------------------------------------------------
| Paylor signed webhook
|--------------------------------------------------------------------------
*/

app.post("/api/paylor-callback", (req, res) => {

    try {

        const signature =
            req.headers["x-webhook-signature"];

        const secret =
            process.env.PAYLOR_WEBHOOK_SECRET;


        /*
        |--------------------------------------------------------------------------
        | Check configuration
        |--------------------------------------------------------------------------
        */

        if (!secret) {

            console.error(
                "PAYLOR_WEBHOOK_SECRET is not configured"
            );

            return res.status(500).json({
                success: false,
                message: "Webhook secret is not configured"
            });

        }


        /*
        |--------------------------------------------------------------------------
        | Check signature exists
        |--------------------------------------------------------------------------
        */

        if (!signature) {

            console.warn(
                "Paylor webhook missing X-Webhook-Signature"
            );

            return res.status(401).json({
                success: false,
                message: "Missing webhook signature"
            });

        }


        /*
        |--------------------------------------------------------------------------
        | Calculate expected HMAC
        |--------------------------------------------------------------------------
        */

        const expectedSignature =
            crypto
                .createHmac("sha256", secret)
                .update(req.rawBody)
                .digest("hex");


        /*
        |--------------------------------------------------------------------------
        | Timing-safe comparison
        |--------------------------------------------------------------------------
        */

        const received =
            Buffer.from(signature, "utf8");

        const expected =
            Buffer.from(expectedSignature, "utf8");


        if (
            received.length !==
            expected.length
        ) {

            return res.status(401).json({
                success: false,
                message: "Invalid webhook signature"
            });

        }


        if (
            !crypto.timingSafeEqual(
                received,
                expected
            )
        ) {

            return res.status(401).json({
                success: false,
                message: "Invalid webhook signature"
            });

        }


        /*
        |--------------------------------------------------------------------------
        | Signature is valid
        |--------------------------------------------------------------------------
        */

        const {
            event,
            transaction
        } = req.body;


        console.log(
            "Verified Paylor webhook:",
            {
                event,
                transaction
            }
        );


        /*
        |--------------------------------------------------------------------------
        | Handle successful payment
        |--------------------------------------------------------------------------
        */

        if (
            event === "payment.success"
        ) {

            console.log(
                "Payment completed:",
                transaction?.reference
            );

            /*
             * Update your legitimate order/payment
             * record here.
             *
             * IMPORTANT:
             * Reconcile using transaction.reference.
             */
        }


        /*
        |--------------------------------------------------------------------------
        | Handle failed payment
        |--------------------------------------------------------------------------
        */

        if (
            event === "payment.failed"
        ) {

            console.log(
                "Payment failed:",
                transaction?.reference
            );

            /*
             * Mark the legitimate payment/order
             * as failed here.
             */
        }


        /*
        |--------------------------------------------------------------------------
        | Respond quickly
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
            message: "Webhook processing failed"
        });

    }

});


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

    }
);
