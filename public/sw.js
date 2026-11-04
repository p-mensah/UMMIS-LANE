/**
 * Ummis Retail OS - Enterprise Service Worker v5
 * Advanced Offline POS Continuity, Asset Caching & Multi-Entity Background Synchronization
 * Enables continuous sales and inventory adjustments during network outages with auto-sync upon reconnection.
 */

const CACHE_NAME = 'retailos-cache-v5';
const API_CACHE_NAME = 'retailos-api-cache-v5';
const DB_NAME = 'retailos_offline_db';
const DB_VERSION = 2;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// Helper: Open IndexedDB within Service Worker context
function openSWDatabase() {
  return new Promise((resolve, reject) => {
    if (!self.indexedDB) {
      return reject(new Error('IndexedDB unavailable in Service Worker'));
    }
    const req = self.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('barcode', 'barcode', { unique: false });
        productStore.createIndex('sku', 'sku', { unique: false });
        productStore.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('customers')) {
        const customerStore = db.createObjectStore('customers', { keyPath: 'id' });
        customerStore.createIndex('phone', 'phone', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('offline_sales')) {
        const salesStore = db.createObjectStore('offline_sales', { keyPath: 'id' });
        salesStore.createIndex('created_at', 'created_at', { unique: false });
      }
      if (!db.objectStoreNames.contains('offline_adjustments')) {
        const adjStore = db.createObjectStore('offline_adjustments', { keyPath: 'id' });
        adjStore.createIndex('created_at', 'created_at', { unique: false });
        adjStore.createIndex('product_id', 'product_id', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Helper: Save offline sale in IndexedDB from Service Worker
async function saveOfflineSaleInSW(saleData) {
  try {
    const db = await openSWDatabase();
    const offlineId = `OFFLINE-SALE-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const total = (saleData.items || []).reduce((sum, it) => sum + (it.unit_price * it.quantity), 0);
    const payload = {
      id: offlineId,
      items: saleData.items || [],
      customer_id: saleData.customer_id || null,
      payment_method: saleData.payment_method || 'Cash',
      shift_id: saleData.shift_id || null,
      total_amount: total,
      created_at: saleData.created_at || new Date().toISOString(),
      offline: true,
      status: 'completed'
    };

    const tx = db.transaction(['offline_sales', 'products'], 'readwrite');
    tx.objectStore('offline_sales').put(payload);

    // Decrement local product stock in cache
    const prodStore = tx.objectStore('products');
    for (const item of payload.items) {
      const getReq = prodStore.get(item.product_id);
      getReq.onsuccess = () => {
        const prod = getReq.result;
        if (prod) {
          prod.stock_quantity = Math.max(0, (prod.stock_quantity ?? prod.stock ?? 0) - item.quantity);
          prodStore.put(prod);
        }
      };
    }

    await new Promise((resolve) => {
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });

    notifyClientsOfSyncQueueUpdate();
    return payload;
  } catch (err) {
    console.warn('[SW] Failed to store offline sale in SW:', err);
    return null;
  }
}

// Helper: Save offline inventory adjustment in IndexedDB from Service Worker
async function saveOfflineAdjustmentInSW(adjData) {
  try {
    const db = await openSWDatabase();
    const offlineId = `OFFLINE-ADJ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const payload = {
      id: offlineId,
      product_id: adjData.product_id,
      quantity_change: adjData.quantity_change,
      reason: adjData.reason || 'Offline Stock Adjustment',
      created_at: adjData.created_at || new Date().toISOString(),
      offline: true
    };

    const tx = db.transaction(['offline_adjustments', 'products'], 'readwrite');
    tx.objectStore('offline_adjustments').put(payload);

    // Immediately update local product stock
    const prodStore = tx.objectStore('products');
    const getReq = prodStore.get(adjData.product_id);
    getReq.onsuccess = () => {
      const prod = getReq.result;
      if (prod) {
        prod.stock_quantity = Math.max(0, (prod.stock_quantity ?? prod.stock ?? 0) + adjData.quantity_change);
        prodStore.put(prod);
      }
    };

    await new Promise((resolve) => {
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });

    notifyClientsOfSyncQueueUpdate();
    return payload;
  } catch (err) {
    console.warn('[SW] Failed to store offline adjustment in SW:', err);
    return null;
  }
}

// Broadcast queue update to all active browser windows
function notifyClientsOfSyncQueueUpdate() {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'OFFLINE_QUEUE_UPDATED' });
    });
  });
}

// Background Sync Executor inside Service Worker
async function syncOfflineDataInWorker() {
  try {
    const db = await openSWDatabase();
    
    // Read pending sales
    const salesTx = db.transaction('offline_sales', 'readonly');
    const salesStore = salesTx.objectStore('offline_sales');
    const sales = await new Promise((res) => {
      const req = salesStore.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });

    let salesCount = 0;
    for (const sale of sales) {
      try {
        const res = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: sale.items,
            customer_id: sale.customer_id,
            payment_method: sale.payment_method,
            shift_id: sale.shift_id,
            created_at: sale.created_at,
            offline_id: sale.id
          })
        });

        if (res.ok) {
          const delTx = db.transaction('offline_sales', 'readwrite');
          delTx.objectStore('offline_sales').delete(sale.id);
          salesCount++;
        }
      } catch (e) {
        break; // Stop if network drops again
      }
    }

    // Read pending adjustments
    if (db.objectStoreNames.contains('offline_adjustments')) {
      const adjTx = db.transaction('offline_adjustments', 'readonly');
      const adjStore = adjTx.objectStore('offline_adjustments');
      const adjs = await new Promise((res) => {
        const req = adjStore.getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      });

      let adjCount = 0;
      for (const adj of adjs) {
        try {
          const res = await fetch('/api/inventory/adjust', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_id: adj.product_id,
              quantity_change: adj.quantity_change,
              reason: adj.reason,
              created_at: adj.created_at,
              offline_id: adj.id
            })
          });

          if (res.ok) {
            const delTx = db.transaction('offline_adjustments', 'readwrite');
            delTx.objectStore('offline_adjustments').delete(adj.id);
            adjCount++;
          }
        } catch (e) {
          break;
        }
      }
    }

    notifyClientsOfSyncQueueUpdate();
  } catch (err) {
    console.warn('[SW] Sync offline data error in worker:', err);
  }
}

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

// Modern Background Sync API Listener
self.addEventListener('sync', (event) => {
  if (event.tag === 'retailos-sync-queue' || event.tag.startsWith('retailos-')) {
    event.waitUntil(syncOfflineDataInWorker());
  }
});

// Client Message Listener
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRIGGER_OFFLINE_SYNC') {
    event.waitUntil(syncOfflineDataInWorker());
  }
});

// Fetch Interceptor: Smart Multi-Tier Strategy with Offline Mutation Interception
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Skip WebSockets
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
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

  // 3. OFFLINE MUTATION INTERCEPTION: Intercept POST /api/sales and POST /api/inventory/adjust when offline
  if (event.request.method === 'POST') {
    if (url.pathname.startsWith('/api/sales') || url.pathname.startsWith('/api/inventory/adjust')) {
      event.respondWith(
        fetch(event.request.clone()).catch(async (fetchError) => {
          console.info('[SW] Intercepted offline POST mutation:', url.pathname);
          try {
            const bodyData = await event.request.clone().json();
            
            if (url.pathname.startsWith('/api/sales')) {
              const queued = await saveOfflineSaleInSW(bodyData);
              if (self.registration.sync) {
                self.registration.sync.register('retailos-sync-queue').catch(() => {});
              }
              return new Response(JSON.stringify({
                success: true,
                saleId: queued ? queued.id : `OFFLINE-${Date.now()}`,
                offline: true,
                message: 'Recorded in offline register. Will sync automatically upon reconnection.'
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'X-Offline-Intercepted': 'true' }
              });
            }

            if (url.pathname.startsWith('/api/inventory/adjust')) {
              const queued = await saveOfflineAdjustmentInSW(bodyData);
              if (self.registration.sync) {
                self.registration.sync.register('retailos-sync-queue').catch(() => {});
              }
              return new Response(JSON.stringify({
                success: true,
                offlineId: queued ? queued.id : `OFFLINE-ADJ-${Date.now()}`,
                offline: true,
                message: 'Stock adjustment recorded offline. Will sync automatically upon reconnection.'
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'X-Offline-Intercepted': 'true' }
              });
            }
          } catch (parseErr) {
            console.warn('[SW] Could not parse offline mutation body:', parseErr);
          }

          // Fallback error response if body could not be parsed
          return new Response(JSON.stringify({
            error: 'Network disconnected. Transaction could not be parsed for offline storage.'
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );
      return;
    }

    // Pass through other POST requests
    return;
  }

  // 4. Navigation requests (HTML document loads): Network-First with safe /index.html fallback
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

  // 5. Critical Retail APIs: Network-First with Cache Fallback for seamless offline POS
  const isCriticalApi = 
    url.pathname.startsWith('/api/products') || 
    url.pathname.startsWith('/api/categories') || 
    url.pathname.startsWith('/api/customers') || 
    url.pathname.startsWith('/api/settings') ||
    url.pathname.startsWith('/api/shifts/current') ||
    url.pathname.startsWith('/api/users') ||
    url.pathname.startsWith('/api/inventory/adjustments');

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

  // 6. Other /api/ requests: Pass directly through to backend
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 7. Production Bundles & Static Assets (/assets/*, images, icons, fonts): Cache-First
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
