// ============================================================
//  Dream-Chain — Backend Server
//  Handles Pi Network payment approval & completion
// ============================================================

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());
app.use(cors());
app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.path} origin=${req.headers.origin || 'none'}`);
    next();
});

// ── Pi API helpers ────────────────────────────────────────────
const PI_API_BASE = 'https://api.minepi.com/v2';
const PI_HEADERS  = {
    'Authorization': `Key ${process.env.PI_API_KEY}`,
    'Content-Type':  'application/json'
};

// ── POST /api/payments/approve ────────────────────────────────
app.post('/api/payments/approve', async (req, res) => {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'Missing paymentId' });

    try {
        const response = await fetch(`${PI_API_BASE}/payments/${paymentId}/approve`, {
            method:  'POST',
            headers: PI_HEADERS
        });
        const data = await response.json();

        if (!response.ok) {
            console.error('[Pi] Approve failed:', data);
            return res.status(response.status).json(data);
        }

        console.log('[Pi] Payment approved:', paymentId);
        res.json({ success: true, payment: data });
    } catch (err) {
        console.error('[Pi] Approve error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/payments/complete ───────────────────────────────
app.post('/api/payments/complete', async (req, res) => {
    const { paymentId, txid } = req.body;
    if (!paymentId || !txid) return res.status(400).json({ error: 'Missing paymentId or txid' });

    try {
        const response = await fetch(`${PI_API_BASE}/payments/${paymentId}/complete`, {
            method:  'POST',
            headers: PI_HEADERS,
            body:    JSON.stringify({ txid })
        });
        const data = await response.json();

        if (!response.ok) {
            console.error('[Pi] Complete failed:', data);
            return res.status(response.status).json(data);
        }

        console.log('[Pi] Payment completed:', paymentId, 'txid:', txid);
        res.json({ success: true, payment: data });
    } catch (err) {
        console.error('[Pi] Complete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'dreamchain-server' });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`Dream-Chain server running on port ${PORT}`);
});
