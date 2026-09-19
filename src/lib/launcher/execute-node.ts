import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { LauncherBody } from "./validation";

type SpawnOptions = { detached: true; stdio: "ignore"; shell: false };
type SpawnedProcess = { unref(): void };
type NodeLaunchDependencies = {
  spawnProcess: (executable: string, args: string[], options: SpawnOptions) => SpawnedProcess;
  accessPath: (path: string) => Promise<unknown>;
};

const ALLOWED_ORIGINS = new Set(["http://127.0.0.1:3000", "http://localhost:3000"]);
const ALLOWED_EXECUTABLES = new Set(["open", "codex"]);

export function validateOrigin(origin: string | null): boolean {
  return origin !== null && ALLOWED_ORIGINS.has(origin);
}

const defaultDependencies: NodeLaunchDependencies = {
  spawnProcess: (executable, args, options) => spawn(executable, args, options),
  accessPath: access,
};

export async function executeNodeLaunch(
  { launch }: LauncherBody,
  dependencies: NodeLaunchDependencies = defaultDependencies,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let executable = "open";
  let args: string[];
  if (launch.type === "macos-app") {
    try { await dependencies.accessPath(launch.path); } catch { return { ok: false, error: "missing-app" }; }
    args = ["-a", launch.appName];
  } else if (launch.type === "local-path") {
    try { await dependencies.accessPath(launch.path); } catch { return { ok: false, error: "invalid-path" }; }
    args = [launch.path];
  } else {
    if (!ALLOWED_EXECUTABLES.has(launch.executable)) return { ok: false, error: "command-not-allowed" };
    executable = launch.executable;
    args = launch.args;
  }
  try {
    const child = dependencies.spawnProcess(executable, args, { detached: true, stdio: "ignore", shell: false });
    child.unref();
    return { ok: true };
  } catch {
    return { ok: false, error: "launch-failed" };
  }
}
