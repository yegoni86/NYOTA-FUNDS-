const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));


/*
|--------------------------------------------------------------------------
| Website
|--------------------------------------------------------------------------
*/

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
        message: "NYOTA Funds backend is running",
        environment: "test"
    });
});


/*
|--------------------------------------------------------------------------
| Paylor configuration check
|--------------------------------------------------------------------------
|
| This checks whether the Render environment variables exist.
| It NEVER returns the secret values.
|--------------------------------------------------------------------------
*/

app.get("/api/paylor-config", (req, res) => {

    const apiKey = process.env.PAYLOR_API_KEY;
    const channelId = process.env.PAYLOR_CHANNEL_ID;
    const webhookSecret = process.env.PAYLOR_WEBHOOK_SECRET;

    res.json({
        success: true,

        paylor: {
            apiKeyConfigured: Boolean(apiKey),
            channelConfigured: Boolean(channelId),
            webhookSecretConfigured: Boolean(webhookSecret),

            channelId:
                channelId
                    ? channelId
                    : null
        }
    });
});


/*
|--------------------------------------------------------------------------
| SAFE TEST ENDPOINT
|--------------------------------------------------------------------------
|
| This does NOT send an M-Pesa STK Push.
|
| It only verifies that paylor-test.html can communicate
| with this Render backend.
|--------------------------------------------------------------------------
*/

app.post("/api/payment-test", (req, res) => {

    try {

        const {
            phone,
            amount,
            reference
        } = req.body;


        /*
        |--------------------------------------------------------------------------
        | Validate phone
        |--------------------------------------------------------------------------
        */

        if (!phone) {

            return res.status(400).json({
                success: false,
                message: "Phone number is required"
            });

        }


        if (!/^254[17][0-9]{8}$/.test(phone)) {

            return res.status(400).json({
                success: false,
                message:
                    "Use Kenyan format 254XXXXXXXXX"
            });

        }


        /*
        |--------------------------------------------------------------------------
        | Validate amount
        |--------------------------------------------------------------------------
        */

        const numericAmount =
            Number(amount);

        if (
            !Number.isFinite(numericAmount) ||
            numericAmount <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "A valid amount is required"
            });

        }


        /*
        |--------------------------------------------------------------------------
        | Check environment configuration
        |--------------------------------------------------------------------------
        */

        const configuration = {

            apiKeyConfigured:
                Boolean(process.env.PAYLOR_API_KEY),

            channelConfigured:
                Boolean(process.env.PAYLOR_CHANNEL_ID),

            webhookSecretConfigured:
                Boolean(process.env.PAYLOR_WEBHOOK_SECRET)

        };


        /*
        |--------------------------------------------------------------------------
        | Log test request
        |--------------------------------------------------------------------------
        |
        | Do not log API keys or webhook secrets.
        |--------------------------------------------------------------------------
        */

        console.log(
            "Paylor test request:",
            {
                phone,
                amount: numericAmount,
                reference:
                    reference ||
                    "TEST-" + Date.now()
            }
        );


        /*
        |--------------------------------------------------------------------------
        | Return safe test response
        |--------------------------------------------------------------------------
        */

        return res.status(200).json({

            success: true,

            test: true,

            message:
                "Backend connection successful. No M-Pesa payment was initiated.",

            request: {

                phone,

                amount:
                    numericAmount,

                reference:
                    reference ||
                    "TEST-" + Date.now()

            },

            paylorConfiguration:
                configuration

        });

    } catch (error) {

        console.error(
            "Payment test error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Internal server error"

        });

    }

});


/*
|--------------------------------------------------------------------------
| Test callback endpoint
|--------------------------------------------------------------------------
|
| This only records a test callback.
|--------------------------------------------------------------------------
*/

app.post("/api/paylor-callback-test", (req, res) => {

    console.log(
        "Paylor test callback received:",
        req.body
    );

    return res.status(200).json({
        success: true,
        message: "Test callback received"
    });

});


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

app.use((error, req, res, next) => {

    console.error(
        "Unhandled server error:",
        error
    );

    res.status(500).json({

        success: false,

        message:
            "Server error"

    });

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
