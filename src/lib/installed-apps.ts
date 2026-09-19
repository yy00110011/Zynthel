import { isTauriRuntime } from "./runtime";

export type InstalledApp = {
  name: string;
  packageName: string;
  icon: string | null;
};

export async function listInstalledApps(): Promise<InstalledApp[]> {
  if (!isTauriRuntime()) return [];
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const response = await invoke<{ apps?: InstalledApp[] }>("list_android_apps");
    return response.apps ?? [];
  } catch {
    return [];
  }
}
