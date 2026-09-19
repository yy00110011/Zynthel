"use client";

import { Plus, Trash2, Dumbbell, Flame } from "lucide-react";
import { useMemo, useState } from "react";
import { GlassPanel, SectionTitle } from "@/components/ui/glass-panel";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";

const EXERCISES = ["跑步", "力量训练", "瑜伽", "游泳", "骑行", "篮球", "其他"];

export function FitnessPage() {
  const data = useWorkspace();
  const [exercise, setExercise] = useState(EXERCISES[0]);
  const [duration, setDuration] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [note, setNote] = useState("");

  const workouts = data.workouts;

  const weeklyMinutes = useMemo(() => {
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    return workouts.filter((w) => {
      const d = new Date(w.date);
      return d >= start;
    }).reduce((s, w) => s + w.durationMinutes, 0);
  }, [workouts]);

  const totalDays = useMemo(() => new Set(workouts.map((w) => w.date)).size, [workouts]);

  const addWorkout = () => {
    const mins = parseInt(duration, 10);
    if (!Number.isFinite(mins) || mins <= 0) return;
    workspaceRepository.update((d) => ({
      ...d,
      workouts: [{
        id: crypto.randomUUID(),
        date: new Date().toLocaleDateString("sv-SE"),
        exercise,
        durationMinutes: mins,
        sets: parseInt(sets, 10) || 0,
        reps: parseInt(reps, 10) || 0,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      }, ...d.workouts],
      updatedAt: new Date().toISOString(),
    }));
    setDuration(""); setSets(""); setReps(""); setNote("");
  };

  const removeWorkout = (id: string) => {
    workspaceRepository.update((d) => ({ ...d, workouts: d.workouts.filter((w) => w.id !== id) }));
  };

  return (
    <div className="page-stack">
      <header className="page-heading"><p>运动记录</p><h1>健身打卡</h1><span>记录每次运动，见证身体的改变。</span></header>

      <GlassPanel className="fitness-summary">
        <div className="fitness-stat"><Flame /><span>本周运动</span><strong>{weeklyMinutes} 分钟</strong></div>
        <div className="fitness-stat"><Dumbbell /><span>累计打卡</span><strong>{totalDays} 天</strong></div>
      </GlassPanel>

      <GlassPanel>
        <SectionTitle>记录运动</SectionTitle>
        <div className="fitness-form">
          <select aria-label="运动类型" value={exercise} onChange={(e) => setExercise(e.target.value)}>
            {EXERCISES.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <input aria-label="时长（分钟）" type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="时长（分钟）" />
          <input aria-label="组数" type="number" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} placeholder="组数" />
          <input aria-label="次数" type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="次数" />
          <input aria-label="备注" value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注" />
          <button className="primary-action" onClick={addWorkout}><Plus /> 记录</button>
        </div>
      </GlassPanel>

      <GlassPanel>
        <SectionTitle>运动历史</SectionTitle>
        {workouts.length === 0 ? (
          <p className="ledger-empty">还没有运动记录，开始第一次锻炼吧。</p>
        ) : (
          <div className="ledger-list">
            {workouts.map((w) => (
              <div key={w.id} className="ledger-row">
                <span>{w.exercise}</span>
                <span>{w.durationMinutes} 分钟</span>
                {(w.sets > 0 || w.reps > 0) && <span>{w.sets} 组 × {w.reps} 次</span>}
                <span>{w.date}</span>
                {w.note && <small>{w.note}</small>}
                <button aria-label="删除" onClick={() => removeWorkout(w.id)}><Trash2 /></button>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
