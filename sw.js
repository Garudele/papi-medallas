const CACHE = 'papi-medallas-v4';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'notifications.js',
  'manifest.json',
  'data/encrypted.json',
  'assets/icons/icon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const fecha = e.notification.data && e.notification.data.fecha;
  const url = fecha ? `./?abrir=${fecha}` : './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (c.url.includes(self.registration.scope)) {
          c.focus();
          c.postMessage({ type: 'abrir-medalla', fecha });
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isHtml = e.request.mode === 'navigate' || url.pathname.endsWith('.html');

  if (isHtml) {
    // Network-first para HTML: siempre intenta fresco, cache solo si falla
    e.respondWith(
      fetch(e.request).then((resp) => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Stale-while-revalidate para assets estáticos
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
