/**
 * Ummis Retail OS - Enterprise Service Worker
 * Provides offline precaching, network-first API cache fallback, and offline continuity.
 */

const CACHE_NAME = 'retailos-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon.svg'
];

// Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching non-fatal asset miss:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Interceptor: Network-First with Cache Fallback for critical retail APIs
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and WebSocket / HMR requests
  if (event.request.method !== 'GET' || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // Critical API endpoints that must remain accessible when offline
  const isCriticalApi = url.pathname.startsWith('/api/products') || 
                        url.pathname.startsWith('/api/categories') || 
                        url.pathname.startsWith('/api/customers') || 
                        url.pathname.startsWith('/api/settings');

  if (isCriticalApi) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Network failed or device is offline: fallback to cached response
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return empty JSON fallback rather than network crash
          return new Response(JSON.stringify([]), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
          });
        })
    );
    return;
  }

  // Static Assets & Navigation: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
