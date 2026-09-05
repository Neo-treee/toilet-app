// キャッシュ名を v2 に変更（これで古いキャッシュが破棄され、最新の app.js が読み込まれます）
const CACHE_NAME = 'toilet-map-cache-v2';

const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch((err) => {
        console.warn('一部のファイルキャッシュに失敗しました:', err);
      });
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
    ])
  );
});

self.addEventListener('fetch', (e) => {
  const request = e.request;

  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // ★超重要：Firebase(認証・DB) と Googleマップの通信は中継せずにそのままスルーさせる
  if (
    request.url.includes('maps.googleapis.com') ||
    request.url.includes('firestore.googleapis.com') ||
    request.url.includes('identitytoolkit.googleapis.com') || // Firebase Auth
    request.url.includes('firebaseio.com')
  ) {
    return; // これを書かないとFirebaseの接続がフリーズします
  }

  e.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
