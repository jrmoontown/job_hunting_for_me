/* 취준 대시보드 — 오프라인 캐시 */
const CACHE = 'jobhunt-v1';
const SHELL = [
  './',
  './index.html',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/js/store.js',
  './assets/js/sync.js',
  './assets/js/seed.js',
  './assets/js/ui.js',
  './assets/js/views/calendar.js',
  './assets/js/views/jobs.js',
  './assets/js/views/todos.js',
  './assets/js/views/dashboard.js',
  './assets/js/views/settings.js',
  './assets/js/views/jobShared.js',
  './assets/icons/icon.svg',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // GitHub API 등 외부 요청은 건드리지 않는다
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});
