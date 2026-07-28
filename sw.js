const APP_VERSION = '1.0.0';
const CACHE = `dutchdeck-studio-v${APP_VERSION}`;
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './full-deck.js',
  './family-pack.js', './manifest.webmanifest', './icons/icon-192.png',
  './icons/icon-512.png', './decks/index.json', './icons/apple-touch-icon-180.png',
  './icons/apple-touch-icon-167.png', './icons/apple-touch-icon-152.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first prevents an older app.js from being paired with newer markup/state.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(hit => hit || caches.match('./index.html')))
  );
});


self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
