/**
 * Ummis Retail OS - Enterprise Service Worker v4
 * Advanced Offline POS Continuity & Asset Caching Strategy
 */

const CACHE_NAME = 'retailos-cache-v4';
const API_CACHE_NAME = 'retailos-api-cache-v4';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// Pre-cache core application shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          fetch(url)
            .then((res) => {
              if (res.ok) return cache.put(url, res);
            })
            .catch((err) => {
              console.warn('[SW] Non-fatal pre-cache notice for:', url, err?.message || err);
            })
        )
      );
    })
  );
});

// Clean up stale cache versions and claim all client windows immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Interceptor: Smart Multi-Tier Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Skip non-GET requests and WebSockets
  if (event.request.method !== 'GET' || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // 2. CRITICAL DEV GUARD: Never intercept Vite internal modules, source files, or dev HMR
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/.vite/') ||
    url.pathname.includes('hot-update') ||
    url.search.includes('import') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.jsx')
  ) {
    return;
  }

  // 3. Navigation requests (HTML document loads): Network-First with safe /index.html fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const fallbackShell = await caches.match('/index.html') || await caches.match('/');
          if (fallbackShell) return fallbackShell;
          return new Response('<!doctype html><html><body><h1>Retail OS - Offline</h1><p>Working in offline register mode.</p></body></html>', {
            headers: { 'Content-Type': 'text/html' },
            status: 200
          });
        })
    );
    return;
  }

  // 4. Critical Retail APIs: Network-First with Cache Fallback for seamless offline POS
  const isCriticalApi = 
    url.pathname.startsWith('/api/products') || 
    url.pathname.startsWith('/api/categories') || 
    url.pathname.startsWith('/api/customers') || 
    url.pathname.startsWith('/api/settings') ||
    url.pathname.startsWith('/api/shifts/current') ||
    url.pathname.startsWith('/api/users');

  if (isCriticalApi) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(API_CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Network failed: Serve from API cache
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // Safe offline default fallbacks if not yet in cache
          if (url.pathname.startsWith('/api/shifts/current')) {
            return new Response(JSON.stringify({
              id: 1,
              status: 'open',
              starting_cash: 0,
              user_name: 'Cashier (Offline)',
              offline: true
            }), {
              headers: { 'Content-Type': 'application/json', 'X-Offline-Fallback': 'true' },
              status: 200
            });
          }

          if (url.pathname.startsWith('/api/settings')) {
            return new Response(JSON.stringify({
              store_name: 'Ummis Lane Enterprise',
              currency_code: 'GHS',
              currency_symbol: 'GH₵',
              tax_rate: 0,
              offline: true
            }), {
              headers: { 'Content-Type': 'application/json', 'X-Offline-Fallback': 'true' },
              status: 200
            });
          }

          return new Response(JSON.stringify([]), {
            headers: { 'Content-Type': 'application/json', 'X-Offline-Fallback': 'true' },
            status: 200
          });
        })
    );
    return;
  }

  // 5. Other /api/ requests: Pass directly through to backend
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 6. Production Bundles & Static Assets (/assets/*, images, icons, fonts): Cache-First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return new Response('Not found', { status: 404 });
        });
    })
  );
});
