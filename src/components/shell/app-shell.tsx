"use client";

import { Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CommandPalette } from "@/features/command-palette/command-palette";
import { detectPlatform } from "@/features/data/schema";
import { useWorkspace } from "@/features/data/use-workspace";
import { moodFor } from "@/features/shell/mood";
import { NAV_GROUPS, orderNavItems } from "@/features/shell/nav";

const SHORTCUT_HINT = detectPlatform() === "android" ? "Ctrl K" : "⌘ K";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const data = useWorkspace();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const immediate = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", listener);
    return () => { window.clearTimeout(immediate); window.clearInterval(timer); window.removeEventListener("keydown", listener); };
  }, []);

  const mood = moodFor(now ?? new Date(2026, 8, 18, 12, 0, 0));
  const Icon = mood.Icon;
  const ordered = orderNavItems(data.settings.sidebarOrder);

  return <>
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand-mark"><Sparkles/><strong>Zynthel</strong><span>本地优先工作台</span></div>
        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.id}>
              <div className="nav-group-label">{group.label}</div>
              {ordered
                .filter((item) => item.group === group.id)
                .map(({ href, label, icon: NavIcon }) => (
                  <Link key={href} className={pathname === href || (href !== "/" && pathname.startsWith(href)) ? "active" : ""} href={href}>
                    <NavIcon/><span>{label}</span>
                  </Link>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-mood" data-mood={mood.key} title={`${mood.label} · ${mood.hint}`}>
          <span className="mood-badge" aria-hidden="true"><Icon size={16}/></span>
          <div><strong>{mood.label}</strong><small>{now ? now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" }) : ""}</small></div>
          <div className="mood-wave" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/></div>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar"><div className="date-time"><span>{now?.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" }) ?? ""}</span><strong>{now?.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }) ?? "--:--"}</strong><span className="top-avatar" aria-label="用户头像"/></div><button className="command-trigger" onClick={() => setPaletteOpen(true)}><Search/> 搜索项目、工具与命令… <kbd>{SHORTCUT_HINT}</kbd></button></header>
        <div className="page-content">{children}</div>
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  </>;
}
