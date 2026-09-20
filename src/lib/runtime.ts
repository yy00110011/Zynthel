export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
}

/**
 * 是否运行在 Windows 桌面端。
 *
 * 用于把「仅 Windows 提供」的功能（如首页三个第三方快捷入口）与 Android / macOS 区分开。
 * 判断依据是 userAgent：Windows 上的 Tauri WebView2 会带 "Windows NT"，macOS 的 WKWebView
 * 带 "Macintosh"，Android 带 "Android"。这与 `detectPlatform()`（只区分 android / desktop）互补。
 */
export function isWindowsDesktop(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Windows 桌面：WebView2 的 UA 同时含 "Windows NT" 与（通常）"Win64"。
  // 排除 Android（Android 的 UA 会含 "Android"，不会含 "Windows NT"）。
  return /windows nt/i.test(ua) && !/android/i.test(ua);
}
