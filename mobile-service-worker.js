const CACHE_NAME = "deer-star-mobile-local-v40";

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
      await Promise.all(
        APP_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn("[SW] 缓存失败:", url, err.message))
        )
      );
    })
  );
  // 立即激活，跳过等待
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          // 删除所有旧缓存，不管版本号
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log("[SW] 删除旧缓存:", key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      // 立即接管所有客户端
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === "navigate";
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin) return;

  // 导航请求：网络优先（确保拿到最新版本），失败时回退缓存
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() =>
          caches.open(CACHE_NAME).then(cache =>
            cache.match("./index.html").then(cached => cached || new Response(
              '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>加载中</title></head><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>正在加载，请稍候...</h2><p>如果长时间无响应，请检查网络后刷新页面。</p></body></html>',
              { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
            ))
          )
        )
    );
    return;
  }

  // 静态资源：缓存优先
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
