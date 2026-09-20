import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ===== 最小 IndexedDB 模拟（jsdom 不带 indexedDB） =====
   只实现 drift-wall-storage.ts 用到的能力：open / createObjectStore /
   transaction / put / get / delete / openCursor，并保留「request 成功不算成功，
   只有 transaction.oncomplete 才算提交」这一语义——这正是本模块的正确性核心。 */

class FakeRequest {
  result: unknown = undefined;
  error: DOMException | null = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

class FakeCursorRequest {
  result: { key: string; value: unknown; continue: () => void } | null = null;
  error: DOMException | null = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

class FakeObjectStore {
  constructor(
    private entries: Map<string, unknown>,
    private failPut: (key: string) => DOMException | null,
    private abortTx: (error: DOMException) => void,
  ) {}

  private request<T>(compute: () => T): FakeRequest {
    const req = new FakeRequest();
    queueMicrotask(() => {
      try {
        req.result = compute();
        req.onsuccess?.();
      } catch (err) {
        const failure = err as DOMException;
        req.error = failure;
        this.abortTx(failure);
        req.onerror?.();
      }
    });
    return req;
  }

  put(value: unknown, key: string) {
    return this.request(() => {
      const failure = this.failPut(String(key));
      if (failure) throw failure;
      this.entries.set(String(key), value);
      return key;
    });
  }

  get(key: string) {
    return this.request(() => this.entries.get(String(key)));
  }

  delete(key: string) {
    return this.request(() => { this.entries.delete(String(key)); return undefined; });
  }

  openCursor() {
    const req = new FakeCursorRequest();
    const snapshot = [...this.entries.entries()].map(([key, value]) => ({ key, value }));
    let index = -1;
    const step = () => {
      index += 1;
      if (index >= snapshot.length) {
        req.result = null;
        req.onsuccess?.();
        return;
      }
      const current = snapshot[index];
      req.result = { key: current.key, value: current.value, continue: () => queueMicrotask(step) };
      req.onsuccess?.();
    };
    queueMicrotask(step);
    return req;
  }
}

class FakeTransaction {
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  error: DOMException | null = null;
  private aborted = false;
  constructor(private store: FakeObjectStore) {
    // 所有 request 的回调都在微任务里跑完，transaction 完成稍后于本轮微任务
    setTimeout(() => {
      if (this.aborted) this.onabort?.();
      else this.oncomplete?.();
    }, 0);
  }
  objectStore() { return this.store; }
  markAborted(error: DOMException) {
    this.aborted = true;
    this.error = error;
  }
}

class FakeDatabase {
  objectStoreNames = { contains: (name: string) => this.names.has(name) };
  private names = new Set<string>();
  constructor(private entries: Map<string, unknown>, private hooks: Hooks) {}
  createObjectStore(name: string) { this.names.add(name); }
  transaction() {
    const holder: { tx: FakeTransaction | null } = { tx: null };
    const store = new FakeObjectStore(
      this.entries,
      (key) => this.hooks.failPut?.(key) ?? null,
      (error) => holder.tx?.markAborted(error),
    );
    holder.tx = new FakeTransaction(store);
    return holder.tx;
  }
}

type Hooks = { failPut?: (key: string) => DOMException | null };

const entries = new Map<string, unknown>();
let hooks: Hooks = {};

function installIndexedDb() {
  const openRequest = {
    result: undefined as unknown,
    error: null as DOMException | null,
    onupgradeneeded: null as (() => void) | null,
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
  };
  const indexedDb = {
    open() {
      queueMicrotask(() => {
        const db = new FakeDatabase(entries, hooks);
        openRequest.result = db;
        openRequest.onupgradeneeded?.();
        openRequest.onsuccess?.();
      });
      return openRequest;
    },
  };
  Object.defineProperty(globalThis, "indexedDB", { value: indexedDb, configurable: true, writable: true });
  return openRequest;
}

async function freshModule() {
  vi.resetModules();
  return import("./drift-wall-storage");
}

function quotaError(): DOMException {
  return new DOMException("quota", "QuotaExceededError");
}

beforeEach(() => {
  entries.clear();
  hooks = {};
  installIndexedDb();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "indexedDB");
});

describe("浮光墙图库 IndexedDB", () => {
  it("写入后可原样读回", async () => {
    const { putDriftWallImage, getDriftWallImage } = await freshModule();
    const blob = new Blob(["a"], { type: "image/png" });
    await putDriftWallImage("w1", blob);
    expect(await getDriftWallImage("w1")).toBe(blob);
  });

  it("删除后读不到，且不抛错", async () => {
    const { putDriftWallImage, getDriftWallImage, deleteDriftWallImage } = await freshModule();
    await putDriftWallImage("w1", new Blob(["a"]));
    await deleteDriftWallImage("w1");
    expect(await getDriftWallImage("w1")).toBeUndefined();
  });

  it("getAllDriftWallImages 返回全部图片，键为 itemId", async () => {
    const { putDriftWallImage, getAllDriftWallImages } = await freshModule();
    await putDriftWallImage("w1", new Blob(["a"]));
    await putDriftWallImage("w2", new Blob(["b"]));
    const all = await getAllDriftWallImages();
    expect(all.map((f) => f.itemId).sort()).toEqual(["w1", "w2"]);
    expect(await all[0].blob.text()).toBe("a");
  });

  it("批量写入全部成功", async () => {
    const { putDriftWallImages, getAllDriftWallImages } = await freshModule();
    await putDriftWallImages([
      { itemId: "w1", blob: new Blob(["a"]) },
      { itemId: "w2", blob: new Blob(["b"]) },
    ]);
    expect((await getAllDriftWallImages()).map((f) => f.itemId).sort()).toEqual(["w1", "w2"]);
  });

  it("批量写入中途失败时回滚：新增的删除、被覆盖的还原", async () => {
    const { putDriftWallImages, putDriftWallImage, getDriftWallImage } = await freshModule();
    const old = new Blob(["old-w1"]);
    await putDriftWallImage("w1", old);

    hooks.failPut = (key) => (key === "w2" ? quotaError() : null);
    await expect(
      putDriftWallImages([
        { itemId: "w1", blob: new Blob(["new-w1"]) },
        { itemId: "w2", blob: new Blob(["new-w2"]) },
      ]),
    ).rejects.toThrow(/存储空间不足|QuotaExceeded/);

    // w1 被覆盖过 → 必须还原成旧 blob
    expect(await getDriftWallImage("w1")).toBe(old);
    // w2 是新增 → 必须不存在
    expect(await getDriftWallImage("w2")).toBeUndefined();
  });

  it("批量写入失败时，配额错误会被翻译成中文提示", async () => {
    const { putDriftWallImages } = await freshModule();
    hooks.failPut = () => quotaError();
    await expect(putDriftWallImages([{ itemId: "w1", blob: new Blob(["a"]) }])).rejects.toThrow("存储空间不足");
  });

  it("IndexedDB 不可用时抛出可读错误，而不是静默成功", async () => {
    Reflect.deleteProperty(globalThis, "indexedDB");
    const { putDriftWallImage } = await freshModule();
    await expect(putDriftWallImage("w1", new Blob(["a"]))).rejects.toThrow();
  });
});

describe("完整备份 · 浮光墙导出 → 清空 → 导入", () => {
  it("清空后再导入，数据与原状态逐字节一致", async () => {
    const storage = await freshModule();
    const { buildFullBackup, parseFullBackup } = await import("../features/data/transfer");
    const { createDefaultWorkspace } = await import("../features/data/schema");

    const now = "2026-01-01T00:00:00.000Z";
    const items = [
      { id: "w1", imageData: "data:image/png;base64,AAAA", x: 0.2, y: 0.3, size: 96, driftSeed: 1, createdAt: now, updatedAt: now },
      { id: "w2", imageData: "data:image/webp;base64,BBBB", x: 0.7, y: 0.8, size: 120, driftSeed: 2, createdAt: now, updatedAt: now },
      { id: "w3", imageData: null, x: 0.5, y: 0.5, size: 80, driftSeed: 3, createdAt: now, updatedAt: now },
    ];
    const data = { ...createDefaultWorkspace(), driftWallItems: items };

    // 1. 初始状态：两张有图片的项写入图库（w3 是空白占位，没有图片）
    //    内容必须是真实图片（ZIP 恢复会做内容真实性校验，只认文件头）
    const png1 = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01])], { type: "image/png" });
    const webp1 = new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x02])], { type: "image/webp" });
    await storage.putDriftWallImage("w1", png1);
    await storage.putDriftWallImage("w2", webp1);
    const before = await storage.getAllDriftWallImages();

    // 2. 导出
    const zip = await buildFullBackup(data, [], await storage.getAllDriftWallImages());

    // 3. 清空
    await storage.deleteDriftWallImage("w1");
    await storage.deleteDriftWallImage("w2");
    expect(await storage.getAllDriftWallImages()).toEqual([]);

    // 4. 导入
    const parsed = await parseFullBackup(zip);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await storage.putDriftWallImages(parsed.driftWallFiles);

    // 5. 一致性
    expect(parsed.data.driftWallItems).toEqual(items);
    const after = await storage.getAllDriftWallImages();
    const sortById = (list: { itemId: string }[]) => [...list].sort((a, b) => a.itemId.localeCompare(b.itemId));
    expect(sortById(after).map((f) => f.itemId)).toEqual(sortById(before).map((f) => f.itemId));
    for (const file of before) {
      const restored = after.find((f) => f.itemId === file.itemId)!;
      expect(await restored.blob.text()).toBe(await file.blob.text());
    }
  });
});
