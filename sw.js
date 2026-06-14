const CACHE_NAME    = 'schooler-v1.2.0';
const STATIC_ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/css/style.css',
  '/js/app.js', '/js/sheets.js', '/js/ble.js',
  '/js/qrgen.js', '/js/jsQR.js', '/js/xlsx.full.min.js',
  '/icons/icon-192.png', '/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(STATIC_ASSETS))
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
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => e.request.destination === 'document' ? caches.match('/index.html') : undefined);
    })
  );
});
