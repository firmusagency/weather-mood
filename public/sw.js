/* Weather Mood guest page service worker: offline shell + evening push notifications. */
const VERSION = 'wm-v1';
const DATA = /\/data\/.*\.json(\?.*)?$/;

self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw new Error('offline');
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || refresh;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // forecast data and page navigations: fresh when online, last copy when not
  if (DATA.test(url.pathname) || req.mode === 'navigate') e.respondWith(networkFirst(req));
  else e.respondWith(staleWhileRevalidate(req));
});

self.addEventListener('push', (e) => {
  let payload = {};
  try {
    payload = e.data ? e.data.json() : {};
  } catch {
    payload = { body: e.data ? e.data.text() : '' };
  }
  const title = payload.title || 'Weather Mood';
  e.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: payload.icon || 'icons/icon-192.png',
      badge: payload.badge || 'icons/badge-96.png',
      tag: payload.tag || 'weather-mood',
      renotify: true,
      data: { url: payload.url || './guest.html' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './guest.html', self.location.href).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(url.split('#')[0]));
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});
