// 侧边栏导航：固定 18 项，分「核心办公区」(10) 和「生活工具区」(8) 两组。
// 禁止用户增删入口、禁止第三方快捷入口；仅允许调整显示顺序。

import type { LucideIcon } from "lucide-react";
import {
  Home, CheckSquare, FolderKanban, CalendarDays, StickyNote,
  Timer, Wrench, Sparkles, Settings, Orbit,
  Wallet, Dumbbell, NotebookPen, BookOpenCheck, Repeat,
  Hourglass, Library, KeyRound,
} from "lucide-react";

export type NavGroup = "core" | "life";

export interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
}

export interface NavGroupMeta {
  id: NavGroup;
  label: string;
}

// 固定顺序（默认顺序）。sidebarOrder 持久化仅用于调整显示顺序。
export const NAV_ITEMS: NavItem[] = [
  // 核心办公区（10）
  { id: "home", href: "/", label: "首页", icon: Home, group: "core" },
  { id: "drift-wall", href: "/drift-wall", label: "浮光墙", icon: Orbit, group: "core" },
  { id: "tasks", href: "/tasks", label: "任务", icon: CheckSquare, group: "core" },
  { id: "projects", href: "/projects", label: "项目", icon: FolderKanban, group: "core" },
  { id: "calendar", href: "/calendar", label: "日历", icon: CalendarDays, group: "core" },
  { id: "notes", href: "/notes", label: "笔记", icon: StickyNote, group: "core" },
  { id: "focus", href: "/focus", label: "专注", icon: Timer, group: "core" },
  { id: "tools", href: "/tools", label: "工具", icon: Wrench, group: "core" },
  { id: "ai", href: "/ai", label: "AI", icon: Sparkles, group: "core" },
  { id: "settings", href: "/settings", label: "设置", icon: Settings, group: "core" },
  // 生活工具区（8）
  { id: "ledger", href: "/ledger", label: "记账本", icon: Wallet, group: "life" },
  { id: "fitness", href: "/fitness", label: "健身打卡", icon: Dumbbell, group: "life" },
  { id: "diary", href: "/diary", label: "日记", icon: NotebookPen, group: "life" },
  { id: "schedule", href: "/schedule", label: "课程表", icon: BookOpenCheck, group: "life" },
  { id: "habits", href: "/habits", label: "习惯打卡", icon: Repeat, group: "life" },
  { id: "countdown", href: "/countdown", label: "倒数日", icon: Hourglass, group: "life" },
  { id: "reading", href: "/reading", label: "阅读清单", icon: Library, group: "life" },
  { id: "vault", href: "/vault", label: "密码本", icon: KeyRound, group: "life" },
];

export const NAV_GROUPS: NavGroupMeta[] = [
  { id: "core", label: "核心办公区" },
  { id: "life", label: "生活工具区" },
];

const byId = new Map(NAV_ITEMS.map((item) => [item.id, item]));

/** 根据持久化的顺序 id 数组，返回排序后的导航项（未知 id 忽略，缺失项补到末尾）。 */
export function orderNavItems(order: string[]): NavItem[] {
  const valid = new Set(NAV_ITEMS.map((item) => item.id));
  const seen = new Set<string>();
  const ordered: NavItem[] = [];
  for (const id of order) {
    if (!valid.has(id) || seen.has(id)) continue;
    const item = byId.get(id);
    if (item) ordered.push(item);
    seen.add(id);
  }
  for (const item of NAV_ITEMS) {
    if (!seen.has(item.id)) ordered.push(item);
  }
  return ordered;
}
