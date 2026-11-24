// Offline: every request goes to the network first and refreshes the cache; with no signal the last copy is served.
// Bump V only to drop old caches; content updates arrive on their own because the network always wins.
const V = "pulse-v1";
const SHELL = ["./", "index.html", "style.css", "i18n.js", "app.js", "manifest.webmanifest", "icons/icon-192.png",
  "data/indicators.json", "data/thali.json",
  "https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"];

self.addEventListener("install", (e) => {
  // one missing file (thali.json can 404) must not block install
  e.waitUntil(caches.open(V).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || !r.url.startsWith("http")) return;
  e.respondWith(fetch(r).then((res) => {
    if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(V).then((c) => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then((hit) => hit || (r.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});
