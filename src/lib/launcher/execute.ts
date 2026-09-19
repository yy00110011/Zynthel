import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { LauncherBody } from "./validation";

const ALLOWED_EXECUTABLES = new Set(["open", "codex"]);

export async function executeLaunch({ launch }: LauncherBody): Promise<{ ok: true } | { ok: false; error: string }> {
  let executable = "open"; let args: string[];
  if (launch.type === "macos-app") { try { await access(launch.path); } catch { return { ok:false,error:"missing-app" }; } args=["-a",launch.appName]; }
  else if (launch.type === "local-path") { try { await access(launch.path); } catch { return { ok:false,error:"invalid-path" }; } args=[launch.path]; }
  else { if(!ALLOWED_EXECUTABLES.has(launch.executable)) return {ok:false,error:"command-not-allowed"}; executable=launch.executable;args=launch.args; }
  try { const child=spawn(/* turbopackIgnore: true */ executable,args,{detached:true,stdio:"ignore",shell:false});child.unref();return {ok:true}; } catch { return {ok:false,error:"launch-failed"}; }
}
