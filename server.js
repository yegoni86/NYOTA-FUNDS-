const express = require("express");
const path = require("path");
const axios = require("axios");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 10000;

const PAYLOR_API_URL =
  "https://api.paylorke.com/api/v1/merchants/payments/stk-push";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  "https://nyota-funds-backend-xhcb.onrender.com";

const PAYLOR_CHANNEL_ID =
  process.env.PAYLOR_CHANNEL_ID || "PAYL-DPLPJD";

app.use(express.json());
app.use(express.static(__dirname));

/*
|--------------------------------------------------------------------------
| Home
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
  res.json({
    success: true,
    message: "Nyota Funds backend is running"
  });
});

/*
|--------------------------------------------------------------------------
| Start Paylor M-Pesa STK Push
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

    if (!phone || !amount) {
      return res.status(400).json({
        success: false,
        message: "Phone and amount are required"
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Convert Kenyan phone number to 254 format
    |--------------------------------------------------------------------------
    */

    let formattedPhone = String(phone).replace(/\s+/g, "");

    if (formattedPhone.startsWith("0")) {
      formattedPhone =
        "254" + formattedPhone.substring(1);
    }

    if (formattedPhone.startsWith("+254")) {
      formattedPhone =
        formattedPhone.substring(1);
    }

    if (!/^254[17][0-9]{8}$/.test(formattedPhone)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid Kenyan phone number. Use 0712345678 or 254712345678."
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validate amount
    |--------------------------------------------------------------------------
    */

    const paymentAmount = Number(amount);

    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount"
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Generate reference if frontend didn't provide one
    |--------------------------------------------------------------------------
    */

    const paymentReference =
      reference ||
      `NYOTA-${Date.now()}-${crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;

    /*
    |--------------------------------------------------------------------------
    | Paylor request
    |--------------------------------------------------------------------------
    */

    const payload = {
      phone: formattedPhone,
      amount: paymentAmount,
      reference: paymentReference,
      channelId: PAYLOR_CHANNEL_ID,
      description:
        description || "NYOTA Funds application payment",
      callbackUrl:
        `${BACKEND_URL}/api/paylor-callback`
    };

    console.log("Sending Paylor STK request:", {
      phone: formattedPhone,
      amount: paymentAmount,
      reference: paymentReference,
      channelId: PAYLOR_CHANNEL_ID
    });

    const response = await axios.post(
      PAYLOR_API_URL,
      payload,
      {
        headers: {
          Authorization:
            `Bearer ${process.env.PAYLOR_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    console.log(
      "Paylor response:",
      response.data
    );

    return res.json({
      success: true,
      message:
        "STK Push sent. Please check your M-Pesa phone.",
      reference: paymentReference,
      data: response.data
    });

  } catch (error) {

    console.error(
      "Paylor error:",
      error.response?.data ||
      error.message
    );

    return res.status(
      error.response?.status || 500
    ).json({
      success: false,
      message:
        error.response?.data?.message ||
        "Payment request failed",
      error:
        error.response?.data ||
        error.message
    });
  }
});

/*
|--------------------------------------------------------------------------
| Paylor webhook callback
|--------------------------------------------------------------------------
*/

app.post(
  "/api/paylor-callback",
  (req, res) => {

    console.log(
      "Paylor callback received:",
      JSON.stringify(req.body, null, 2)
    );

    /*
    |--------------------------------------------------------------------------
    | IMPORTANT:
    | Payment status should be verified from Paylor before
    | treating an application as paid.
    |--------------------------------------------------------------------------
    */

    return res.json({
      success: true
    });
  }
);

/*
|--------------------------------------------------------------------------
| Start server
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});
