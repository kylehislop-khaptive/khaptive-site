// Minimal service worker so phones offer "install". It never caches, so updates show immediately.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function (e) {
  if (e.request.mode !== "navigate") return; // everything else goes straight to the network
  e.respondWith(fetch(e.request).catch(function () {
    return new Response("You appear to be offline. Please reconnect to place an order.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }));
});
