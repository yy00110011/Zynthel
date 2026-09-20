"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";
import { addTodo, deleteTodo, toggleTodo } from "@/features/todos/model";
import { festivalsForDate } from "./festivals";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
function toISO(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export function CalendarPage() {
  const data = useWorkspace();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [adding, setAdding] = useState<string | null>(null); // 正在添加待办的日期 ISO
  const [draft, setDraft] = useState("");

  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // 周一=0

  // 42 格（6 行），从当月第一天所在的周一开始
  const cells = useMemo(() => {
    const list: { year: number; month: number; day: number; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(year, month, 1 - startWeekday + i);
      list.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        day: d.getDate(),
        inMonth: d.getMonth() === month,
      });
    }
    return list;
  }, [year, month, startWeekday]);

  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  const changeMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setAdding(null);
  };
  const changeYear = (delta: number) => {
    setYear((y) => y + delta);
    setAdding(null);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setAdding(null);
  };

  const confirmAdd = () => {
    const title = draft.trim();
    if (!title || !adding) return;
    workspaceRepository.set(addTodo(data, { title, dueDate: adding, projectId: null }));
    setDraft("");
    setAdding(null);
  };

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p>本地日程</p>
        <h1>日历</h1>
        <span>点击任意日期添加待办，勾选即完成（与任务同步）。</span>
      </header>

      <div className="calendar-toolbar">
        <button onClick={() => changeYear(-1)} aria-label="上一年">«</button>
        <button onClick={() => changeMonth(-1)} aria-label="上一月"><ChevronLeft /></button>
        <strong className="calendar-title">{year} 年 {month + 1} 月</strong>
        <button onClick={() => changeMonth(1)} aria-label="下一月"><ChevronRight /></button>
        <button onClick={() => changeYear(1)} aria-label="下一年">»</button>
        <button className="calendar-today-btn" onClick={goToday}>今天</button>
      </div>

      <GlassPanel className="calendar-full">
        <div className="calendar-weekdays">
          {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
        </div>
        <div className="calendar-grid calendar-grid-full">
          {cells.map((cell) => {
            const iso = toISO(cell.year, cell.month, cell.day);
            const isToday = iso === todayISO;
            // festivalsForDate 的 month 为 1-based（数据键即真实月份，如 "10-01" 国庆节），
            // 而 cell.month 是 Date.getMonth() 的 0-based 值，故此处 +1。
            const festivals = festivalsForDate(cell.year, cell.month + 1, cell.day);
            const dayTodos = data.todos.filter((t) => t.dueDate === iso);
            return (
              <div
                key={iso}
                className={[
                  "calendar-day",
                  cell.inMonth ? "" : "out-month",
                  isToday ? "today" : "",
                  adding === iso ? "adding" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => {
                  if (adding !== iso) { setAdding(iso); setDraft(""); }
                }}
              >
                <div className="calendar-day-head">
                  <strong>{cell.day}</strong>
                  {festivals.length > 0 && (
                    <div className="calendar-festivals">
                      {festivals.map((f) => (
                        <em key={f.name} className={f.type === "lunar" ? "lunar" : ""}>{f.name}</em>
                      ))}
                    </div>
                  )}
                </div>

                <div className="calendar-day-todos">
                  {dayTodos.map((t) => (
                    <div key={t.id} className={`calendar-todo ${t.completed ? "done" : ""}`}>
                      <button
                        className="calendar-todo-check"
                        aria-label={t.completed ? "标记未完成" : "标记完成"}
                        onClick={(e) => { e.stopPropagation(); workspaceRepository.set(toggleTodo(data, t.id)); }}
                      >
                        {t.completed ? "✓" : ""}
                      </button>
                      <span>{t.title}</span>
                      <button
                        className="calendar-todo-del"
                        aria-label="删除待办"
                        onClick={(e) => { e.stopPropagation(); workspaceRepository.set(deleteTodo(data, t.id)); }}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  ))}
                  {dayTodos.length === 0 && <span className="calendar-empty-hint">·</span>}
                </div>

                {adding === iso && (
                  <div className="calendar-add-form" onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={draft}
                      placeholder="添加待办…"
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") confirmAdd(); if (e.key === "Escape") setAdding(null); }}
                    />
                    <button onClick={confirmAdd} aria-label="确定添加"><Plus /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlassPanel>
    </div>
  );
}
