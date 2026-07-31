const CACHE_NAME = "deer-star-mobile-local-v25";

const APP_ASSETS = [
  "./mobile-local.html",
  "./manifest-mobile.json",
  "./assets/star_person_home.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith("deer-star-mobile-local-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isMobileAsset =
    url.pathname.endsWith("/mobile-local.html") ||
    url.pathname.endsWith("/manifest-mobile.json") ||
    url.pathname.includes("/assets/");
  const isNavigation = event.request.mode === "navigate";

  if (!isMobileAsset && !isNavigation) return;

  // 导航请求：网络优先，确保手机能拉到最新 HTML
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cached => cached || caches.match("./mobile-local.html"))
        )
    );
    return;
  }

  // 静态资源：缓存优先，减少重复下载
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
