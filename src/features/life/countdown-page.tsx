"use client";

import { Plus, Trash2, Hourglass, Gift, CalendarDays, Flag, Pin } from "lucide-react";
import { useMemo, useState } from "react";
import { GlassPanel, SectionTitle } from "@/components/ui/glass-panel";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";

const CATEGORY_ICONS = [
  { key: "gift", Icon: Gift },
  { key: "calendar", Icon: CalendarDays },
  { key: "flag", Icon: Flag },
];

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function CountdownPage() {
  const data = useWorkspace();
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [mode, setMode] = useState<"countdown" | "countup">("countdown");
  const [repeatRule, setRepeatRule] = useState<"none" | "annual">("none");
  const [categoryIcon, setCategoryIcon] = useState("gift");

  const events = data.countdownEvents;

  const withDays = useMemo(() => {
    const today = new Date();
    return events.map((e) => {
      let diff = daysBetween(today, new Date(e.targetDate));
      if (e.repeatRule === "annual") {
        // 年度重复：若已过，推到明年
        const target = new Date(e.targetDate);
        const next = new Date(today.getFullYear(), target.getMonth(), target.getDate());
        if (next < today) next.setFullYear(today.getFullYear() + 1);
        diff = daysBetween(today, next);
      }
      return { ...e, diff };
    }).sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1) || a.diff - b.diff);
  }, [events]);

  const addEvent = () => {
    const t = title.trim();
    if (!t || !targetDate) return;
    workspaceRepository.update((d) => ({
      ...d,
      countdownEvents: [...d.countdownEvents, {
        id: crypto.randomUUID(),
        title: t,
        targetDate,
        mode,
        pinned: false,
        repeatRule,
        categoryId: categoryIcon,
        createdAt: new Date().toISOString(),
      }],
      updatedAt: new Date().toISOString(),
    }));
    setTitle(""); setTargetDate("");
  };

  const removeEvent = (id: string) => {
    workspaceRepository.update((d) => ({ ...d, countdownEvents: d.countdownEvents.filter((e) => e.id !== id) }));
  };

  const togglePin = (id: string) => {
    workspaceRepository.update((d) => ({
      ...d,
      countdownEvents: d.countdownEvents.map((e) => e.id === id ? { ...e, pinned: !e.pinned } : e),
    }));
  };

  return (
    <div className="page-stack">
      <header className="page-heading"><p>重要日子</p><h1>倒数日</h1><span>记住每一个值得期待或纪念的日子。</span></header>

      <GlassPanel>
        <SectionTitle>添加事件</SectionTitle>
        <div className="countdown-form">
          <input aria-label="事件名称" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="事件名称" />
          <input aria-label="目标日期" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          <select aria-label="模式" value={mode} onChange={(e) => setMode(e.target.value as "countdown" | "countup")}>
            <option value="countdown">倒计时</option>
            <option value="countup">正计时</option>
          </select>
          <select aria-label="重复" value={repeatRule} onChange={(e) => setRepeatRule(e.target.value as "none" | "annual")}>
            <option value="none">不重复</option>
            <option value="annual">每年重复</option>
          </select>
          <select aria-label="分类" value={categoryIcon} onChange={(e) => setCategoryIcon(e.target.value)}>
            <option value="gift">礼物</option>
            <option value="calendar">日历</option>
            <option value="flag">旗帜</option>
          </select>
          <button className="primary-action" onClick={addEvent}><Plus /> 添加</button>
        </div>
      </GlassPanel>

      <GlassPanel>
        <SectionTitle>事件列表</SectionTitle>
        {withDays.length === 0 ? (
          <p className="ledger-empty">还没有事件。</p>
        ) : (
          <div className="countdown-list">
            {withDays.map((e) => {
              const IconComp = CATEGORY_ICONS.find((c) => c.key === e.categoryId)?.Icon ?? Hourglass;
              const abs = Math.abs(e.diff);
              const label = e.mode === "countdown" ? (e.diff >= 0 ? `还有 ${abs} 天` : `已过 ${abs} 天`) : `已过 ${abs} 天`;
              return (
                <div key={e.id} className={`countdown-item ${e.pinned ? "pinned" : ""}`}>
                  <span className="countdown-icon"><IconComp /></span>
                  <div className="countdown-main">
                    <strong>{e.title}</strong>
                    <small>{e.targetDate}{e.repeatRule === "annual" ? " · 每年" : ""}</small>
                  </div>
                  <span className="countdown-days">{label}</span>
                  <button aria-label="置顶" onClick={() => togglePin(e.id)}><Pin /></button>
                  <button aria-label="删除" onClick={() => removeEvent(e.id)}><Trash2 /></button>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
