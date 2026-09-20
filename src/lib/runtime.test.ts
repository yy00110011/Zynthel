import { afterEach, describe, expect, it, vi } from "vitest";
import { isTauriRuntime, isWindowsDesktop } from "./runtime";

describe("平台判定", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("isTauriRuntime 依据 __TAURI_INTERNALS__ 判定", () => {
    expect(isTauriRuntime()).toBe(false);
    vi.stubGlobal("__TAURI_INTERNALS__", {});
    expect(isTauriRuntime()).toBe(true);
  });

  it("isWindowsDesktop 只认 Windows 桌面 UA（排除 Android）", () => {
    // Windows WebView2
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
    });
    expect(isWindowsDesktop()).toBe(true);

    // macOS WKWebView
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
    });
    expect(isWindowsDesktop()).toBe(false);

    // Android（含 "Android"，不能误判为 Windows）
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
    });
    expect(isWindowsDesktop()).toBe(false);

    // Linux
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
    });
    expect(isWindowsDesktop()).toBe(false);
  });
});
