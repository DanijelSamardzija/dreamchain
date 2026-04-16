// ============================================================
//  Dream-Chain — Service Worker
//  Caches static assets for fast load & offline fallback
// ============================================================

const CACHE_NAME   = 'dreamchain-v2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/ai-service.js',
    '/js/supabase-config.js',
    '/manifest.json',
    '/icons/icon.svg',
    '/icons/icon-maskable.svg'
];

// ── Install: cache all static assets ─────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// ── Activate: remove old caches ───────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// ── Fetch strategy ────────────────────────────────────────────
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    const url = event.request.url;

    // API, Supabase, Pi SDK, CDNs → network only (no caching)
    if (
        url.includes('/api/')      ||
        url.includes('supabase')   ||
        url.includes('minepi.com') ||
        url.includes('pollinations') ||
        url.includes('flagcdn.com') ||
        url.includes('jsdelivr')
    ) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Static assets → cache-first, fallback to network
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
