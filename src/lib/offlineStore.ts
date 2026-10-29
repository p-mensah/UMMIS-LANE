/**
 * IndexedDB Offline Resilience Layer for Ummis Retail OS
 * Ensures critical retail operations (catalog search, barcode scanning, cash tender,
 * receipt issuance) remain functional during intermittent network disconnects.
 */

const DB_NAME = 'retailos_offline_db';
const DB_VERSION = 1;

export interface OfflineSaleItem {
  product_id: number;
  product_name?: string;
  sku?: string;
  quantity: number;
  unit_price: number;
}

export interface OfflineSalePayload {
  id?: string | number;
  items: OfflineSaleItem[];
  customer_id?: number | string | null;
  customer_name?: string;
  payment_method: string;
  shift_id?: number | null;
  total_amount?: number;
  created_at?: string;
  user_id?: number;
  user_name?: string;
  offline: boolean;
}

function openDB(): Promise<IDBDatabase> {
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
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------- PRODUCTS CACHING ----------------

export async function saveProductsToCache(products: any[]): Promise<void> {
  if (!products || !Array.isArray(products) || products.length === 0) return;
  try {
    const db = await openDB();
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
    const db = await openDB();
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
    const db = await openDB();
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
    const db = await openDB();
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
    const db = await openDB();
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
    const db = await openDB();
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
    const db = await openDB();
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    store.put({ key: 'current_store_settings', value: settings, updated_at: Date.now() });
  } catch (err) {
    console.warn('[OfflineDB] Failed to cache settings:', err);
  }
}

export async function getCachedSettings(): Promise<any | null> {
  try {
    const db = await openDB();
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

// ---------------- OFFLINE SALES QUEUE & SYNC ----------------

export async function queueOfflineSale(sale: Partial<OfflineSalePayload>): Promise<OfflineSalePayload> {
  const offlineId = `OFFLINE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const total = (sale.items || []).reduce((sum, it) => sum + (it.unit_price * it.quantity), 0);

  const payload: OfflineSalePayload = {
    id: offlineId,
    items: sale.items || [],
    customer_id: sale.customer_id || null,
    customer_name: sale.customer_name || 'Walk-in Customer',
    payment_method: sale.payment_method || 'Cash',
    shift_id: sale.shift_id || null,
    total_amount: total,
    created_at: new Date().toISOString(),
    offline: true
  };

  try {
    const db = await openDB();
    const tx = db.transaction('offline_sales', 'readwrite');
    tx.objectStore('offline_sales').put(payload);

    // Also deduct local product stock in IndexedDB cache so counter staff doesn't oversell!
    try {
      const prodTx = db.transaction('products', 'readwrite');
      const prodStore = prodTx.objectStore('products');
      for (const item of payload.items) {
        const getReq = prodStore.get(item.product_id);
        getReq.onsuccess = () => {
          const prod = getReq.result;
          if (prod) {
            prod.stock = Math.max(0, (prod.stock || 0) - item.quantity);
            prodStore.put(prod);
          }
        };
      }
    } catch (e) {
      console.warn('[OfflineDB] Could not deduct local stock cache:', e);
    }

    // Broadcast queue update event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline-sales-queue-updated'));
    }
  } catch (err) {
    console.error('[OfflineDB] Failed to queue offline sale:', err);
  }

  return payload;
}

export async function getOfflineSalesQueue(): Promise<OfflineSalePayload[]> {
  try {
    const db = await openDB();
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
    const db = await openDB();
    const tx = db.transaction('offline_sales', 'readwrite');
    tx.objectStore('offline_sales').delete(id);
    return new Promise((resolve) => {
      tx.oncomplete = () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('offline-sales-queue-updated'));
        }
        resolve();
      };
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[OfflineDB] Failed to delete synced sale:', err);
  }
}

export async function getOfflineMetrics(): Promise<{
  cachedProductsCount: number;
  cachedCustomersCount: number;
  pendingSalesCount: number;
}> {
  try {
    const db = await openDB();
    const countStore = (name: string): Promise<number> =>
      new Promise((res) => {
        const tx = db.transaction(name, 'readonly');
        const req = tx.objectStore(name).count();
        req.onsuccess = () => res(req.result || 0);
        req.onerror = () => res(0);
      });

    const [cachedProductsCount, cachedCustomersCount, pendingSalesCount] = await Promise.all([
      countStore('products'),
      countStore('customers'),
      countStore('offline_sales')
    ]);

    return { cachedProductsCount, cachedCustomersCount, pendingSalesCount };
  } catch {
    return { cachedProductsCount: 0, cachedCustomersCount: 0, pendingSalesCount: 0 };
  }
}
