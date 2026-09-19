import { describe, expect, it, vi } from "vitest";
import { executeNodeLaunch, validateOrigin } from "./execute-node";

describe("浏览器开发启动器", () => {
  it("只接受本地 Zynthel 来源", () => {
    expect(validateOrigin("http://127.0.0.1:3000")).toBe(true);
    expect(validateOrigin("http://localhost:3000")).toBe(true);
    expect(validateOrigin("https://example.com")).toBe(false);
  });

  it("启动进程时始终禁用 shell", async () => {
    const unref = vi.fn();
    const spawnProcess = vi.fn().mockReturnValue({ unref });
    const result = await executeNodeLaunch(
      { launch: { type: "custom-command", executable: "open", args: ["/tmp"] } },
      { spawnProcess, accessPath: vi.fn().mockResolvedValue(undefined) },
    );
    expect(result).toEqual({ ok: true });
    expect(spawnProcess).toHaveBeenCalledWith("open", ["/tmp"], { detached: true, stdio: "ignore", shell: false });
    expect(unref).toHaveBeenCalled();
  });

  it("拒绝不在允许列表中的命令", async () => {
    expect(await executeNodeLaunch(
      { launch: { type: "custom-command", executable: "sh", args: ["-c", "echo unsafe"] } },
      { spawnProcess: vi.fn(), accessPath: vi.fn() },
    )).toEqual({ ok: false, error: "command-not-allowed" });
  });
});
