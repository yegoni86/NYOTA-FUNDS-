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
| Home page
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "index.html")
    );
});


/*
|--------------------------------------------------------------------------
| Health check
|--------------------------------------------------------------------------
*/

app.get("/api/health", (req, res) => {

    res.status(200).json({
        success: true,
        message: "NYOTA Funds backend is running"
    });

});


/*
|--------------------------------------------------------------------------
| DEMO / TEST PAYMENT ENDPOINT
|--------------------------------------------------------------------------
|
| This endpoint only tests communication between
| payment.html and the Render backend.
|
| It does NOT initiate a real payment.
|
|--------------------------------------------------------------------------
*/

app.post("/api/payment", (req, res) => {

    try {

        const {
            phone,
            amount,
            reference,
            description
        } = req.body;


        console.log("Demo payment request:", {
            phone,
            amount,
            reference,
            description
        });


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


        /*
        |--------------------------------------------------------------------------
        | Demo response
        |--------------------------------------------------------------------------
        */

        return res.status(200).json({

            success: true,

            message:
                "Backend connection successful. Demo payment request received.",

            demo: true,

            reference:
                reference ||
                "DEMO-" + Date.now(),

            phone: phone,

            amount: Number(amount),

            description:
                description ||
                "NYOTA demo/test request"

        });

    } catch (error) {

        console.error(
            "Payment endpoint error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Internal server error",

            error:
                error.message

        });

    }

});


/*
|--------------------------------------------------------------------------
| 404 JSON response for API routes
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
        "Server error:",
        error
    );


    res.status(500).json({

        success: false,

        message:
            "Server error",

        error:
            error.message

    });

});


/*
|--------------------------------------------------------------------------
| Start server
|--------------------------------------------------------------------------
*/

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `Server running on port ${PORT}`
    );

});
