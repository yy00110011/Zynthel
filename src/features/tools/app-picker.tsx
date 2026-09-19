"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Smartphone, X } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { addTool } from "./model";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";
import { listInstalledApps, type InstalledApp } from "@/lib/installed-apps";

export function AppPicker({ onClose }: { onClose: () => void }) {
  const data = useWorkspace();
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    void listInstalledApps().then((result) => {
      if (!active) return;
      setApps(result);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const owned = useMemo(
    () => new Set(data.tools.map((tool) => (tool.launch.type === "android-app" ? tool.launch.packageName : ""))),
    [data.tools],
  );

  const visible = apps.filter((app) => `${app.name} ${app.packageName}`.toLowerCase().includes(query.trim().toLowerCase()));

  const pick = (app: InstalledApp) => {
    workspaceRepository.set(addTool(data, {
      name: app.name,
      icon: "smartphone",
      launch: {
        type: "android-app",
        packageName: app.packageName,
        fallbackUrl: `https://play.google.com/store/apps/details?id=${app.packageName}`,
      },
    }));
    onClose();
  };

  return <div className="dialog-backdrop" onMouseDown={onClose}>
    <GlassPanel className="confirm-dialog app-picker" onMouseDown={(event) => event.stopPropagation()}>
      <header className="app-picker-head">
        <h2>本机应用</h2>
        <button aria-label="关闭" onClick={onClose}><X /></button>
      </header>
      <label className="app-picker-search"><Search /><input
        autoFocus
        aria-label="搜索已安装应用"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索应用…"
      /></label>
      <div className="app-picker-list">
        {loading && <p className="app-picker-empty"><Loader2 className="spin" /> 正在读取已安装应用…</p>}
        {!loading && !apps.length && <p className="app-picker-empty">没有读到应用列表。请在工具页用「Android 应用」类型手动填写包名。</p>}
        {!loading && apps.length > 0 && !visible.length && <p className="app-picker-empty">没有匹配「{query}」的应用。</p>}
        {visible.map((app) => <button
          key={app.packageName}
          className="app-picker-item"
          disabled={owned.has(app.packageName)}
          onClick={() => pick(app)}
        >
          <span className="app-picker-icon">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {app.icon ? <img src={`data:image/png;base64,${app.icon}`} alt="" /> : <Smartphone size={20} />}
          </span>
          <span className="app-picker-meta"><strong>{app.name}</strong><small>{app.packageName}</small></span>
          <em>{owned.has(app.packageName) ? "已添加" : "添加"}</em>
        </button>)}
      </div>
    </GlassPanel>
  </div>;
}
