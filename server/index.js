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

// ── POST /api/generate-image ──────────────────────────────────
app.post('/api/generate-image', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    try {
        const startRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
            method:  'POST',
            headers: {
                'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify({
                input: {
                    prompt:        `dream visualization, surreal dreamlike art: ${prompt}`,
                    num_outputs:   1,
                    aspect_ratio:  '1:1',
                    output_format: 'webp',
                    output_quality: 80
                }
            })
        });

        let prediction = await startRes.json();
        console.log('[Replicate] Started prediction:', prediction.id);

        // Poll until done (max 60s)
        let attempts = 0;
        while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && attempts < 60) {
            await new Promise(r => setTimeout(r, 1000));
            const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
                headers: { 'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}` }
            });
            prediction = await pollRes.json();
            attempts++;
        }

        if (prediction.status !== 'succeeded') {
            console.error('[Replicate] Failed:', prediction.error);
            return res.status(500).json({ error: prediction.error || 'Generation failed' });
        }

        const imageUrl = prediction.output[0];
        console.log('[Replicate] Image ready:', imageUrl);
        res.json({ imageUrl });
    } catch (err) {
        console.error('[Replicate] Error:', err);
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
