// Dreizunge service worker (PWA install support, v84_b).
//
// Caches the APP SHELL ONLY (this page, its manifest, its icon) so a reload works offline. Every
// other request — every /api/* call (story generation, translation, lesson saves, learner state,
// tutor replies) — is left COMPLETELY ALONE and passes straight through to the network: caching a
// live LLM/model call would mean silently serving a stale or wrong answer, which is worse than no
// offline support at all. Network-first for the shell too (not cache-first): an online user always
// gets the current page; the cache is a true offline fallback, not a speed trick.
'use strict';
const CACHE = 'dreizunge-shell-v1';
const SHELL = ['/', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Deliberately narrow: only same-origin GETs for the exact shell files above are ever intercepted.
  // Everything else (all API calls, any cross-origin request, non-GET methods) is untouched, so the
  // browser's own default network handling applies — a service worker that intercepts more than it
  // strictly needs to is exactly how "why is my API response stale" bugs happen.
  if (req.method !== 'GET' || url.origin !== self.location.origin || !SHELL.includes(url.pathname)) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
