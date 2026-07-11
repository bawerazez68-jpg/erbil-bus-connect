// Deliberately does not cache anything. Bus positions, ratings, ads, and
// auth state are all live/dynamic — caching responses here would risk
// serving stale fleet data. This file exists only so the app satisfies
// Android/Chrome's "has a service worker" install-prompt criteria; every
// request still goes straight to the network.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // No-op: let the browser handle the request normally.
});
