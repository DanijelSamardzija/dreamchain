// ============================================================
//  Dream-Chain AI — AI Image Generation Service
//  This module is intentionally isolated so the real API can
//  be swapped in by replacing only the marked TODO blocks.
// ============================================================

// ── Generation status constants ──────────────────────────────
const GEN_STATUS = {
    PENDING:  'pending',   // payment confirmed, generation queued
    LOADING:  'loading',   // actively generating
    DONE:     'done',      // image ready
    ERROR:    'error'      // generation failed
};

// ── Mock image placeholders ───────────────────────────────────
// Deterministic beautiful gradient SVGs encoded as data URIs
// so the app works fully offline with zero external requests.
const MOCK_IMAGES = [
    _svgDataUri('667eea', '764ba2', '🌌'),
    _svgDataUri('f093fb', 'f5576c', '🌸'),
    _svgDataUri('4facfe', '00f2fe', '🌊'),
    _svgDataUri('43e97b', '38f9d7', '🌿'),
    _svgDataUri('fa709a', 'fee140', '🌅'),
    _svgDataUri('a18cd1', 'fbc2eb', '🦋'),
    _svgDataUri('ff9a9e', 'fad0c4', '🌙'),
    _svgDataUri('a1c4fd', 'c2e9fb', '✨'),
];

function _svgDataUri(c1, c2, emoji) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='220'>
        <defs>
            <linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'>
                <stop offset='0%' stop-color='%23${c1}'/>
                <stop offset='100%' stop-color='%23${c2}'/>
            </linearGradient>
        </defs>
        <rect width='400' height='220' fill='url(%23g)'/>
        <text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle'
              font-size='72' font-family='system-ui'>
            ${emoji}
        </text>
    </svg>`;
    return `data:image/svg+xml,${svg}`;
}

// ── 1. buildDreamPrompt ───────────────────────────────────────
// Constructs the prompt string that will be sent to the AI API.
// Centralising this makes prompt-engineering changes easy.
function buildDreamPrompt(dreamText) {
    // ── TODO: Tune prompt for your chosen AI image API ────────
    // e.g. Stable Diffusion, DALL·E, Replicate, etc.
    return [
        'Dreamlike surrealist digital painting,',
        'cinematic lighting, ultra-detailed,',
        '8k resolution, vibrant colors.',
        'Scene:', dreamText.trim()
    ].join(' ');
}

// ── 2. generateDreamImage ─────────────────────────────────────
// Returns a Promise<{ imageUrl, status }>.
// Replace the mock block with your real API call.
async function generateDreamImage(dreamText) {
    const prompt = buildDreamPrompt(dreamText);
    console.log('[AI] Prompt:', prompt);

    // ── TODO: Replace mock with real AI API call ──────────────
    //
    // Option A — Replicate (Stable Diffusion):
    // const res = await fetch('https://api.replicate.com/v1/predictions', {
    //     method: 'POST',
    //     headers: { Authorization: `Token ${REPLICATE_API_TOKEN}`,
    //                'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //         version: '<model-version-id>',
    //         input:   { prompt, num_inference_steps: 30 }
    //     })
    // });
    // const data = await res.json();
    // // poll data.urls.get until status === 'succeeded'
    // return { imageUrl: data.output[0], status: GEN_STATUS.DONE };
    //
    // Option B — OpenAI DALL·E 3:
    // const res = await fetch('https://api.openai.com/v1/images/generations', {
    //     method: 'POST',
    //     headers: { Authorization: `Bearer ${OPENAI_API_KEY}`,
    //                'Content-Type': 'application/json' },
    //     body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1024' })
    // });
    // const data = await res.json();
    // return { imageUrl: data.data[0].url, status: GEN_STATUS.DONE };
    //
    // ─────────────────────────────────────────────────────────

    // Mock: random delay 2–3 s, then return a placeholder image
    const delay = 2000 + Math.random() * 1000;
    await new Promise(r => setTimeout(r, delay));

    // Uncomment to test error handling:
    // throw new Error('Mock AI error');

    const imageUrl = MOCK_IMAGES[Math.floor(Math.random() * MOCK_IMAGES.length)];
    return { imageUrl, status: GEN_STATUS.DONE };
}

// ── 3. saveGeneratedResult ────────────────────────────────────
// Updates an existing dream object in localStorage with the
// result returned by generateDreamImage().
function saveGeneratedResult(dreamId, result, storageKey) {
    try {
        const raw   = localStorage.getItem(storageKey);
        const all   = raw ? JSON.parse(raw) : [];
        const idx   = all.findIndex(d => String(d.id) === String(dreamId));
        if (idx === -1) return;

        all[idx].imageUrl          = result.imageUrl  || null;
        all[idx].generationStatus  = result.status;
        all[idx].updatedAt         = Date.now();

        // ── TODO: Supabase update ─────────────────────────────
        // if (supabase) {
        //     supabase.from('dreams')
        //             .update({ image_url: result.imageUrl, generation_status: result.status })
        //             .eq('id', dreamId);
        // }

        localStorage.setItem(storageKey, JSON.stringify(all));
        return all[idx];
    } catch (e) {
        console.warn('[AI] saveGeneratedResult failed:', e);
        return null;
    }
}
