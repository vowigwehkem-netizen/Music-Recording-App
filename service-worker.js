/**
 * Service Worker for Music Recording App
 * Enables offline caching, app shell availability, and smooth updates.
 */

const CACHE_NAME = 'music-studio-v1.0.0';

// Relative paths to ensure compatibility with GitHub Pages (e.g., /Music-Recording-App/)
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.webmanifest'
];

/**
 * Install Event: Pre-cache core application shell
 */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Pre-caching Application Shell');
                return cache.addAll(ASSET_TO_CACHE_SAFE(cache, ASSETS_TO_CACHE));
            })
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.error('[Service Worker] Pre-cache failed:', error);
            })
    );
});

/**
 * Helper to gracefully cache assets without failing completely on single missing files
 */
async function ASSET_TO_CACHE_SAFE(cache, assets) {
    return Promise.all(
        assets.map(async (asset) => {
            try {
                const response = await fetch(asset);
                if (response.ok) {
                    await cache.put(asset, response);
                }
            } catch (err) {
                console.warn(`[Service Worker] Could not pre-cache asset ${asset}:`, err);
            }
        })
    );
}

/**
 * Activate Event: Clean up old cache versions
 */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

/**
 * Fetch Event: Network-first / Cache-first strategies with safety rules for audio data
 */
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Rule 1: Do not cache non-GET requests (e.g., POST, PUT, DELETE)
    if (request.method !== 'GET') {
        return;
    }

    // Rule 2: Exclude dynamic blob:, data:, audio streams, or microphone data URIs
    if (url.protocol === 'blob:' || url.protocol === 'data:' || url.pathname.endsWith('.wav') || url.pathname.endsWith('.mp3')) {
        return;
    }

    // Rule 3: Network-first strategy for dynamic resources, fallback to cache
    // Cache-first for local static assets (app shell)
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // Return cached static asset immediately, update cache in background
                fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
                    }
                }).catch(() => {/* Ignore background fetch failures offline */});
                return cachedResponse;
            }

            // Fallback to network fetch if not in cache
            return fetch(request)
                .then((networkResponse) => {
                    // Check for valid response before caching
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }

                    // Clone response stream before caching
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });

                    return networkResponse;
                })
                .catch((error) => {
                    console.error('[Service Worker] Fetch failed for:', request.url, error);
                    // Offline fallback: Return index.html if navigating
                    if (request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
        })
    );
});
                      
