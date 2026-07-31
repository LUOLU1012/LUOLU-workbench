const CACHE_NAME = "deer-star-mobile-local-v39";

const APP_ASSETS = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./star_person_home.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // 逐个缓存，单个失败不影响其他资源
      await Promise.all(
        APP_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn("[SW] 缓存失败:", url, err.message))
        )
      );
      // 额外把当前导航页面也缓存一份
      const rootReq = new Request("./index.html");
      await cache.add(rootReq).catch(() => {});
    })
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
  const isNavigation = event.request.mode === "navigate";
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin) return;

  // 导航请求：缓存优先 + 后台静默更新
  // 这样即使网络断开（如医院 WiFi 限制），也能立即从缓存加载页面
  if (isNavigation) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match("./index.html").then(cachedResponse => {
          // 后台静默更新（不阻塞当前请求）
          const fetchPromise = fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.ok) {
                cache.put("./index.html", networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => null);

          // 有缓存就立即返回缓存，没有才等网络
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetchPromise.then(
            response => response || new Response("页面加载中，请稍后重试...", {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" }
            })
          );
        })
      )
    );
    return;
  }

  // 静态资源：缓存优先，缓存未命中时走网络
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
