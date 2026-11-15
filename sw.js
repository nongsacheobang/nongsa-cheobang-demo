// 서비스 워커: 정적 파일 캐시 (오프라인에서도 앱 화면이 열리게)
// 파일을 바꾸면 CACHE 이름의 버전을 올린다.
const CACHE = 'nongsa-cheobang-v0.3.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/config.js',
  './js/constants.js',
  './js/auth.js',
  './js/weather.js',
  './js/records.js',
  './js/excel.js',
  './js/demo.js',
  './js/storage/index.js',
  './js/storage/local.js',
  './js/agent/agent.js',
  './js/agent/extract-rules.js',
  './js/agent/llm-adapter.js',
  './js/agent/chat-view.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];
// 외부 CDN 중 캐시해도 되는 것 (버전 고정 URL)
const CDN_CACHE = ['https://cdn.sheetjs.com/'];

self.addEventListener('install', (e) => {
  // cache: 'reload' = 브라우저 HTTP 캐시(GitHub Pages max-age 10분)를 건너뛰고 새 파일을 받는다 (v0.2.2)
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const cdn = CDN_CACHE.some((p) => req.url.startsWith(p));
  if (!same && !cdn) return; // Firebase, 날씨 프록시 등은 캐시하지 않음

  // 화면 이동은 네트워크 우선 (새 버전 반영), 실패 시 캐시
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  // 정적 파일: 캐시 먼저 보여주고 뒤에서 갱신 (stale-while-revalidate)
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req, { cache: 'no-cache' }).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
