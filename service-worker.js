// Bump this version any time index.html (or another cached file) changes,
// so returning visitors pick up the new version instead of a stale cache.
const CACHE_NAME = 'bitacora-cache-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Only handle same-origin GET requests (the app shell). Requests to Supabase
// and to esm.sh (where the Supabase client library is loaded from) are left
// untouched so the app's live data is never served from a stale cache.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// --- Notificaciones push (recordatorios diarios) ------------------------
self.addEventListener('push', (event) => {
  let data = {};
  try{ data = event.data ? event.data.json() : {}; }catch(e){ data = { title: 'Bitácora de Mantenimiento', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Bitácora de Mantenimiento';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/favicon-32.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(self.location.origin));
      if(existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
