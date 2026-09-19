"use client";

import { Plus, Trash2, Repeat, Droplet, Book, Moon, Flame, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { GlassPanel, SectionTitle } from "@/components/ui/glass-panel";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";

const ICONS = [
  { key: "droplet", Icon: Droplet },
  { key: "book", Icon: Book },
  { key: "moon", Icon: Moon },
  { key: "flame", Icon: Flame },
];

export function HabitsPage() {
  const data = useWorkspace();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("droplet");

  const habits = data.habits;
  const checks = data.habitChecks;
  const today = new Date().toLocaleDateString("sv-SE");

  const addHabit = () => {
    const n = name.trim();
    if (!n) return;
    workspaceRepository.update((d) => ({
      ...d,
      habits: [...d.habits, { id: crypto.randomUUID(), name: n, icon, frequency: "daily", remind: false, createdAt: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    }));
    setName("");
  };

  const removeHabit = (id: string) => {
    workspaceRepository.update((d) => ({ ...d, habits: d.habits.filter((h) => h.id !== id), habitChecks: d.habitChecks.filter((c) => c.habitId !== id) }));
  };

  const toggleCheck = (habitId: string) => {
    const existing = checks.find((c) => c.habitId === habitId && c.date === today);
    workspaceRepository.update((d) => {
      if (existing) {
        return { ...d, habitChecks: d.habitChecks.filter((c) => c.habitId !== habitId || c.date !== today) };
      }
      return { ...d, habitChecks: [...d.habitChecks, { habitId, date: today, done: true }], updatedAt: new Date().toISOString() };
    });
  };

  // 计算连续天数
  const streakFor = useMemo(() => {
    return (habitId: string) => {
      const doneDates = new Set(checks.filter((c) => c.habitId === habitId && c.done).map((c) => c.date));
      let streak = 0;
      const d = new Date();
      // 如果今天没打卡，从昨天开始算连续
      if (!doneDates.has(d.toLocaleDateString("sv-SE"))) d.setDate(d.getDate() - 1);
      while (doneDates.has(d.toLocaleDateString("sv-SE"))) {
        streak++;
        d.setDate(d.getDate() - 1);
      }
      return streak;
    };
  }, [checks]);

  return (
    <div className="page-stack">
      <header className="page-heading"><p>每日坚持</p><h1>习惯打卡</h1><span>养成好习惯，每天进步一点点。</span></header>

      <GlassPanel>
        <SectionTitle>新建习惯</SectionTitle>
        <div className="habits-form">
          <input aria-label="习惯名称" value={name} onChange={(e) => setName(e.target.value)} placeholder="习惯名称" />
          <div className="habits-icon-row">
            {ICONS.map(({ key, Icon }) => (
              <button key={key} className={`habits-icon ${icon === key ? "active" : ""}`} onClick={() => setIcon(key)} title={key}><Icon /></button>
            ))}
          </div>
          <button className="primary-action" onClick={addHabit}><Plus /> 添加</button>
        </div>
      </GlassPanel>

      <GlassPanel>
        <SectionTitle>今日打卡</SectionTitle>
        {habits.length === 0 ? (
          <p className="ledger-empty">还没有习惯，先创建一个吧。</p>
        ) : (
          <div className="habits-list">
            {habits.map((h) => {
              const IconComp = ICONS.find((i) => i.key === h.icon)?.Icon ?? Repeat;
              const done = checks.some((c) => c.habitId === h.id && c.date === today && c.done);
              const streak = streakFor(h.id);
              return (
                <div key={h.id} className={`habit-row ${done ? "done" : ""}`}>
                  <span className="habit-icon"><IconComp /></span>
                  <span className="habit-name">{h.name}</span>
                  <span className="habit-streak"><Flame /> 连续 {streak} 天</span>
                  <button className={`habit-check ${done ? "checked" : ""}`} onClick={() => toggleCheck(h.id)}>
                    {done && <Check />}
                  </button>
                  <button aria-label="删除" onClick={() => removeHabit(h.id)}><Trash2 /></button>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
