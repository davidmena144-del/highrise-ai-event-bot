// Minimal service worker for installability. It deliberately caches nothing,
// so logging out leaves no offline copy of the app behind.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
