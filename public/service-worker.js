
const CACHE_NAME = 'tabib-ai-cache-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install SW
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate SW and clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip cross-origin (like Supabase or Google AI) to avoid CORS issues in cache
  if (url.origin !== self.location.origin) {
    // External CDNs that we want to cache (like Tailwind or Fonts)
    if (url.hostname.includes('tailwindcss.com') || url.hostname.includes('gstatic.com') || url.hostname.includes('googleapis.com')) {
      // Use standard caching for these
    } else {
      return;
    }
  }

  // Strategy for HTML (Navigation) -> Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // If offline, try to return index.html for ANY navigation request (SPA support)
          return caches.match('/') || caches.match('/index.html');
        })
    );
    return;
  }

  // Strategy for Assets (JS, CSS, Images) -> Cache First, then Network & Update Cache
  // This handles the "index-BwYzBOJd.js" issue
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Only cache valid responses
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fail silently for non-critical assets
      });
    })
  );
});
