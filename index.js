const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

const allowedOrigins = [
    'https://pulsezest.com',
    'http://pulsezest.com', // Add both http and https if needed
];

const corsOptions = {
    origin: (origin, callback) => {
        console.log('Origin:', origin); // Log the origin
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            console.error('Not allowed by CORS');
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-VERIFY', 'X-MERCHANT-ID'],
    optionsSuccessStatus: 200
};


app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const salt_key = process.env.SALT_KEY;
const merchant_id = process.env.MERCHANT_ID;

app.get('/', (req, res) => {
    res.send("PhonePe Zindaabaad Rajor Pay ****Baad :)");
});

app.post('/order', async (req, res) => {
    try {
        const { transactionId, amount, name, number, college } = req.body;

        const data = {
            merchantId: merchant_id,
            merchantTransactionId: transactionId,
            name,
            amount: amount * 100, // Convert amount to the required format
            redirectUrl: `https://pulsezest.com/internship`,
            redirectMod: "POST",
            mobileNumber: number,
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
            res.redirect('https://incandescent-bubblegum-7002fd.netlify.app/success');
        } else {
            res.redirect('https://incandescent-bubblegum-7002fd.netlify.app/fail');
        }
    } catch (error) {
        console.error('Error in /status endpoint:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(8000, () => {
    console.log("Server is running on port 8000");
});
