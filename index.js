const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const axios = require("axios");
const bodyParser = require("body-parser");

require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));

const salt_key = process.env.SALT_KEY;
const merchant_id = process.env.MERCHANT_ID;

app.get("/", (req, res) => {
    res.send("Server is running");
});

app.post("/order", async (req, res) => {
    try {
        const { transactionId, MUID, name, amount, number } = req.body;

        const data = {
            merchantId: merchant_id,
            merchantTransactionId: transactionId,
            merchantUserId: MUID,
            name: name,
            amount: amount * 100,
            redirectUrl: `${process.env.BASE_URL}/callback`, // Dynamic redirect URL
            redirectMode: 'POST',
            mobileNumber: number,
            paymentInstrument: {
                type: 'PAY_PAGE'
            }
        };
        const payload = JSON.stringify(data);
        const payloadMain = Buffer.from(payload).toString('base64');
        const string = payloadMain + '/pg/v1/pay' + salt_key;
        const sha256 = crypto.createHash('sha256').update(string).digest('hex');
        const checksum = sha256 + '###' + 1; // Assuming keyIndex is always 1

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
        res.json(response.data);

    } catch (error) {
        console.error(error);
        res.status(500).send({
            message: error.message,
            success: false
        });
    }
});

app.post("/status", async (req, res) => {
    try {
        const merchantTransactionId = req.query.id;
        const merchantId = merchant_id;

        const string = `/pg/v1/status/${merchantId}/${merchantTransactionId}` + salt_key;
        const sha256 = crypto.createHash('sha256').update(string).digest('hex');
        const checksum = sha256 + "###" + 1; // Assuming keyIndex is always 1

        const options = {
            method: 'GET',
            url: `https://api.phonepe.com/apis/pg/v1/status/${merchantId}/${merchantTransactionId}`,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
                'X-MERCHANT-ID': merchantId
            }
        };

        const response = await axios.request(options);

        if (response.data.success) {
            res.redirect(`${process.env.BASE_URL}/success`);
        } else {
            res.redirect(`${process.env.BASE_URL}/failure`);
        }

    } catch (error) {
        console.error(error);
        res.status(500).send({
            message: error.message,
            success: false
        });
    }
});

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
