import { isTauriRuntime } from "./runtime";

export type InstalledApp = {
  name: string;
  packageName: string;
  icon: string | null;
};

export type InstalledAppsResult =
  | { status: "ok"; apps: InstalledApp[] }
  | { status: "error"; message: string };

export async function listInstalledApps(): Promise<InstalledAppsResult> {
  if (!isTauriRuntime()) return { status: "ok", apps: [] };
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
