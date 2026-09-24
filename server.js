require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Format phone number to standard 254XXXXXXXXX format
 */
function normalizeKenyanPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');

    if (/^07\d{8}$/.test(digits) \vert{}\vert{} /^01\d{8}$/.test(digits)) {
        return `254${digits.slice(1)}`;
    }

    if (/^254[71]\d{8}$/.test(digits)) {
        return digits;
    }

    return null;
}

/**
 * Request Daraja OAuth Access Token
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
 * Generate password required by Safaricom STK Push API
 */
function createStkPassword(timestamp) {
    return Buffer.from(
        `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
    ).toString('base64');
}

/**
 * Endpoint to initiate M-Pesa STK Push
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
                error: 'Enter a valid Kenyan Safaricom number (e.g., 0712345678 or 0112345678).'
            });
        }

        const requiredVars = [
            'MPESA_CONSUMER_KEY',
            'MPESA_CONSUMER_SECRET',
            'MPESA_SHORTCODE',
            'MPESA_PASSKEY',
            'MPESA_CALLBACK_URL',
            'MPESA_BASE_URL'
        ];

        const missing = requiredVars.filter((key) => !process.env[key]);
        if (missing.length > 0) {
            return res.status(500).json({
                error: `M-Pesa server configuration incomplete. Missing: ${missing.join(', ')}`
            });
        }

        const accessToken = await getMpesaAccessToken();

        // Format Timestamp YYYYMMDDHHmmss
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
            AccountReference: process.env.MPESA_ACCOUNT_REFERENCE || 'ChurchDonation',
            TransactionDesc: process.env.MPESA_TRANSACTION_DESC || 'Church Contribution'
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

        return res.json({
            success: true,
            message: 'STK Push sent successfully. Please check your phone and enter M-Pesa PIN.',
            checkoutRequestID: response.data.CheckoutRequestID,
            customerMessage: response.data.CustomerMessage
        });
    } catch (error) {
        console.error('M-Pesa STK Push error:', error.response?.data || error.message);
        return res.status(500).json({
            error: error.response?.data?.errorMessage ||
                   error.response?.data?.ResponseDescription ||
                   'Unable to complete M-Pesa payment request.'
        });
    }
});

/**
 * Daraja Webhook/Callback Listener
 */
app.post('/api/mpesa/callback', (req, res) => {
    console.log('M-Pesa Callback Received:', JSON.stringify(req.body, null, 2));
    res.json({
        ResultCode: 0,
        ResultDesc: 'Callback received successfully'
    });
});

/**
 * Health Check API
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Imperishable Crown M-Pesa API Backend' });
});

// Fallback route to serve front-end root
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
