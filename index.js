const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto'); // Import crypto

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const salt_key = 'a70515c2-0e9e-4014-8459-87959a299dbd';
const merchant_id = 'M22MQP88RI7F0';

app.get('/', (req, res) => {
    res.send("Hello World!");
});

app.post('/order', async (req, res) => {
    try {
        const merchantTransactionId = req.body.transactionId;

        const data = {
            merchantId: merchant_id,
            merchantTransactionId: merchantTransactionId,
            name: req.body.name,
            amount: req.body.amount * 100, // Ensure amount is correct
            redirectUrl: `http://localhost:8000/status?id=${merchantTransactionId}`, // This should match the onboarding URL configuration
            redirectMod: "POST",
            mobileNumber: req.body.number,
            paymentInstrument: {
                type: "PAY_PAGE"
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

        const response = await axios(options);

        // Log the raw response to ensure it's correct
        console.log('Raw API Response:', response.data);

        // Ensure the URL field is correctly set
        const redirectUrl = response.data.data?.instrumentResponse?.redirectInfo?.url;

        if (redirectUrl) {
            res.json({
                success: true,
                data: {
                    instrumentResponse: {
                        redirectInfo: {
                            url: redirectUrl
                        }
                    }
                }
            });
        } else {
            res.status(500).json({ error: 'Redirect URL is missing in response' });
        }
    } catch (error) {
        console.error('Error in /order endpoint:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.get('/status', async (req, res) => {
    try {
        const merchantTransactionId = req.query.id;
        const merchantId = merchant_id;
        const keyIndex = 1;
        const string = `/pg/v1/status/${merchantId}/${merchantTransactionId}` + salt_key;
        const sha256 = crypto.createHash('sha256').update(string).digest('hex');
        const checksum = sha256 + '###' + keyIndex;

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

        const response = await axios.request(options);

        if (response.data.success === true) {
            res.redirect('https://localhost:3000/success');
        } else {
            res.redirect('https://localhost:3000/fail');
        }
    } catch (error) {
        console.error('Error in /status endpoint:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.listen(8000, () => {
    console.log("Server is running on port 8000");
});
