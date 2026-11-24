// 离线缓存（由 tools/gen-sw.mjs 生成，请勿手改）
const VERSION = 'kcz-b9fbe96a41';
const FILES = [
  "./",
  "./audio/manifest.json",
  "./css/style.css",
  "./icon.svg",
  "./index.html",
  "./js/app.js",
  "./js/audio-keys.js",
  "./js/components.js",
  "./js/data/badges.js",
  "./js/data/poems.js",
  "./js/data/readings.js",
  "./js/data/scenes.js",
  "./js/data/sentences.js",
  "./js/data/speaking.js",
  "./js/data/stages.js",
  "./js/data/words.js",
  "./js/data/writing.js",
  "./js/score.js",
  "./js/speech.js",
  "./js/state.js",
  "./js/ui.js",
  "./js/views/ai.js",
  "./js/views/common.js",
  "./js/views/daily.js",
  "./js/views/growth.js",
  "./js/views/material.js",
  "./js/views/parent.js",
  "./js/views/poems.js",
  "./js/views/reading.js",
  "./js/views/review.js",
  "./js/views/sentences.js",
  "./js/views/speaking.js",
  "./js/views/talk.js",
  "./js/views/words.js",
  "./js/views/writing.js",
  "./manifest.webmanifest",
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

// 同一网址下还有别的工具，只清理自己的旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('kcz-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// 网络优先（保证更新），离线时用缓存
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});
