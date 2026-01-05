
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Enhanced Service Worker Registration with Auto-Update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('SW registered: ', registration);
        
        // Check for updates
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New content is available; force refresh to apply
                  console.log('New version found. Refreshing...');
                  window.location.reload();
                }
              }
            };
          }
        };
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });

  // Handle redundant workers
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// اجرای رندر و حذف اسپلش اسکرین
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// حذف اسپلش اسکرین پس از لود کامل
window.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    // ایجاد وقفه کوتاه برای اطمینان از اعمال کامل استایل‌های تلویند
    setTimeout(() => {
      splash.style.opacity = '0';
      splash.style.visibility = 'hidden';
      document.body.style.overflow = 'auto'; // بازگرداندن اسکرول
    }, 800);
  }
});
