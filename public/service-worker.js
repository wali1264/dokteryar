
const CACHE_NAME = 'tabib-ai-cache-v6';

// لیست دقیق منابع حیاتی بر اساس importmap در index.html
const urlsToCache = [
  '/',
  '/index.html',
  '/index.tsx',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@100;300;400;500;700;900&display=swap',
  'https://aistudiocdn.com/react-dom@^19.2.1/',
  'https://aistudiocdn.com/react-markdown@^10.1.0',
  'https://aistudiocdn.com/react@^19.2.1/',
  'https://aistudiocdn.com/react@^19.2.1',
  'https://aistudiocdn.com/lucide-react@^0.556.0',
  'https://aistudiocdn.com/@google/genai@^1.31.0',
  'https://aistudiocdn.com/@supabase/supabase-js@^2.39.0'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Installing resilient offline cache...');
      // استفاده از متد تک‌تک برای جلوگیری از شکست کل عملیات در صورت خطای یک URL
      const cachePromises = urlsToCache.map((url) => {
        return cache.add(url).catch((err) => {
          console.warn(`[SW] Failed to cache: ${url}`, err);
        });
      });
      return Promise.all(cachePromises);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removing old cache version:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// استراتژی Cache-First با مدیریت Navigation برای ریفرش آفلاین
self.addEventListener('fetch', (event) => {
  // مدیریت درخواست‌های ناوبری (ریفرش صفحه)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response; // بازگرداندن از کش در صورت موجود بودن
      }

      return fetch(event.request).then((networkResponse) => {
        // ذخیره داینامیک منابع جدید در کش
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // اگر آفلاین بودیم و منبع در کش نبود، خطای شبکه ندهیم (Silent fail)
        return new Response('Offline content unavailable', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
