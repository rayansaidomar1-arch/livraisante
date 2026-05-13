/* ─── Livraisanté Service Worker ────────────────────────────────── */
const CACHE_NAME    = 'livraisante-v1';
const CDN_CACHE     = 'livraisante-cdn-v1';

/* Ressources locales à mettre en cache immédiatement */
const LOCAL_ASSETS  = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

/* CDN React + Babel + Tailwind — mis en cache à la première utilisation */
const CDN_PATTERNS  = [
  'cdn.tailwindcss.com',
  'unpkg.com/react',
  'unpkg.com/react-dom',
  'unpkg.com/@babel',
];

/* ── Installation ─────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(LOCAL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ── Activation — purge des anciens caches ───────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CDN_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch — stratégie hybride ───────────────────────────────── */
self.addEventListener('fetch', event => {
  const url = event.request.url;

  /* CDN → Cache first, réseau en fallback */
  if (CDN_PATTERNS.some(p => url.includes(p))) {
    event.respondWith(
      caches.open(CDN_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(resp => {
            cache.put(event.request, resp.clone());
            return resp;
          });
        })
      )
    );
    return;
  }

  /* Assets locaux → Network first, cache en fallback (offline) */
  if (url.startsWith(self.location.origin)) {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
});

/* ── Push notifications (optionnel pour la v2) ────────────────── */
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  self.registration.showNotification(data.title || 'Livraisanté', {
    body:    data.body    || 'Votre commande est en route !',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/icon-96.png',
    vibrate: [100, 50, 100],
    data:    { url: data.url || '/' },
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
