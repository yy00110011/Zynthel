// 阅读文件本地存储：IndexedDB 存 blob（localStorage 5MB 上限放不下 PDF/EPUB）。
// 以书籍 id 为 key，选文件时写入，删除书时清理，阅读器打开时读取。

const DB_NAME = "zynthel-books";
const STORE = "files";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("打开本地书库失败"));
  });
  return dbPromise;
}

function runTx<T>(mode: IDBTransactionMode, operate: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = operate(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("本地书库读写失败"));
  }));
}

export async function putBookFile(bookId: string, file: Blob): Promise<void> {
  await runTx("readwrite", (store) => store.put(file, bookId));
}

export async function getBookFile(bookId: string): Promise<Blob | undefined> {
  return runTx("readonly", (store) => store.get(bookId) as IDBRequest<Blob | undefined>);
}

export async function deleteBookFile(bookId: string): Promise<void> {
  await runTx("readwrite", (store) => store.delete(bookId));
}

/** 读取本地书库全部文件（用于完整备份） */
export async function getAllBookFiles(): Promise<{ bookId: string; blob: Blob }[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const result: { bookId: string; blob: Blob }[] = [];
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) { resolve(result); return; }
      result.push({ bookId: String(cursor.key), blob: cursor.value as Blob });
      cursor.continue();
    };
    cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error("遍历本地书库失败"));
  });
}

/** 判断格式是否支持应用内阅读 */
export function supportedFileType(fileName: string): "pdf" | "epub" | "txt" | null {
  const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "epub") return "epub";
  if (ext === "txt" || ext === "md") return "txt";
  return null;
}
