// Offline shell cache only. Never cache logged-in pages, API data, screenshots,
// credentials, browser sessions, or user-specific responses.
const CACHE_NAME = 'workmode-static-v1';
const STATIC_PATHS = ['/icons/work-mode.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_PATHS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/' || url.pathname === '/login') return;
  if (url.pathname === '/icons/work-mode.svg') {
    event.respondWith(caches.match(event.request).then(cache => cache || fetch(event.request)));
  }
});
