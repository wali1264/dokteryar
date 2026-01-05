
const CACHE_NAME = 'tabib-ai-cache-v7';

const criticalAssets = [
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
      console.log('[SW] Warm starting resilient cache for medical suite...');
      // کش کردن تک‌تک برای جلوگیری از شکست کل عملیات (مقاوم‌سازی)
      return Promise.all(
        criticalAssets.map(url => 
          cache.add(url).catch(err => console.warn(`[SW] Skip non-critical or failed asset: ${url}`))
        )
      );
    })
  );
});

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

// استراتژی Cache-First با Fallback به ریشه برای ناوبری آفلاین
self.addEventListener('fetch', (event) => {
  // مدیریت ریفرش صفحه در حالت آفلاین
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
      if (response) return response;

      return fetch(event.request).then((networkResponse) => {
        // ذخیره خودکار منابع جدید (استایل‌های فونت و غیره)
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // بازگرداندن پاسخ خالی برای جلوگیری از نمایش صفحه خطای شبکه در کنسول
        if (event.request.destination === 'image') {
          return new Response(''); 
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
