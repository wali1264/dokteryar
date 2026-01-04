
const CACHE_NAME = 'tabib-ai-cache-v4';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install SW - Pre-cache critical Shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate SW - Clean OLD caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch Strategy: AGGRESSIVE CACHE-FIRST for Local Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Logic for Local Assets (Same Origin)
  if (url.origin === self.location.origin) {
    // Strategy for HTML (Navigation) -> Cache First then Network
    if (event.request.mode === 'navigate') {
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
            return networkResponse;
          });
          return cachedResponse || fetchPromise;
        }).catch(() => caches.match('/') || caches.match('/index.html'))
      );
      return;
    }

    // Strategy for Assets (JS, CSS, Images) -> STALE-WHILE-REVALIDATE
    // Load from cache INSTANTLY, update in background.
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
          return response || fetchPromise;
        });
      })
    );
  } else {
    // EXTERNAL RESOURCES (Google Fonts, Tailwind CDN, etc.)
    // Only cache known reliable CDNs to avoid CORS errors
    if (
      url.hostname.includes('tailwindcss.com') || 
      url.hostname.includes('gstatic.com') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('aistudiocdn.com')
    ) {
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || fetch(event.request).then((networkResponse) => {
            return caches.open(CACHE_NAME).then((cache) => {
              if (networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            });
          });
        })
      );
    }
  }
});
