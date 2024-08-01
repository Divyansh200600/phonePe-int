const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

// Allow requests from specific origins
const allowedOrigins = ['http://localhost:3000', 'https://incandescent-bubblegum-7002fd.netlify.app'];

const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const salt_key = 'a70515c2-0e9e-4014-8459-87959a299dbd';
const merchant_id = 'M22MQP88RI7F0';

app.get('/', (req, res) => {
    res.send("Welcome to the payment system!");
});

app.post('/order', async (req, res) => {
    try {
        const merchantTransactionId = req.body.transactionId;

        const data = {
            merchantId: merchant_id,
            merchantTransactionId: merchantTransactionId,
            name: req.body.name,
            amount: req.body.amount * 100,
            redirectUrl: `https://yourdomain.com/status?id=${merchantTransactionId}`,
            redirectMode: "POST",
            mobileNumber: req.body.number,
            paymentInstrument: {
                type: "PAY_PAGE"
            }
        };

        const payload = JSON.stringify(data);
        const payloadBase64 = Buffer.from(payload).toString('base64');
        const keyIndex = 1;
        const signatureString = payloadBase64 + '/pg/v1/pay' + salt_key;
        const sha256 = crypto.createHash('sha256').update(signatureString).digest('hex');
        const checksum = sha256 + '###' + keyIndex;

        const options = {
            method: 'POST',
            url: "https://api.phonepe.com/apis/hermes/pg/v1/pay",
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum
            },
            data: {
                request: payloadBase64
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
        const keyIndex = 1;
        const signatureString = `/pg/v1/status/${merchant_id}/${merchantTransactionId}` + salt_key;
        const sha256 = crypto.createHash('sha256').update(signatureString).digest('hex');
        const checksum = sha256 + '###' + keyIndex;

        const options = {
            method: 'GET',
            url: `https://api.phonepe.com/apis/hermes/pg/v1/status/${merchant_id}/${merchantTransactionId}`,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
                'X-MERCHANT-ID': `${merchant_id}`
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