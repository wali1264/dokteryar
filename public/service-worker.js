
const CACHE_NAME = 'tabib-ai-cache-v5';

// اسامی تمام کتابخانه‌های خارجی که برای اجرای برنامه حیاتی هستند
const externalUrls = [
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

const localUrls = [
  '/',
  '/index.html',
  '/index.tsx',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

const urlsToCache = [...localUrls, ...externalUrls];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching all dependencies for offline mode');
      // استفاده از addAll برای اطمینان از ذخیره شدن تمام منابع قبل از فعال‌سازی
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// استراتژی کش هوشمند: ابتدا کش، سپس شبکه (Cache-First with Network Fallback)
// این استراتژی برای اجرای سریع برنامه در حالت آفلاین حیاتی است
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response; // اگر در کش بود، بلافاصله برگردان
      }

      return fetch(event.request).then((networkResponse) => {
        // اگر منبع جدیدی بود، آن را برای استفاده‌های بعدی در کش ذخیره کن
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // اگر آفلاین بودیم و در کش هم نبود، برای درخواست‌های ناوبری صفحه اصلی را برگردان
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
