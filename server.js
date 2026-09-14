require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON requests.
app.use(express.json());

// Serve the existing church website files.
app.use(express.static(__dirname));

/**
 * Convert a Kenyan phone number into the 2547XXXXXXXX / 2541XXXXXXXX
 * format expected by M-Pesa.
 */
function normalizeKenyanPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');

    if (/^07\d{8}$/.test(digits) || /^01\d{8}$/.test(digits)) {
        return `254${digits.slice(1)}`;
    }

    if (/^254[71]\d{8}$/.test(digits)) {
        return digits;
    }

    if (/^\+254[71]\d{8}$/.test(String(phone).trim())) {
        return digits;
    }

    return null;
}

/**
 * Get an OAuth access token from Daraja.
 */
async function getMpesaAccessToken() {
    const credentials = Buffer.from(
        `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');

    const response = await axios.get(
        `${process.env.MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
        {
            headers: {
                Authorization: `Basic ${credentials}`
            }
        }
    );

    return response.data.access_token;
}

/**
 * Generate the timestamp and password required by the STK Push API.
 */
function createStkPassword(timestamp) {
    return Buffer.from(
        `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');
}

/**
 * M-Pesa STK Push endpoint.
 */
app.post('/api/mpesa/stkpush', async (req, res) => {
    try {
        const amount = Number(req.body.amount);
        const phone = normalizeKenyanPhone(req.body.phone);

        if (!Number.isInteger(amount) || amount < 10) {
            return res.status(400).json({
                error: 'Amount must be a whole number of at least KES 10.'
            });
        }

        if (!phone) {
            return res.status(400).json({
                error: 'Enter a valid Kenyan Safaricom number, e.g. 0712345678.'
            });
        }

        const required = [
            'MPESA_CONSUMER_KEY',
            'MPESA_CONSUMER_SECRET',
            'MPESA_SHORTCODE',
            'MPESA_PASSKEY',
            'MPESA_CALLBACK_URL',
            'MPESA_BASE_URL'
        ];

        const missing = required.filter((name) => !process.env[name]);

        if (missing.length > 0) {
            return res.status(500).json({
                error: `M-Pesa server configuration is incomplete. Missing: ${missing.join(', ')}`
            });
        }

        const accessToken = await getMpesaAccessToken();

        // Daraja timestamps use YYYYMMDDHHmmss.
        const now = new Date();
        const timestamp =
            now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');

        const payload = {
            BusinessShortCode: process.env.MPESA_SHORTCODE,
            Password: createStkPassword(timestamp),
            Timestamp: timestamp,
            TransactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
            Amount: amount,
            PartyA: phone,
            PartyB: process.env.MPESA_SHORTCODE,
            PhoneNumber: phone,
            CallBackURL: process.env.MPESA_CALLBACK_URL,
            AccountReference: process.env.MPESA_ACCOUNT_REFERENCE || 'CHURCH-DONATION',
            TransactionDesc: process.env.MPESA_TRANSACTION_DESC || 'Church donation'
        };

        const response = await axios.post(
            `${process.env.MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('STK Push response:', response.data);

        return res.json({
            success: true,
            message: 'STK Push sent. Check your phone and enter your M-Pesa PIN.',
            checkoutRequestID: response.data.CheckoutRequestID,
            customerMessage: response.data.CustomerMessage
        });
    } catch (error) {
        console.error(
            'M-Pesa error:',
            error.response?.data || error.message
        );

        return res.status(500).json({
            error:
                error.response?.data?.errorMessage ||
                error.response?.data?.ResponseDescription ||
                'Unable to start the M-Pesa payment.'
        });
    }
});

/**
 * Daraja sends the final transaction result to this endpoint.
 *
 * IMPORTANT:
 * Do not trust a browser request to this URL as proof of payment.
 * In a production system, store and verify the callback transaction data.
 */
app.post('/api/mpesa/callback', (req, res) => {
    console.log('M-Pesa callback received:');
    console.dir(req.body, { depth: null });

    // Acknowledge the callback quickly.
    res.json({
        ResultCode: 0,
        ResultDesc: 'Callback received successfully'
    });
});

// Simple health check.
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Imperishable Crown M-Pesa backend'
    });
});

app.listen(PORT, () => {
    console.log(`Church website running at http://localhost:${PORT}`);
});
