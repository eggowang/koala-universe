const CACHE_NAME = 'koala-universe-demo-v9';
const APP_SHELL = ['./', './index.html', './styles.css?v=9', './app.js?v=9', './cloud.js?v=9', './config.js', './manifest.webmanifest', './app-icon.svg', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const networkFirst = event.request.mode === 'navigate' || url.pathname.endsWith('/config.js');
  if (networkFirst) {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)); return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)); return response;
  })));
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const notification = payload.notification || payload;
  event.waitUntil(self.registration.showNotification(notification.title || payload.title || '考拉的宇宙任务', {
    body: notification.body || payload.body || '有一条新的家庭任务提醒',
    icon: './app-icon.svg',
    badge: './app-icon.svg',
    tag: notification.tag || payload.tag || 'koala-task',
    data: { url: notification.navigate || payload.url || './' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || './';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(openClients => {
    const existing = openClients.find(client => client.url === target);
    return existing ? existing.focus() : clients.openWindow(target);
  }));
});
