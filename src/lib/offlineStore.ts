/**
 * IndexedDB Offline Resilience & Sync Layer for Ummis Retail OS
 * Ensures critical retail operations (catalog search, barcode scanning, cash tender,
 * receipt issuance, and stock adjustments) remain 100% operational during network outages,
 * and automatically synchronize all offline transactions upon reconnection.
 */

const DB_NAME = 'retailos_offline_db';
const DB_VERSION = 2; // Incremented for offline_adjustments store

export interface OfflineSaleItem {
  product_id: number;
  product_name?: string;
  sku?: string;
  quantity: number;
  unit_price: number;
}

export interface OfflineSalePayload {
  id: string; // 'OFFLINE-SALE-...'
  items: OfflineSaleItem[];
  customer_id?: number | string | null;
  customer_name?: string;
  payment_method: string;
  shift_id?: number | null;
  total_amount: number;
  created_at: string;
  user_id?: number;
  user_name?: string;
  offline: boolean;
  status?: string;
}

export interface OfflineAdjustmentPayload {
  id: string; // 'OFFLINE-ADJ-...'
  product_id: number;
  product_name?: string;
  sku?: string;
  quantity_change: number;
  reason: string;
  created_at: string;
  user_id?: number;
  user_name?: string;
  offline: boolean;
}

export function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Products Catalog Store
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('barcode', 'barcode', { unique: false });
        productStore.createIndex('sku', 'sku', { unique: false });
        productStore.createIndex('name', 'name', { unique: false });
      }

      // Categories Store
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }

      // Customers Store
      if (!db.objectStoreNames.contains('customers')) {
        const customerStore = db.createObjectStore('customers', { keyPath: 'id' });
        customerStore.createIndex('phone', 'phone', { unique: false });
      }

      // Store Settings
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // Offline Sales Pending Queue
      if (!db.objectStoreNames.contains('offline_sales')) {
        const salesStore = db.createObjectStore('offline_sales', { keyPath: 'id' });
        salesStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // Offline Inventory Adjustments Pending Queue (Added in DB_VERSION 2)
      if (!db.objectStoreNames.contains('offline_adjustments')) {
        const adjStore = db.createObjectStore('offline_adjustments', { keyPath: 'id' });
        adjStore.createIndex('created_at', 'created_at', { unique: false });
        adjStore.createIndex('product_id', 'product_id', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------- PRODUCTS CACHING ----------------

export async function saveProductsToCache(products: any[]): Promise<void> {
  if (!products || !Array.isArray(products) || products.length === 0) return;
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    for (const prod of products) {
      if (prod && prod.id) {
        store.put(prod);
      }
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[OfflineDB] Failed to cache products:', err);
  }
}

export async function getCachedProducts(): Promise<any[]> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('products', 'readonly');
    const store = tx.objectStore('products');
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('[OfflineDB] Failed to load cached products:', err);
    return [];
  }
}

// ---------------- CATEGORIES CACHING ----------------

export async function saveCategoriesToCache(categories: any[]): Promise<void> {
  if (!categories || !Array.isArray(categories)) return;
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');
    for (const cat of categories) {
      if (cat && cat.id) {
        store.put(cat);
      }
    }
  } catch (err) {
    console.warn('[OfflineDB] Failed to cache categories:', err);
  }
}

export async function getCachedCategories(): Promise<any[]> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('categories', 'readonly');
    const store = tx.objectStore('categories');
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

// ---------------- CUSTOMERS CACHING ----------------

export async function saveCustomersToCache(customers: any[]): Promise<void> {
  if (!customers || !Array.isArray(customers)) return;
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('customers', 'readwrite');
    const store = tx.objectStore('customers');
    for (const cust of customers) {
      if (cust && cust.id) {
        store.put(cust);
      }
    }
  } catch (err) {
    console.warn('[OfflineDB] Failed to cache customers:', err);
  }
}

export async function getCachedCustomers(): Promise<any[]> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('customers', 'readonly');
    const store = tx.objectStore('customers');
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

// ---------------- STORE SETTINGS CACHING ----------------

export async function saveSettingsToCache(settings: any): Promise<void> {
  if (!settings) return;
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    store.put({ key: 'current_store_settings', value: settings, updated_at: Date.now() });
  } catch (err) {
    console.warn('[OfflineDB] Failed to cache settings:', err);
  }
}

export async function getCachedSettings(): Promise<any | null> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get('current_store_settings');
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result?.value || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

// ---------------- SERVICE WORKER NOTIFICATION ----------------

export function notifyServiceWorkerSync(): void {
  if (typeof navigator !== 'undefined') {
    // 1. Try modern Service Worker Background Sync API (Chromium / Android)
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready
        .then((reg: any) => {
          if (reg && reg.sync) {
            return reg.sync.register('retailos-sync-queue');
          }
        })
        .catch(() => {});
    }

    // 2. Message Service Worker controller directly
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'TRIGGER_OFFLINE_SYNC'
      });
    }
  }
}

// ---------------- OFFLINE SALES QUEUE ----------------

export async function queueOfflineSale(sale: Partial<OfflineSalePayload>): Promise<OfflineSalePayload> {
  const offlineId = `OFFLINE-SALE-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const total = (sale.items || []).reduce((sum, it) => sum + (it.unit_price * it.quantity), 0);

  const payload: OfflineSalePayload = {
    id: offlineId,
    items: sale.items || [],
    customer_id: sale.customer_id || null,
    customer_name: sale.customer_name || 'Walk-in Customer',
    payment_method: sale.payment_method || 'Cash',
    shift_id: sale.shift_id || null,
    total_amount: total,
    created_at: sale.created_at || new Date().toISOString(),
    offline: true,
    status: 'completed'
  };

  try {
    const db = await openOfflineDB();
    const tx = db.transaction(['offline_sales', 'products'], 'readwrite');
    tx.objectStore('offline_sales').put(payload);

    // Immediately decrement local product stock in IndexedDB cache so counter staff never oversells
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

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Notify listeners & service worker
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline-sales-queue-updated', { detail: payload }));
      window.dispatchEvent(new CustomEvent('offline-sync-queue-updated'));
    }
    notifyServiceWorkerSync();
  } catch (err) {
    console.error('[OfflineDB] Failed to queue offline sale:', err);
  }

  return payload;
}

export async function getOfflineSalesQueue(): Promise<OfflineSalePayload[]> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('offline_sales', 'readonly');
    const store = tx.objectStore('offline_sales');
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

export async function removeSyncedSale(id: string | number): Promise<void> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('offline_sales', 'readwrite');
    tx.objectStore('offline_sales').delete(id);
    return new Promise((resolve) => {
      tx.oncomplete = () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('offline-sales-queue-updated'));
          window.dispatchEvent(new CustomEvent('offline-sync-queue-updated'));
        }
        resolve();
      };
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[OfflineDB] Failed to delete synced sale:', err);
  }
}

// ---------------- OFFLINE INVENTORY ADJUSTMENTS QUEUE ----------------

export async function queueOfflineAdjustment(adjustment: {
  product_id: number;
  product_name?: string;
  sku?: string;
  quantity_change: number;
  reason: string;
  user_id?: number;
  user_name?: string;
  created_at?: string;
}): Promise<OfflineAdjustmentPayload> {
  const offlineId = `OFFLINE-ADJ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const payload: OfflineAdjustmentPayload = {
    id: offlineId,
    product_id: adjustment.product_id,
    product_name: adjustment.product_name || 'Product',
    sku: adjustment.sku,
    quantity_change: adjustment.quantity_change,
    reason: adjustment.reason || 'Offline Stock Adjustment',
    created_at: adjustment.created_at || new Date().toISOString(),
    user_id: adjustment.user_id,
    user_name: adjustment.user_name,
    offline: true
  };

  try {
    const db = await openOfflineDB();
    const tx = db.transaction(['offline_adjustments', 'products'], 'readwrite');
    tx.objectStore('offline_adjustments').put(payload);

    // Apply stock delta to cached product store immediately
    const prodStore = tx.objectStore('products');
    const getReq = prodStore.get(adjustment.product_id);
    getReq.onsuccess = () => {
      const prod = getReq.result;
      if (prod) {
        prod.stock_quantity = Math.max(0, (prod.stock_quantity ?? prod.stock ?? 0) + adjustment.quantity_change);
        prodStore.put(prod);
      }
    };

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline-adjustments-queue-updated', { detail: payload }));
      window.dispatchEvent(new CustomEvent('offline-sync-queue-updated'));
    }
    notifyServiceWorkerSync();
  } catch (err) {
    console.error('[OfflineDB] Failed to queue offline adjustment:', err);
  }

  return payload;
}

export async function getOfflineAdjustmentsQueue(): Promise<OfflineAdjustmentPayload[]> {
  try {
    const db = await openOfflineDB();
    if (!db.objectStoreNames.contains('offline_adjustments')) {
      return [];
    }
    const tx = db.transaction('offline_adjustments', 'readonly');
    const store = tx.objectStore('offline_adjustments');
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

export async function removeSyncedAdjustment(id: string | number): Promise<void> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('offline_adjustments', 'readwrite');
    tx.objectStore('offline_adjustments').delete(id);
    return new Promise((resolve) => {
      tx.oncomplete = () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('offline-adjustments-queue-updated'));
          window.dispatchEvent(new CustomEvent('offline-sync-queue-updated'));
        }
        resolve();
      };
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[OfflineDB] Failed to delete synced adjustment:', err);
  }
}

// ---------------- UNIFIED MULTI-ENTITY SYNC ENGINE ----------------

let isSyncingGlobally = false;

export async function syncAllOfflineData(): Promise<{
  success: boolean;
  salesSynced: number;
  adjustmentsSynced: number;
  errors: string[];
}> {
  if (isSyncingGlobally || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { success: false, salesSynced: 0, adjustmentsSynced: 0, errors: ['Sync already in progress or network offline'] };
  }

  isSyncingGlobally = true;
  let salesSynced = 0;
  let adjustmentsSynced = 0;
  const errors: string[] = [];

  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      authHeaders['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    // 1. Synchronize Pending Sales
    const salesQueue = await getOfflineSalesQueue();
    for (const sale of salesQueue) {
      try {
        const res = await fetch('/api/sales', {
          method: 'POST',
          headers: authHeaders,
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
          await removeSyncedSale(sale.id);
          salesSynced++;
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('[OfflineSync] Server returned error for sale:', sale.id, errData);
          errors.push(`Sale ${sale.id}: ${errData.error || res.statusText}`);
          // If 401 Unauthorized, abort further sync attempts until user re-authenticates
          if (res.status === 401) break;
        }
      } catch (postErr: any) {
        console.warn('[OfflineSync] Network dropped while syncing sale:', sale.id, postErr);
        errors.push(`Sale ${sale.id}: Network interrupted`);
        break; // Stop loop if network dropped again
      }
    }

    // 2. Synchronize Pending Inventory Adjustments
    const adjQueue = await getOfflineAdjustmentsQueue();
    for (const adj of adjQueue) {
      try {
        const res = await fetch('/api/inventory/adjust', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            product_id: adj.product_id,
            quantity_change: adj.quantity_change,
            reason: adj.reason,
            created_at: adj.created_at,
            offline_id: adj.id
          })
        });

        if (res.ok) {
          await removeSyncedAdjustment(adj.id);
          adjustmentsSynced++;
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('[OfflineSync] Server returned error for adjustment:', adj.id, errData);
          errors.push(`Adjustment ${adj.id}: ${errData.error || res.statusText}`);
          if (res.status === 401) break;
        }
      } catch (postErr: any) {
        console.warn('[OfflineSync] Network dropped while syncing adjustment:', adj.id, postErr);
        errors.push(`Adjustment ${adj.id}: Network interrupted`);
        break;
      }
    }

    // Dispatch completion event if any items were synchronized
    if (salesSynced > 0 || adjustmentsSynced > 0) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('offline-sync-completed', {
          detail: { salesSynced, adjustmentsSynced }
        }));
        window.dispatchEvent(new CustomEvent('offline-sync-queue-updated'));
      }
    }

    return {
      success: true,
      salesSynced,
      adjustmentsSynced,
      errors
    };
  } catch (err: any) {
    console.error('[OfflineSync] Unexpected error during syncAllOfflineData:', err);
    return { success: false, salesSynced, adjustmentsSynced, errors: [err.message || 'Unknown sync error'] };
  } finally {
    isSyncingGlobally = false;
  }
}

// ---------------- METRICS & STATUS ----------------

export async function getOfflineMetrics(): Promise<{
  cachedProductsCount: number;
  cachedCustomersCount: number;
  pendingSalesCount: number;
  pendingAdjustmentsCount: number;
  totalPendingCount: number;
}> {
  try {
    const db = await openOfflineDB();
    const countStore = (name: string): Promise<number> =>
      new Promise((res) => {
        if (!db.objectStoreNames.contains(name)) return res(0);
        const tx = db.transaction(name, 'readonly');
        const req = tx.objectStore(name).count();
        req.onsuccess = () => res(req.result || 0);
        req.onerror = () => res(0);
      });

    const [cachedProductsCount, cachedCustomersCount, pendingSalesCount, pendingAdjustmentsCount] = await Promise.all([
      countStore('products'),
      countStore('customers'),
      countStore('offline_sales'),
      countStore('offline_adjustments')
    ]);

    return {
      cachedProductsCount,
      cachedCustomersCount,
      pendingSalesCount,
      pendingAdjustmentsCount,
      totalPendingCount: pendingSalesCount + pendingAdjustmentsCount
    };
  } catch {
    return {
      cachedProductsCount: 0,
      cachedCustomersCount: 0,
      pendingSalesCount: 0,
      pendingAdjustmentsCount: 0,
      totalPendingCount: 0
    };
  }
}
