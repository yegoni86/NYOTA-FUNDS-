const express = require("express");
const path = require("path");
const axios = require("axios");

const app = express();

const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/payment", async (req, res) => {
  try {
    const { phone, amount, reference } = req.body;

    if (!phone || !amount || !reference) {
      return res.status(400).json({
        success: false,
        message: "Phone, amount and reference are required"
      });
    }

    const response = await axios.post(
      "https://api.paylorke.com/api/v1/merchants/payments/stk-push",
      {
        phone,
        amount,
        reference,
        channelId: process.env.PAYLOR_CHANNEL_ID,
        description: "NYOTA application payment",
        callbackUrl:
          "https://nyota-funds-backend-xhcb.onrender.com/api/paylor-callback"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYLOR_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error(
      "Paylor error:",
      error.response?.data || error.message
    );

    res.status(500).json({
      success: false,
      message: "Payment request failed",
      error: error.response?.data || error.message
    });
  }
});

app.post("/api/paylor-callback", (req, res) => {
  console.log("Paylor callback:", req.body);

  res.json({
    success: true
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
