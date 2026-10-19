/** IndexedDB 的薄包裝：只有「使用者底圖」和「常用名單」兩個 store，都用 id 當 key */

const DB_NAME = 'pointing-meme-generator';
const DB_VERSION = 1;

export type StoreName = 'templates' | 'roster';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('這個瀏覽器不支援 IndexedDB'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of ['templates', 'roster'] as const) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('無法開啟 IndexedDB'));
      req.onblocked = () => reject(new Error('IndexedDB 被其他分頁佔用，請關掉其他分頁再試'));
    });
    // 開啟失敗時允許下次重試
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB 交易中止'));
  });
}

export function getAll<T>(store: StoreName): Promise<T[]> {
  return run(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
}

export async function put<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
  await run(store, 'readwrite', (s) => s.put(value));
}

export async function remove(store: StoreName, id: string): Promise<void> {
  await run(store, 'readwrite', (s) => s.delete(id));
}

/** 產生唯一 id（crypto.randomUUID 只在 https / localhost 可用，所以要有備案） */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* 非安全環境，改用下面的方式 */
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
