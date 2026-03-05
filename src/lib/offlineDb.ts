/**
 * IndexedDB wrapper for offline data caching.
 * Uses a simple key-value store pattern with timestamped entries.
 */

const DB_NAME = 'ahrom-offline-cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

interface CacheEntry<T = any> {
  key: string;
  data: T;
  cachedAt: number; // timestamp
  expiresAt?: number; // optional TTL
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Save data to the offline cache.
 * @param key - Unique cache key (e.g., "daily_report:2026-03-01:daily_report_exec")
 * @param data - The data to cache
 * @param ttlMs - Optional time-to-live in milliseconds
 */
export async function cacheSet<T>(key: string, data: T, ttlMs?: number): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const entry: CacheEntry<T> = {
      key,
      data,
      cachedAt: Date.now(),
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    };

    store.put(entry);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('offlineDb.cacheSet failed:', err);
  }
}

/**
 * Get data from the offline cache.
 * Returns undefined if not found or expired.
 */
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined;
        if (!entry) {
          resolve(undefined);
          return;
        }
        // Check expiry
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          // Expired - delete and return undefined
          cacheDelete(key).catch(() => {});
          resolve(undefined);
          return;
        }
        resolve(entry.data);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('offlineDb.cacheGet failed:', err);
    return undefined;
  }
}

/**
 * Delete a specific cache entry.
 */
export async function cacheDelete(key: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('offlineDb.cacheDelete failed:', err);
  }
}

/**
 * Clear all cache entries.
 */
export async function cacheClear(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('offlineDb.cacheClear failed:', err);
  }
}

/**
 * Get all keys matching a prefix.
 */
export async function cacheGetAllByPrefix<T>(prefix: string): Promise<Array<{ key: string; data: T; cachedAt: number }>> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const entries = (request.result as CacheEntry<T>[]) || [];
        const matches = entries
          .filter(e => e.key.startsWith(prefix))
          .filter(e => !e.expiresAt || Date.now() <= e.expiresAt)
          .map(e => ({ key: e.key, data: e.data, cachedAt: e.cachedAt }));
        resolve(matches);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('offlineDb.cacheGetAllByPrefix failed:', err);
    return [];
  }
}
