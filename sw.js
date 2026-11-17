// 서비스 워커: 정적 파일 캐시 (오프라인에서도 앱 화면이 열리게)
// 파일을 바꾸면 CACHE 이름의 버전을 올린다.
const CACHE = 'nongsa-cheobang-v0.4.173';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './css/views/codex.css',
  './js/app.js',
  './js/config.js',
  './js/constants.js',
  './js/auth.js',
  './js/weather.js',
  './js/records.js',
  './js/accident-checklist.js',
  './js/excel.js',
  './vendor/sheetjs/xlsx-0.20.3.mjs',
  './js/demo.js',
  './js/storage/index.js',
  './js/storage/local.js',
  './js/storage/contract-store.js',
  './js/contract.js',
  './js/voice.js',
  './js/insurance/crops.js',
  './js/insurance/rules.js',
  './js/insurance/score.js',
  './js/insurance/claim-calc.js',
  './js/insurance/claim-input.js',
  './js/views/claim.js',
  './js/views/registry.js',
  './js/views/index.js',
  './js/views/home.js',
  './js/views/report.js',
  './js/views/premium.js',
  './js/report.js',
  './js/views/field.js',
  './js/views/coverage.js',
  './js/views/info.js',
  './js/views/factors.js',
  './js/views/farm.js',
  './js/views/insurance.js',
  './js/views/record.js',
  './js/terms/glossary.js',
  './js/views/accident.js',
  './js/agent/disaster-language.js',
  './js/weather/alerts.js',
  './js/weather/alert-check.js',
  './js/weather/alerts.fixture.json',
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
const CDN_CACHE = [];

self.addEventListener('install', (e) => {
  // cache: 'reload' = 브라우저 HTTP 캐시(GitHub Pages max-age 10분)를 건너뛰고 새 파일을 받는다 (v0.2.2)
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('nongsa-cheobang-v') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const cdn = CDN_CACHE.some((p) => req.url.startsWith(p));
  if (!same && !cdn) return; // Firebase, 날씨 프록시 등은 캐시하지 않음

  // 앱 진입 화면만 처리한다. 같은 출처의 다른 경로는 API나 개인 응답일 수 있다.
  const scope = new URL(self.registration.scope);
  const appEntry = same && (url.pathname === scope.pathname || url.pathname === new URL('./index.html', scope).pathname);
  if (req.mode === 'navigate' && !appEntry) return;

  // 앱 화면 이동은 네트워크 우선, 실패 시 캐시를 사용한다.
  if (req.mode === 'navigate') {
    const network = fetch(req);
    const update = network.then(async (res) => {
      if (res.ok && !url.search) {
        try { const copy = res.clone(); await (await caches.open(CACHE)).put('./index.html', copy); } catch (_) {}
      }
    }).catch(() => {});
    e.waitUntil(update);
    e.respondWith(network.catch(() => caches.match('./index.html')));
    return;
  }

  // 목록에 없는 같은 출처 요청은 캐시하지 않는다. API와 개인 데이터 응답을 저장하지 않기 위해서다.
  if (same && !ASSETS.some((asset) => new URL(asset, self.registration.scope).href === url.href)) return;

  // 정적 파일: 캐시 먼저 보여주고 뒤에서 갱신 (stale-while-revalidate)
  const cache = caches.open(CACHE).catch(() => null);
  const hit = cache.then(c => c ? c.match(req).catch(() => null) : null);
  const net = Promise.all([cache, hit]).then(([c, cached]) => fetch(req, { cache: 'no-cache' }).then(async res => {
    if (c && res && (res.ok || res.type === 'opaque')) await c.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => cached));
  e.waitUntil(net.then(() => {}));
  e.respondWith(hit.then(cached => cached || net));
});
