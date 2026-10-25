'use strict';

const CACHE_PREFIX = 'kxnoverse-pwa-shell-';
const CACHE_NAME = `${CACHE_PREFIX}42.3.15-fb59ff8cb104`;
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './pwa.css',
  './manifest.webmanifest',
  './pwa-runtime.js',
  './pwa-shell.js',
  './app.js',
  './audio-engine.js',
  './transition-system.js',
  './m3shapes.js',
  './lyrics-rtl.js',
  './track-sort.js',
  './search-text.js',
  './library-tools.js',
  './assets/hls.min.js',
  './assets/kxnoverse-icon.png',
  './assets/fonts/minecraft.ttf',
  './assets/fonts/minecraft-bold.ttf',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.includes('/api/') ||
    url.search ||
    !/\.(?:css|html|ico|js|json|png|svg|ttf|webmanifest|woff2?)$/i.test(url.pathname)
  ) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && response.type === 'basic') {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        }
        return response;
      });
    })
  );
});
