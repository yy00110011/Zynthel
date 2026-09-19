import { createDefaultWorkspace, type WorkspaceData, workspaceSchema } from "./schema";

export const STORAGE_KEY = "zynthel.workspace.open";
// Legacy storage key retained solely for local data migration.
// 旧品牌名（SOLARIS）更名后，首次启动时把旧 key 下的数据迁移到新 key，避免用户数据丢失。
export const LEGACY_STORAGE_KEY = "solaris.workspace.open";

export interface WorkspaceRepository {
  get(): WorkspaceData;
  set(next: WorkspaceData): void;
  update(recipe: (current: WorkspaceData) => WorkspaceData): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

export function createWorkspaceRepository(storage?: Storage): WorkspaceRepository {
  const target = storage ?? (typeof window === "undefined" ? undefined : window.localStorage);
  const listeners = new Set<() => void>();
  let cache: WorkspaceData | null = null;

  const read = (): WorkspaceData => {
    if (cache) return cache;
    // 数据迁移：新 key 不存在但旧 key 存在时，读取旧数据 → 校验 → 写入新 key。
    if (target && !target.getItem(STORAGE_KEY)) {
      const legacy = target.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        try {
          const parsed = workspaceSchema.safeParse(JSON.parse(legacy));
          if (parsed.success) {
            target.setItem(STORAGE_KEY, JSON.stringify(parsed.data));
          }
        } catch {
          // 旧数据非法则忽略，走默认工作区。
        }
      }
    }
    const raw = target?.getItem(STORAGE_KEY);
    if (!raw) return (cache = createDefaultWorkspace());
    try {
      const result = workspaceSchema.safeParse(JSON.parse(raw));
      return (cache = result.success ? result.data : createDefaultWorkspace());
    } catch {
      return (cache = createDefaultWorkspace());
    }
  };

  const set = (next: WorkspaceData) => {
    const validated = workspaceSchema.parse(next);
    const snapshot = structuredClone(validated);
    // 先写盘，成功后再更新内存 cache 并通知监听器。
    // 若 setItem 抛错，则 cache 与 listeners 都不更新，错误向上传播，避免「假保存」。
    target?.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    cache = snapshot;
    listeners.forEach((listener) => listener());
  };

  return {
    get: read,
    set,
    update: (recipe) => set(recipe(structuredClone(read()))),
    reset: () => set(createDefaultWorkspace()),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const workspaceRepository = createWorkspaceRepository();
