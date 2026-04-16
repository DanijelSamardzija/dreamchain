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
    const { prompt, style } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const stylePrompts = {
        dreamlike:  'surreal dreamlike art, soft glowing ethereal colors',
        anime:      'anime style illustration, vibrant manga art, highly detailed',
        realistic:  'photorealistic hyperdetailed cinematic photography, 8k resolution',
        fantasy:    'epic fantasy digital painting, magical atmosphere, dramatic lighting',
        cyberpunk:  'cyberpunk neon city art, dark futuristic dystopia, glowing lights',
        watercolor: 'delicate watercolor painting, soft brushstrokes, artistic illustration'
    };
    const stylePrefix = stylePrompts[style] || stylePrompts.dreamlike;

    try {
        const encoded  = encodeURIComponent(`${stylePrefix}: ${prompt}`);
        const seed     = Math.floor(Math.random() * 1000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&seed=${seed}&nologo=true`;

        console.log('[Pollinations] Fetching image...');
        let imgRes;
        for (let attempt = 1; attempt <= 4; attempt++) {
            imgRes = await fetch(imageUrl);
            if (imgRes.status !== 429) break;
            console.log(`[Pollinations] Rate limited (429), retry ${attempt}/4 in 5s...`);
            await new Promise(r => setTimeout(r, 5000));
        }
        if (!imgRes.ok) {
            console.error('[Pollinations] Failed to fetch image:', imgRes.status);
            return res.status(500).json({ error: 'Image fetch failed: ' + imgRes.status });
        }

        const buffer      = await imgRes.buffer();
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        console.log('[Pollinations] Image ready, size:', buffer.length);

        res.set('Content-Type', contentType);
        res.set('Access-Control-Allow-Origin', '*');
        res.send(buffer);
    } catch (err) {
        console.error('[Pollinations] Error:', err);
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
