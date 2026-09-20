/* Aura Lens service worker: caches the app and MediaPipe files so it works offline after the first visit */
const CACHE = 'aura-v1';
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const PRECACHE = [
  CDN + '/vision_bundle.mjs',
  CDN + '/wasm/vision_wasm_internal.js',
  CDN + '/wasm/vision_wasm_internal.wasm',
  CDN + '/wasm/vision_wasm_nosimd_internal.js',
  CDN + '/wasm/vision_wasm_nosimd_internal.wasm',
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await c.add('./').catch(() => {});
      await c.add('./index.html').catch(() => {});
      await Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const lib = url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'storage.googleapis.com';
  if (!same && !lib) return;

  if (lib) {
    // heavy library files: cache first
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
        return res;
      }))
    );
  } else {
    // the app itself: network first (so updates arrive), cache as fallback
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
  }
});
