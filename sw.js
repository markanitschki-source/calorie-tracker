const CACHE = 'kalotrack-v22';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './css/components.css',
  './js/app.js',
  './js/db.js',
  './js/api.js',
  './js/search.js',
  './js/data/foods-de.js',
  './js/views/dashboard.js',
  './js/views/foodlog.js',
  './js/views/recipes.js',
  './js/views/shopping.js',
  './js/views/weekplan.js',
  './js/views/body.js',
  './js/views/settings.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  // Network-first for API calls, cache-first for assets
  const url = new URL(e.request.url);
  const isApi = url.hostname.includes('openfoodfacts') || url.hostname.includes('anthropic') || url.hostname.includes('jsdelivr');

  if (isApi) {
    e.respondWith(fetch(e.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok && e.request.method === 'GET') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});
