"use client";

import { CalendarDays, CheckSquare, FolderKanban, Home, MoonStar, Plus, Search, Settings, Sparkles, StickyNote, Timer, Wallet, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/features/data/use-workspace";
import { openLaunch } from "@/lib/open-launch";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useWorkspace();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useMemo(() => {
    const pages = [
      { label: "首页", icon: Home, run: () => router.push("/") },
      { label: "任务", icon: CheckSquare, run: () => router.push("/tasks") },
      { label: "项目", icon: FolderKanban, run: () => router.push("/projects") },
      { label: "日历", icon: CalendarDays, run: () => router.push("/calendar") },
      { label: "笔记", icon: StickyNote, run: () => router.push("/notes") },
      { label: "专注", icon: Timer, run: () => router.push("/focus") },
      { label: "工具", icon: Wrench, run: () => router.push("/tools") },
      { label: "AI", icon: Sparkles, run: () => router.push("/ai") },
      { label: "设置", icon: Settings, run: () => router.push("/settings") },
      { label: "记账本", icon: Wallet, run: () => router.push("/ledger") },
      { label: "健身打卡", icon: Timer, run: () => router.push("/fitness") },
      { label: "日记", icon: StickyNote, run: () => router.push("/diary") },
      { label: "课程表", icon: CalendarDays, run: () => router.push("/schedule") },
      { label: "习惯打卡", icon: CheckSquare, run: () => router.push("/habits") },
      { label: "倒数日", icon: Timer, run: () => router.push("/countdown") },
      { label: "阅读清单", icon: StickyNote, run: () => router.push("/reading") },
      { label: "密码本", icon: Settings, run: () => router.push("/vault") },
    ];
    const projects = data.projects.filter((project) => project.status !== "archived").map((project) => ({ label: `打开 ${project.name}`, icon: FolderKanban, run: () => router.push(`/projects/detail?id=${encodeURIComponent(project.id)}`) }));
    const tools = data.tools.map((tool) => ({ label: `打开 ${tool.name}`, icon: Wrench, run: () => void openLaunch(tool.launch) }));
    const actions = [{ label: "添加待办", icon: Plus, run: () => router.push("/?action=todo") }, { label: "添加项目", icon: Plus, run: () => router.push("/projects?action=new") }, { label: "切换主题", icon: MoonStar, run: () => router.push("/settings#appearance") }];
    return [...pages, ...projects, ...tools, ...actions].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  }, [data, query, router]);

  useEffect(() => { if (open) requestAnimationFrame(() => inputRef.current?.focus()); }, [open]);
  if (!open) return null;
  const activeIndex = Math.min(selected, Math.max(0, commands.length - 1));
  const close = () => { setQuery(""); setSelected(0); onClose(); };
  const choose = (index: number) => { commands[index]?.run(); close(); };
  return <div className="dialog-backdrop" role="presentation" onMouseDown={close}><div className="command-palette" role="dialog" aria-modal="true" aria-label="命令面板" onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") close(); if (event.key === "ArrowDown") { event.preventDefault(); setSelected((value) => Math.min(value + 1, commands.length - 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setSelected((value) => Math.max(value - 1, 0)); } if (event.key === "Enter") choose(activeIndex); }}><div className="palette-search"><Search/><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0); }} placeholder="搜索页面、AI、项目与工具…"/></div><div className="palette-results">{commands.map((item, index) => { const Icon = item.icon; return <button className={activeIndex === index ? "selected" : ""} key={`${item.label}-${index}`} onMouseEnter={() => setSelected(index)} onClick={() => choose(index)}><Icon/><span>{item.label}</span><kbd>↵</kbd></button>; })}{!commands.length && <p>没有找到匹配的内容。</p>}</div><footer><span>↑↓ 导航</span><span>↵ 打开</span><span>esc 关闭</span></footer></div></div>;
}
