const CACHE_NAME    = 'schooler-v1.3.1';
const STATIC_ASSETS = [
  './', './index.html', './manifest.json',
  './css/style.css',
  './js/app.js', './js/sheets.js', './js/ble.js',
  './js/qrgen.js', './js/jsQR.js', './js/xlsx.full.min.js',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(STATIC_ASSETS))
      .catch(err => {
        // If pre-caching fails (e.g. network), don't block install —
        // the network-first fallback in fetch will handle it.
        console.warn('[SCHOOLER SW] Pre-cache warning:', err);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Don't cache Apps Script API calls
  if (e.request.url.includes('script.google.com')) return;
  // Don't cache Google Sign-In or external resources
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('gstatic.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback: serve the shell for navigation requests
        if (e.request.destination === 'document') {
          return caches.match('./index.html');
        }
        return undefined;
      });
    })
  );
});