import { isTauriRuntime } from "./runtime";
import { detectPlatform } from "@/features/data/schema";

export type InstalledApp = {
  name: string;
  packageName: string;
  icon: string | null;
};

export type InstalledAppsResult =
  | { status: "ok"; apps: InstalledApp[] }
  | { status: "error"; message: string };

/** 本机桌面客户端的探测结果（只读遍历，见 Rust 侧 `find-local-app`）。 */
export type LocalAppMatch = { id: string; name: string; path: string };

/**
 * 在本机已安装的桌面应用里按关键词查找客户端。
 * 仅桌面端有意义：Android 没有桌面客户端概念，浏览器环境没有 IPC，均直接返回 null。
 * 返回的 path 只能作为 `local-app` 启动：Rust 侧在扫描命中时把路径登记进「已确认应用表」，
 * 只有表内路径允许走本机应用通道；普通 `local-path` 通道会拒绝一切可执行/可跳转文件。
 */
export async function findLocalApp(keywords: string[]): Promise<LocalAppMatch | null> {
  if (!keywords.length) return null;
  if (!isTauriRuntime()) return null;
  if (detectPlatform() === "android") return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const matches = await invoke<LocalAppMatch[]>("find_local_app", { keywords });
    return matches.length ? matches[0] : null;
  } catch {
    // 探测失败不阻断入口：静默回落到网页打开。
    return null;
  }
}

export async function listInstalledApps(): Promise<InstalledAppsResult> {
  if (!isTauriRuntime()) return { status: "ok", apps: [] };
  // 仅 Android 读取本机已安装应用；Windows / 桌面端无 Android 应用，直接返回空列表，
  // 避免向不存在的 Android 命令发起被拒绝的 IPC 调用。
  if (detectPlatform() !== "android") return { status: "ok", apps: [] };
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    // list_android_apps 现在返回 Result<Vec<InstalledApp>, LaunchError>：
    // 成功时是裸数组，失败时 invoke 会 reject。
    const apps = await invoke<InstalledApp[]>("list_android_apps");
    return { status: "ok", apps };
  } catch {
    return { status: "error", message: "获取应用列表失败，请重试。" };
  }
}
