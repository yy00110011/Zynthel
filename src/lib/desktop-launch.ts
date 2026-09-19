import type { LaunchMethod } from "@/features/data/schema";
import { isTauriRuntime } from "./runtime";

export type LauncherResult = { ok: boolean; error?: string };
type TauriInvoke = (command: string, args: Record<string, unknown>) => Promise<LauncherResult>;

type LaunchDependencies = {
  tauriInvoke: TauriInvoke | null;
  fetchImpl: typeof fetch;
  openWindow: (url?: string | URL, target?: string, features?: string) => Window | null;
};

async function defaultTauriInvoke(command: string, args: Record<string, unknown>) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LauncherResult>(command, args);
}

function defaultDependencies(): LaunchDependencies {
  return {
    tauriInvoke: isTauriRuntime() ? defaultTauriInvoke : null,
    fetchImpl: fetch,
    openWindow: window.open.bind(window),
  };
}

export async function launchResource(
  launch: LaunchMethod,
  dependencies?: LaunchDependencies,
): Promise<LauncherResult> {
  const deps = dependencies ?? defaultDependencies();
  if (deps.tauriInvoke) {
    return deps.tauriInvoke("launch_resource", { request: { launch } });
  }
  if (launch.type === "website") {
    deps.openWindow(launch.url, "_blank", "noopener,noreferrer");
    return { ok: true };
  }
  const response = await deps.fetchImpl("http://127.0.0.1:47135/launch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ launch }),
  });
  return response.json() as Promise<LauncherResult>;
}
