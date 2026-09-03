const CACHE_NAME = 'toilet-map-cache-v1';

// キャッシュする静的ファイルリスト
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json' // PWA用マニフェストがある場合
];

// 1. インストール処理（キャッシュの初期化と即時アクティブ化）
self.addEventListener('install', (e) => {
  // 新しい Service Worker が待機せずにすぐ有効化されるようにする
  self.skipWaiting();

  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 途中で1つ失敗しても全体が倒れないよう個別に catch しておくと安全
      return cache.addAll(urlsToCache).catch((err) => {
        console.warn('一部のファイルキャッシュに失敗しました:', err);
      });
    })
  );
});

// 2. アクティブ化処理（古いキャッシュの削除とクライアントの制御確保）
self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      // 新しい Service Worker がすぐにページを制御できるようにする
      self.clients.claim(),
      // 古いキャッシュをクリア
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

// 3. フェッチ処理（Cache First + Network Fallback）
self.addEventListener('fetch', (e) => {
  const request = e.request;

  // GETリクエスト以外（POSTなど）や http/https 以外の通信（chrome-extension等）はスキップ
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // 地図Tileや外部API（Firebase, Google Maps等）はService Workerのキャッシュ対象から除外する場合の例
  // if (request.url.includes('maps.googleapis.com') || request.url.includes('firestore.googleapis.com')) {
  //   return;
  // }

  e.respondWith(
    caches.match(request).then((cachedResponse) => {
      // キャッシュが存在すればそれを返す (Cache First)
      if (cachedResponse) {
        return cachedResponse;
      }

      // キャッシュが無ければネットワークへ取得しに行く
      return fetch(request).then((networkResponse) => {
        // 正常なレスポンスでなければそのまま返す
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // 動的に取得したレスポンスをキャッシュに追加（必要に応じて）
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // オフラインかつキャッシュもない場合のフォールバック（画面が表示できない場合など）
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
