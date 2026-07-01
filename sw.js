/* SCHOOLER Service Worker v2.0
   Network-first strategy — never serves stale JS/CSS.
   Falls back to cache only when completely offline.     */

const CACHE = 'schooler-v2.0';
const PRECACHE = [
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/app.js',
  'js/sheets.js',
  'js/ble.js',
  'js/qrgen.js',
  'js/jsQR.js',
  'js/xlsx.full.min.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

// Install: pre-cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(err => {
        // If any asset fails to cache, don't block install
        console.warn('[SW] precache partial failure:', err);
      })
  );
});

// Activate: delete ALL old caches so stale files never block loading
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: NETWORK FIRST — always try the network.
// Only fall back to cache when offline.
// Never cache Apps Script or Google API calls.
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Pass through non-GET and external API calls uncached
  if (e.request.method !== 'GET') return;
  if (url.includes('script.google.com')) return;
  if (url.includes('googleapis.com')) return;
  if (url.includes('accounts.google.com')) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Cache successful same-origin responses
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline: serve from cache
        return caches.match(e.request)
          .then(cached => cached || caches.match('index.html'));
      })
  );
});
