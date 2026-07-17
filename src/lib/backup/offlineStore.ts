/**
 * Dedicated IndexedDB for imported backup data (separate DB from the SWR cache).
 *
 * v3 schema — object stores:
 *   • tables            → small tables stored as one blob { name, rows: [...] }
 *   • table_rows        → large tables stored row-by-row (keyPath 'k' = `${name}::${paddedIdx}`)
 *   • table_info        → { name, mode: 'blob' | 'rows', count } — routing metadata
 *   • media             → { path, blob, mimeType }
 *   • meta              → import meta (single 'current' key)
 *   • pending_mutations → offline write queue
 *
 * Large tables (>LARGE_TABLE_THRESHOLD rows) are chunked & batched during insert
 * so JSON.parse and IDB writes never block the main thread for long, and are
 * read back via cursor streaming so we never materialise the full table in RAM.
 */
const DB_NAME = 'ahrom-offline-backup';
const DB_VERSION = 3;
const TABLES_STORE = 'tables';
const TABLE_ROWS_STORE = 'table_rows';
const TABLE_INFO_STORE = 'table_info';
const MEDIA_STORE = 'media';
const META_STORE = 'meta';
const QUEUE_STORE = 'pending_mutations';

// Any table with more than this many rows is stored row-level.
export const LARGE_TABLE_THRESHOLD = 1000;
// Rows per IDB write transaction — keeps each tx short so UI stays responsive.
const BATCH_INSERT_SIZE = 500;
// Zero-pad row indices so lexicographic cursor order == numeric order.
const IDX_PAD = 9;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TABLES_STORE)) {
        db.createObjectStore(TABLES_STORE, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(TABLE_ROWS_STORE)) {
        db.createObjectStore(TABLE_ROWS_STORE, { keyPath: 'k' });
      }
      if (!db.objectStoreNames.contains(TABLE_INFO_STORE)) {
        db.createObjectStore(TABLE_INFO_STORE, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE, { keyPath: 'path' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

// ==================== Pending Mutations Queue ====================

export interface PendingMutation {
  id?: number;
  createdAt: number;
  table: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  url: string;
  headers: Record<string, string>;
  body?: string;
  status?: 'pending' | 'failed';
  lastError?: string;
  attempts?: number;
}

export async function enqueueMutation(m: Omit<PendingMutation, 'id' | 'createdAt' | 'status' | 'attempts'>): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  const req = tx.objectStore(QUEUE_STORE).add({
    ...m,
    createdAt: Date.now(),
    status: 'pending',
    attempts: 0,
  });
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result as number);
    req.onerror = () => rej(req.error);
  });
}

export async function listMutations(): Promise<PendingMutation[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const req = tx.objectStore(QUEUE_STORE).getAll();
    return new Promise((res) => {
      req.onsuccess = () => res((req.result as PendingMutation[]) || []);
      req.onerror = () => res([]);
    });
  } catch {
    return [];
  }
}

export async function deleteMutation(id: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  tx.objectStore(QUEUE_STORE).delete(id);
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function updateMutation(id: number, patch: Partial<PendingMutation>): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  const store = tx.objectStore(QUEUE_STORE);
  const getReq = store.get(id);
  await new Promise<void>((res) => {
    getReq.onsuccess = () => {
      const cur = getReq.result;
      if (!cur) return res();
      store.put({ ...cur, ...patch, id });
      res();
    };
    getReq.onerror = () => res();
  });
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function countPending(): Promise<number> {
  try {
    const db = await openDb();
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const req = tx.objectStore(QUEUE_STORE).count();
    return new Promise((res) => {
      req.onsuccess = () => res(req.result || 0);
      req.onerror = () => res(0);
    });
  } catch {
    return 0;
  }
}

export async function clearQueue(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  tx.objectStore(QUEUE_STORE).clear();
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

// ==================== Backup Meta ====================

export interface BackupMeta {
  importedAt: number;
  createdAt: string;
  scope: 'user' | 'full';
  totalRecords: number;
  totalMedia: number;
  tableCounts: Record<string, number>;
}

export async function saveMeta(meta: BackupMeta): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(META_STORE, 'readwrite');
  tx.objectStore(META_STORE).put({ key: 'current', ...meta });
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function getMeta(): Promise<BackupMeta | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get('current');
    return new Promise((res) => {
      req.onsuccess = () => {
        const r = req.result;
        if (!r) return res(null);
        res(r);
      };
      req.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}

// ==================== Tables (blob + row-level) ====================

export interface TableInfo {
  name: string;
  mode: 'blob' | 'rows';
  count: number;
}

function rowKey(table: string, idx: number): string {
  return `${table}::${String(idx).padStart(IDX_PAD, '0')}`;
}

function rowRange(table: string): IDBKeyRange {
  return IDBKeyRange.bound(`${table}::`, `${table}::\uffff`);
}

async function getTableInfo(name: string): Promise<TableInfo | null> {
  const db = await openDb();
  const tx = db.transaction(TABLE_INFO_STORE, 'readonly');
  const req = tx.objectStore(TABLE_INFO_STORE).get(name);
  return new Promise((res) => {
    req.onsuccess = () => res((req.result as TableInfo) || null);
    req.onerror = () => res(null);
  });
}

async function clearRowsForTable(name: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(TABLE_ROWS_STORE, 'readwrite');
  tx.objectStore(TABLE_ROWS_STORE).delete(rowRange(name));
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

/**
 * Save a table. Auto-selects storage mode:
 *   • rows.length <= LARGE_TABLE_THRESHOLD → single blob (fast path)
 *   • otherwise → row-by-row in batched transactions with yields between batches
 */
export async function putTable(name: string, rows: any[]): Promise<void> {
  const db = await openDb();
  const arr = Array.isArray(rows) ? rows : [];

  // Wipe any previous representation of this table (both modes) so mode switches cleanly.
  const wipeTx = db.transaction([TABLES_STORE, TABLE_ROWS_STORE], 'readwrite');
  wipeTx.objectStore(TABLES_STORE).delete(name);
  wipeTx.objectStore(TABLE_ROWS_STORE).delete(rowRange(name));
  await new Promise<void>((res, rej) => {
    wipeTx.oncomplete = () => res();
    wipeTx.onerror = () => rej(wipeTx.error);
  });

  if (arr.length <= LARGE_TABLE_THRESHOLD) {
    // Fast path: single blob
    const tx = db.transaction([TABLES_STORE, TABLE_INFO_STORE], 'readwrite');
    tx.objectStore(TABLES_STORE).put({ name, rows: arr });
    tx.objectStore(TABLE_INFO_STORE).put({ name, mode: 'blob', count: arr.length } as TableInfo);
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  // Row-level path: batched writes with UI yields
  for (let i = 0; i < arr.length; i += BATCH_INSERT_SIZE) {
    const slice = arr.slice(i, i + BATCH_INSERT_SIZE);
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(TABLE_ROWS_STORE, 'readwrite');
      const store = tx.objectStore(TABLE_ROWS_STORE);
      for (let j = 0; j < slice.length; j++) {
        const idx = i + j;
        store.put({ k: rowKey(name, idx), t: name, i: idx, row: slice[j] });
      }
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    // Yield to the main thread between batches
    await new Promise((r) => setTimeout(r, 0));
  }

  const infoTx = db.transaction(TABLE_INFO_STORE, 'readwrite');
  infoTx.objectStore(TABLE_INFO_STORE).put({ name, mode: 'rows', count: arr.length } as TableInfo);
  return new Promise((res, rej) => {
    infoTx.oncomplete = () => res();
    infoTx.onerror = () => rej(infoTx.error);
  });
}

/**
 * Backwards-compatible full-table reader.
 * For row-level tables this streams via cursor into an array — use `queryTable`
 * with a predicate when possible to avoid materialising everything in RAM.
 */
export async function getTable<T = any>(name: string): Promise<T[] | null> {
  try {
    const info = await getTableInfo(name);
    const db = await openDb();

    if (!info) {
      // Legacy (v2) rows may exist in TABLES_STORE without a table_info entry.
      const tx = db.transaction(TABLES_STORE, 'readonly');
      const req = tx.objectStore(TABLES_STORE).get(name);
      return new Promise((res) => {
        req.onsuccess = () => res(req.result?.rows ?? null);
        req.onerror = () => res(null);
      });
    }

    if (info.mode === 'blob') {
      const tx = db.transaction(TABLES_STORE, 'readonly');
      const req = tx.objectStore(TABLES_STORE).get(name);
      return new Promise((res) => {
        req.onsuccess = () => res(req.result?.rows ?? []);
        req.onerror = () => res(null);
      });
    }

    // rows mode: cursor stream
    return queryTable<T>(name);
  } catch {
    return null;
  }
}

/**
 * Cursor-stream a table applying an optional predicate row-by-row.
 * Only matching rows land in memory — safe for 100k+ row tables.
 */
export async function queryTable<T = any>(
  name: string,
  predicate?: (row: T) => boolean,
  options?: { earlyStopAt?: number },
): Promise<T[]> {
  const info = await getTableInfo(name);
  const db = await openDb();

  // Blob fast-path (small table)
  if (info?.mode === 'blob' || !info) {
    const tx = db.transaction(TABLES_STORE, 'readonly');
    const req = tx.objectStore(TABLES_STORE).get(name);
    const rows: T[] = await new Promise((res) => {
      req.onsuccess = () => res(req.result?.rows ?? []);
      req.onerror = () => res([]);
    });
    if (!predicate) return rows;
    return rows.filter(predicate);
  }

  // Row-level cursor stream
  return new Promise((resolve, reject) => {
    const out: T[] = [];
    const tx = db.transaction(TABLE_ROWS_STORE, 'readonly');
    const store = tx.objectStore(TABLE_ROWS_STORE);
    const req = store.openCursor(rowRange(name));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve(out);
      const row: T = cursor.value.row;
      if (!predicate || predicate(row)) {
        out.push(row);
        if (options?.earlyStopAt && out.length >= options.earlyStopAt) {
          return resolve(out);
        }
      }
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Stream table rows to a visitor without materialising large tables in memory.
 * Used by offline installers/scanners that only need to inspect each row once.
 */
export async function forEachTableRow<T = any>(
  name: string,
  visitor: (row: T, index: number) => void,
  options: { yieldEvery?: number } = {},
): Promise<number> {
  const info = await getTableInfo(name);
  const db = await openDb();
  const yieldEvery = options.yieldEvery ?? 500;

  if (info?.mode === 'blob' || !info) {
    const rows = await getTable<T>(name);
    const arr = rows || [];
    for (let i = 0; i < arr.length; i++) {
      visitor(arr[i], i);
      if (yieldEvery > 0 && i > 0 && i % yieldEvery === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    return arr.length;
  }

  return new Promise((resolve, reject) => {
    let count = 0;
    const tx = db.transaction(TABLE_ROWS_STORE, 'readonly');
    const store = tx.objectStore(TABLE_ROWS_STORE);
    const req = store.openCursor(rowRange(name));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve(count);
      visitor(cursor.value.row, count);
      count++;
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function countTable(name: string): Promise<number> {
  const info = await getTableInfo(name);
  if (info) return info.count;
  // Legacy fallback
  const rows = await getTable(name);
  return rows?.length ?? 0;
}

export async function listTables(): Promise<string[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(TABLE_INFO_STORE, 'readonly');
    const req = tx.objectStore(TABLE_INFO_STORE).getAllKeys();
    const infoKeys: string[] = await new Promise((res) => {
      req.onsuccess = () => res((req.result as string[]) || []);
      req.onerror = () => res([]);
    });
    if (infoKeys.length) return infoKeys;
    // Legacy fallback
    const tx2 = db.transaction(TABLES_STORE, 'readonly');
    const req2 = tx2.objectStore(TABLES_STORE).getAllKeys();
    return new Promise((res) => {
      req2.onsuccess = () => res((req2.result as string[]) || []);
      req2.onerror = () => res([]);
    });
  } catch {
    return [];
  }
}

// ==================== Media ====================

export async function putMedia(path: string, blob: Blob, mimeType: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(MEDIA_STORE, 'readwrite');
  tx.objectStore(MEDIA_STORE).put({ path, blob, mimeType });
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function getMedia(path: string): Promise<{ blob: Blob; mimeType: string } | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(MEDIA_STORE, 'readonly');
    const req = tx.objectStore(MEDIA_STORE).get(path);
    return new Promise((res) => {
      req.onsuccess = () => {
        const r = req.result;
        if (!r) return res(null);
        res({ blob: r.blob, mimeType: r.mimeType });
      };
      req.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}

export async function countMedia(): Promise<number> {
  try {
    const db = await openDb();
    const tx = db.transaction(MEDIA_STORE, 'readonly');
    const req = tx.objectStore(MEDIA_STORE).count();
    return new Promise((res) => {
      req.onsuccess = () => res(req.result || 0);
      req.onerror = () => res(0);
    });
  } catch {
    return 0;
  }
}

export async function clearAll(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(
    [TABLES_STORE, TABLE_ROWS_STORE, TABLE_INFO_STORE, MEDIA_STORE, META_STORE],
    'readwrite',
  );
  tx.objectStore(TABLES_STORE).clear();
  tx.objectStore(TABLE_ROWS_STORE).clear();
  tx.objectStore(TABLE_INFO_STORE).clear();
  tx.objectStore(MEDIA_STORE).clear();
  tx.objectStore(META_STORE).clear();
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
