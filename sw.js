const CACHE_NAME = "iimr-tracker-cache-v61";
const ASSETS = [
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./app_icon.jpg",
  "./mess_menu.csv"
];

// Install Event
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Interceptor for Offline Use
self.addEventListener("fetch", (e) => {
  // Let Supabase requests and Google Sheets sync requests bypass cache
  if (e.request.url.includes("supabase.co") || e.request.url.includes("google.com")) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((networkResponse) => {
        // Cache new static requests dynamically if valid
        if (networkResponse.status === 200 && e.request.method === "GET") {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback or ignore
      });
    })
  );
});

// Listener for background tasks or notification triggers
self.addEventListener("message", (e) => {
  if (e.data && e.data.action === "skipWaiting") {
    self.skipWaiting();
  }
});
