import { describe, expect, it, vi } from "vitest";
import type { LaunchMethod } from "@/features/data/schema";
import { launchResource } from "./desktop-launch";

const localPath: LaunchMethod = { type: "local-path", path: "/tmp/project" };

describe("桌面启动适配器", () => {
  it("在 Tauri 环境中调用受限 Rust 命令", async () => {
    const tauriInvoke = vi.fn().mockResolvedValue({ ok: true });
    const fetchImpl = vi.fn();
    const result = await launchResource(localPath, { tauriInvoke, fetchImpl, openWindow: vi.fn() });
    expect(tauriInvoke).toHaveBeenCalledWith("launch-resource", { request: { launch: localPath } });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it("浏览器开发模式调用固定 loopback 启动器", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    const result = await launchResource(localPath, { tauriInvoke: null, fetchImpl, openWindow: vi.fn() });
    expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:47135/launch", expect.objectContaining({ method: "POST" }));
    expect(result).toEqual({ ok: true });
  });

  it("浏览器模式直接安全打开网站", async () => {
    const openWindow = vi.fn();
    const website: LaunchMethod = { type: "website", url: "https://example.com" };
    expect(await launchResource(website, { tauriInvoke: null, fetchImpl: vi.fn(), openWindow })).toEqual({ ok: true });
    expect(openWindow).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer");
  });
});
