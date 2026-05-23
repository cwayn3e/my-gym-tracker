const CACHE_NAME = 'gymtracker-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './script.js',
  './db.js',
  './style.css',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/rabbit_girl_new.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('supabase') || event.request.url.includes('sortablejs')) {
        event.respondWith(fetch(event.request).catch(() => {
            return new Response('Offline', { status: 503 });
        }));
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).then((response) => {
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, response.clone());
                    return response;
                });
            });
        }).catch(() => {
            return caches.match('./index.html').then((fallback) => fallback || new Response('Offline', { status: 503 }));
        })
    );
});
