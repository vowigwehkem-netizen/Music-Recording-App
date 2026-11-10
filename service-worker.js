/
Service Worker for Music Recording App
Enables offline caching, app shell availability, and smooth updates.
*/
const CACHE_NAME = 'music-studio-v1.0.0';
const ASSETS_TO_CACHE = [
'./',
'./index.html',
'./styles.css',
'./app.js',
'./manifest.webmanifest'
];
async function cacheAssetsSafely(cache, assets) {
return Promise.all(
assets.map(async (asset) => {
try {
const response = await fetch(asset);
if (response.ok) {
await cache.put(asset, response);
}
} catch (err) {
console.warn([Service Worker] Could not cache asset ${asset}:, err);
}
})
);
}
self.addEventListener('install', (event) => {
event.waitUntil(
caches.open(CACHE_NAME)
.then((cache) => {
console.log('[Service Worker] Pre-caching Application Shell');
return cacheAssetsSafely(cache, ASSETS_TO_CACHE);
})
.then(() => self.skipWaiting())
.catch((error) => {
console.error('[Service Worker] Pre-cache failed:', error);
})
);
});
self.addEventListener('activate', (event) => {
event.waitUntil(
caches.keys().then((cacheNames) => {
return Promise.all(
cacheNames.map((cache) => {
if (cache !== CACHE_NAME) {
console.log('[Service Worker] Deleting outdated cache:', cache);
return caches.delete(cache);
}
})
);
}).then(() => self.clients.claim())
);
});
self.addEventListener('fetch', (event) => {
const request = event.request;
const url = new URL(request.url);
if (request.method !== 'GET') {
return;
}
if (url.protocol === 'blob:' || url.protocol === 'data:' || url.pathname.endsWith('.wav') || url.pathname.endsWith('.mp3')) {
return;
}
event.respondWith(
caches.match(request).then((cachedResponse) => {
if (cachedResponse) {
fetch(request).then((networkResponse) => {
if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
}
}).catch(() => {});
return cachedResponse;
}
return fetch(request)
.then((networkResponse) => {
if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
return networkResponse;
}
const responseToCache = networkResponse.clone();
caches.open(CACHE_NAME).then((cache) => {
cache.put(request, responseToCache);
});
return networkResponse;
})
.catch((error) => {
console.error('[Service Worker] Fetch failed for:', request.url, error);
if (request.mode === 'navigate') {
return caches.match('./index.html');
}
});
})
);
});
