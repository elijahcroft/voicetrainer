// Service worker: makes the trainer installable and usable with no network.
// Strategy is stale-while-revalidate — the cached copy answers immediately, and
// a fresh copy is fetched in the background for the next launch. Nothing here
// touches microphone data; audio never leaves the page in the first place.

// Everything between the two markers is replaced at build time by the plugin in
// vite.config.js, which knows the content-hashed filenames this build produced.
// The values below are only what an unbuilt copy of this file would use; the
// page registers a service worker in production builds alone, so they are never
// what ships.
// build:shell-start
var CACHE = 'voice-trainer-dev';
var SHELL = ['./', './index.html'];
// build:shell-end

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
    .then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(caches.match(req).then(function (hit) {
    var fresh = fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () { return hit; });
    return hit || fresh;
  }));
});
