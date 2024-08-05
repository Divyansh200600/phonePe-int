const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const axios = require("axios");
const bodyParser = require("body-parser");
const uuid = require("uuid"); // Use uuid for generating unique IDs

require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));

const salt_key = process.env.SALT_KEY;
const merchant_id = process.env.MERCHANT_ID;

// Dummy in-memory store for payment details
const paymentDetailsStore = [];

app.get("/", (req, res) => {
    res.send("server is running");
});

app.post("/order", async (req, res) => {
    try {
        const merchantTransactionId = uuid.v4(); // Generate a unique ID
        const data = {
            merchantId: merchant_id,
            merchantTransactionId: merchantTransactionId,
            merchantUserId: req.body.MUID,
            name: req.body.name,
            docId: req.body.docId,  // Important line to include uniqueId
            amount: req.body.amount * 100,
            redirectUrl: `https://phonepe.pulsezest.com/status/?id=${merchantTransactionId}`,
            redirectMode: 'POST',
            mobileNumber: req.body.number,
            paymentInstrument: {
                type: 'PAY_PAGE'
            }
        };
        const payload = JSON.stringify(data);
        const payloadMain = Buffer.from(payload).toString('base64');
        const keyIndex = 1;
        const string = payloadMain + '/pg/v1/pay' + salt_key;
        const sha256 = crypto.createHash('sha256').update(string).digest('hex');
        const checksum = sha256 + '###' + keyIndex;

        const prod_URL = "https://api.phonepe.com/apis/hermes/pg/v1/pay";

        const options = {
            method: 'POST',
            url: prod_URL,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum
            },
            data: {
                request: payloadMain
            }
        };

        const response = await axios.request(options);
        console.log('Order Response:', response.data);

        if (response.data && response.data.data && response.data.data.instrumentResponse && response.data.data.instrumentResponse.redirectInfo) {
            // Store the payment details in the in-memory store
            paymentDetailsStore.push({
                merchantTransactionId: merchantTransactionId,
                name: req.body.name,
                number: req.body.number,
                docId: req.body.docId,
                amount: req.body.amount * 100 // amount in cents
            });

            res.json({
                redirectUrl: response.data.data.instrumentResponse.redirectInfo.url,
                transactionId: merchantTransactionId // Send the unique ID back
            });
        } else {
            res.status(500).send({
                message: 'Invalid response from payment gateway',
                success: false
            });
        }
    } catch (error) {
        console.error('Order Error:', error.response ? error.response.data : error.message);
        res.status(500).send({
            message: 'Payment request failed',
            success: false
        });
    }
});

app.post("/status", async (req, res) => {
    const merchantTransactionId = req.query.id;
    const merchantId = merchant_id;

    const keyIndex = 1;
    const string = `/pg/v1/status/${merchantId}/${merchantTransactionId}` + salt_key;
    const sha256 = crypto.createHash('sha256').update(string).digest('hex');
    const checksum = sha256 + "###" + keyIndex;

    const options = {
        method: 'GET',
        url: `https://api.phonepe.com/apis/hermes/pg/v1/status/${merchantId}/${merchantTransactionId}`,
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
            'X-MERCHANT-ID': `${merchantId}`
        }
    };

    // Check payment status
    axios.request(options).then(async (response) => {
            if (response.data.success === true) {
                const url = `https://pulsezest.com/success?id=${merchantTransactionId}`
                return res.redirect(url)
            } else {
                const url = `https://pulsezest.com/failure`
                return res.redirect(url)
            }
        })
        .catch((error) => {
            console.error(error);
            const url = `https://pulsezest.com/failure`
            return res.redirect(url)
        });

});

app.get("/payment-details", async (req, res) => {
    const transactionId = req.query.id;

    // Fetch the payment details from the in-memory store
    const paymentDetails = paymentDetailsStore.find(payment => payment.merchantTransactionId === transactionId);

    if (paymentDetails) {
        res.json(paymentDetails);
    } else {
        res.status(404).send({
            message: 'Payment details not found',
            success: false
        });
    }
});

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});