import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultWorkspace, workspaceSchema } from "./schema";
import { createWorkspaceRepository, STORAGE_KEY, LEGACY_STORAGE_KEY } from "./repository";
import { exportWorkspace, importWorkspace } from "./transfer";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("workspace schema and defaults", () => {
  it("creates migration-ready defaults without fabricated usage", () => {
    const data = createDefaultWorkspace();
    expect(data.version).toBe(2);
    expect(data.settings.theme).toBe("default");
    expect(data.tools).toEqual([]);
    expect(data.aiModels).toEqual([]);
    expect(data.aiConversations).toEqual([]);
    expect(data.events).toEqual([]);
    expect(data.notes).toEqual([]);
    expect(data.focusSessions).toEqual([]);
    expect(data.settings.focusDuration).toBe(25);
    expect(workspaceSchema.parse(data)).toEqual(data);
  });

  it("为旧版数据补齐新字段", () => {
    const withoutNew = JSON.parse(JSON.stringify(createDefaultWorkspace()));
    delete withoutNew.ledgerTransactions;
    delete withoutNew.workouts;
    delete withoutNew.diaryEntries;
    const parsed = workspaceSchema.parse(withoutNew);
    expect(parsed.ledgerTransactions).toEqual([]);
    expect(parsed.workouts).toEqual([]);
    expect(parsed.diaryEntries).toEqual([]);
  });
});

describe("workspace repository", () => {
  let storage: MemoryStorage;

  beforeEach(() => { storage = new MemoryStorage(); });

  it("persists immutable updates and notifies subscribers", () => {
    const repository = createWorkspaceRepository(storage);
    const before = repository.get();
    let notifications = 0;
    repository.subscribe(() => { notifications += 1; });
    repository.update((current) => ({
      ...current,
      settings: { ...current.settings, reducedMotion: true },
    }));
    expect(before.settings.reducedMotion).toBe(false);
    expect(repository.get().settings.reducedMotion).toBe(true);
    expect(notifications).toBe(1);
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? "{}").settings.reducedMotion).toBe(true);
  });

  it("migrates legacy storage key to the new key on first read", () => {
    const legacy = createDefaultWorkspace();
    legacy.settings.reducedMotion = true;
    storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy));
    const repository = createWorkspaceRepository(storage);
    expect(repository.get().version).toBe(2);
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).settings.reducedMotion).toBe(true);
  });

  it("ignores corrupted legacy payload and falls back to defaults", () => {
    storage.setItem(LEGACY_STORAGE_KEY, "{not valid json");
    const repository = createWorkspaceRepository(storage);
    expect(repository.get().version).toBe(2);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("keeps corrupted payloads intact while returning safe defaults", () => {
    storage.setItem(STORAGE_KEY, "{not valid json");
    const repository = createWorkspaceRepository(storage);
    expect(repository.get().version).toBe(2);
    expect(storage.getItem(STORAGE_KEY)).toBe("{not valid json");
  });
});

describe("data transfer", () => {
  it("round-trips validated workspace JSON", () => {
    const original = createDefaultWorkspace();
    const result = importWorkspace(exportWorkspace(original));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(original);
  });

  it("rejects invalid and unsupported data", () => {
    expect(importWorkspace("not-json")).toEqual({ ok: false, error: "invalid-json" });
    expect(importWorkspace(JSON.stringify({ version: 99 }))).toEqual({ ok: false, error: "unsupported-data" });
  });
});
