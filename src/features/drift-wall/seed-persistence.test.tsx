import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const NOW = "2026-01-01T00:00:00.000Z";

const savedItem = {
  id: "w1",
  imageData: "data:image/webp;base64,AAAA",
  x: 0.5,
  y: 0.5,
  size: 96,
  driftSeed: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("浮光墙播种不得覆盖已保存数据", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.doUnmock("@/features/data/use-workspace");
  });

  it("hydration 快照还是空工作区时，已保存的浮光墙项必须原样保留", async () => {
    const { workspaceRepository } = await import("@/features/data/repository");
    const { createDefaultWorkspace } = await import("@/features/data/schema");
    workspaceRepository.set({ ...createDefaultWorkspace(), driftWallItems: [savedItem] });
    expect(workspaceRepository.get().driftWallItems).toHaveLength(1);

    // 模拟 hydration：useWorkspace 仍返回 serverSnapshot（一份空的默认工作区）
    vi.doMock("@/features/data/use-workspace", () => ({
      useWorkspace: () => createDefaultWorkspace(),
    }));
    const { DriftWallPage } = await import("./drift-wall-page");
    render(<DriftWallPage />);

    // 播种必须基于 repository 的真实值判断，不能把渲染快照写回
    const restored = workspaceRepository.get();
    expect(restored.driftWallItems).toHaveLength(1);
    expect(restored.driftWallItems[0]).toEqual(savedItem);
  });

  it("确实一条数据都没有时才播种 8 个占位", async () => {
    const { workspaceRepository } = await import("@/features/data/repository");
    const { createDefaultWorkspace } = await import("@/features/data/schema");
    expect(workspaceRepository.get().driftWallItems).toHaveLength(0);

    vi.doMock("@/features/data/use-workspace", () => ({
      useWorkspace: () => createDefaultWorkspace(),
    }));
    const { DriftWallPage } = await import("./drift-wall-page");
    render(<DriftWallPage />);

    expect(workspaceRepository.get().driftWallItems.length).toBeGreaterThan(0);
  });
});
