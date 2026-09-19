import { describe, expect, it } from "vitest";
import { createDefaultWorkspace, launchDetail } from "./schema";

const NOW = "2026-09-18T00:00:00.000Z";

describe("platform launch targets", () => {
  it("describes every launch method", () => {
    expect(launchDetail({ type: "website", url: "https://example.com" })).toBe("https://example.com");
    expect(launchDetail({ type: "macos-app", appName: "Finder", path: "/System/Library/CoreServices/Finder.app" })).toBe("/System/Library/CoreServices/Finder.app");
    expect(launchDetail({ type: "android-app", packageName: "com.example.app" })).toBe("com.example.app");
    expect(launchDetail({ type: "local-path", path: "/tmp/x" })).toBe("/tmp/x");
    expect(launchDetail({ type: "custom-command", executable: "codex", args: ["--version"] })).toBe("codex --version");
  });
});

describe("workspace defaults per platform", () => {
  it("ships an empty tool set for the user to populate", () => {
    const tools = createDefaultWorkspace(NOW, "android").tools;
    expect(tools).toEqual([]);
    expect(tools).not.toContainEqual(expect.objectContaining({ name: "ChatGPT" }));
    expect(tools).not.toContainEqual(expect.objectContaining({ name: "GitHub Desktop" }));
  });

  it("keeps an empty default tool set on desktop too", () => {
    const tools = createDefaultWorkspace(NOW, "desktop").tools;
    expect(tools).toEqual([]);
  });

  it("ships empty AI models by default", () => {
    const data = createDefaultWorkspace(NOW, "android");
    expect(data.aiModels).toEqual([]);
    expect(data.aiConversations).toEqual([]);
  });

  it("ships empty life-tool collections by default", () => {
    const data = createDefaultWorkspace(NOW, "android");
    expect(data.ledgerTransactions).toEqual([]);
    expect(data.workouts).toEqual([]);
    expect(data.diaryEntries).toEqual([]);
    expect(data.courses).toEqual([]);
    expect(data.habits).toEqual([]);
    expect(data.countdownEvents).toEqual([]);
    expect(data.books).toEqual([]);
    expect(data.vaultMeta).toBeNull();
    expect(data.vaultEntries).toEqual([]);
  });
});
