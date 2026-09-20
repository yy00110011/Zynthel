// 浮光墙图片存储：IndexedDB 存处理后的图片 Blob（localStorage 放不下大量图片）。
// 以 item id 为 key，添加图片时写入，移除项时清理，完整备份时遍历读取。
// 与 book-storage 相同的稳健性：request 成功不算成功，只有 transaction.oncomplete 才算提交完成。

const DB_NAME = "zynthel-drift-wall";
const STORE = "images";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function normalizeError(err: unknown, fallback: string): Error {
  const name = err instanceof DOMException ? err.name : undefined;
  if (name === "QuotaExceededError") return new Error("存储空间不足（QuotaExceededError）");
  if (name === "InvalidStateError" || name === "TransactionInactiveError") return new Error("存储事务失败");
  if (err instanceof Error) return err;
  return new Error(fallback);
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(normalizeError(request.error, "打开浮光墙图库失败"));
    } catch (err) {
      reject(normalizeError(err, "本地存储不可用"));
    }
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function runTx<T>(mode: IDBTransactionMode, operate: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let result: T | undefined;
    tx.oncomplete = () => resolve(result as T);
    tx.onerror = () => reject(normalizeError(tx.error, "浮光墙图库事务失败"));
    tx.onabort = () => reject(normalizeError(tx.error, "浮光墙图库事务失败"));
    const request = operate(tx.objectStore(STORE));
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(normalizeError(request.error, "浮光墙图库读写失败"));
  }));
}

export async function putDriftWallImage(itemId: string, blob: Blob): Promise<void> {
  await runTx("readwrite", (store) => store.put(blob, itemId));
}

export async function getDriftWallImage(itemId: string): Promise<Blob | undefined> {
  return runTx("readonly", (store) => store.get(itemId) as IDBRequest<Blob | undefined>);
}

export async function deleteDriftWallImage(itemId: string): Promise<void> {
  await runTx("readwrite", (store) => store.delete(itemId));
}

/** 读取浮光墙全部图片（用于完整备份） */
export async function getAllDriftWallImages(): Promise<{ itemId: string; blob: Blob }[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const result: { itemId: string; blob: Blob }[] = [];
    let cursorDone = false;
    tx.oncomplete = () => { if (cursorDone) resolve(result); };
    tx.onerror = () => reject(normalizeError(tx.error, "遍历浮光墙图库失败"));
    tx.onabort = () => reject(normalizeError(tx.error, "遍历浮光墙图库失败"));
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) { cursorDone = true; return; }
      result.push({ itemId: String(cursor.key), blob: cursor.value as Blob });
      cursor.continue();
    };
    cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error("遍历浮光墙图库失败"));
  });
}

/** 写入多项浮光墙图片；任一失败则回滚到写入前状态并抛错。 */
export async function putDriftWallImages(files: { itemId: string; blob: Blob }[]): Promise<void> {
  const previous = new Map<string, Blob | undefined>();
  const written: string[] = [];
  try {
    for (const f of files) {
      if (!previous.has(f.itemId)) previous.set(f.itemId, await getDriftWallImage(f.itemId));
      await putDriftWallImage(f.itemId, f.blob);
      written.push(f.itemId);
    }
  } catch (err) {
    for (const id of written) {
      const old = previous.get(id);
      try {
        if (old !== undefined) await putDriftWallImage(id, old);
        else await deleteDriftWallImage(id);
      } catch { /* 尽力回滚 */ }
    }
    throw normalizeError(err, "写入浮光墙图库失败");
  }
}
