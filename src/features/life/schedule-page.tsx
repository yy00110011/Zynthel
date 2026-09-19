"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { GlassPanel, SectionTitle } from "@/components/ui/glass-panel";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
// 课程色块用主题系统配色（几何色块，无品牌元素）
const COURSE_COLORS = ["#48b9bd", "#f59e0b", "#8b5cf6", "#10b981", "#f97316", "#3b82f6", "#ec4899", "#14b8a6"];
const MAX_WEEKS = 20;
const ALL_WEEKS = Array.from({ length: MAX_WEEKS }, (_, i) => i + 1);

/** 把周次数组压缩成区间摘要：「每周」/「第 1-4、16 周」 */
export function formatWeeks(weeks: number[]): string {
  if (!weeks.length) return "每周";
  const sorted = [...weeks].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) { prev = sorted[i]; continue; }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = prev = sorted[i];
  }
  parts.push(start === prev ? `${start}` : `${start}-${prev}`);
  return `第 ${parts.join("、")} 周`;
}

/** 全选 20 周时归一化为空数组（空数组语义 = 每周都有课，兼容旧数据） */
function normalizeWeeks(weeks: number[]): number[] {
  return weeks.length >= MAX_WEEKS ? [] : [...weeks].sort((a, b) => a - b);
}

/** 根据学期起止日期计算今天是本学期第几周（1-20），不在任何学期内则返回 null */
function currentTermWeek(terms: { name: string; startDate: string; endDate: string }[]): { week: number; termName: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const term of terms) {
    const start = new Date(`${term.startDate}T00:00:00`);
    const end = new Date(`${term.endDate}T23:59:59`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    if (today >= start && today <= end) {
      const week = Math.floor((today.getTime() - start.getTime()) / 86_400_000 / 7) + 1;
      return { week: Math.min(Math.max(week, 1), MAX_WEEKS), termName: term.name };
    }
  }
  return null;
}

/** 20 个周次的可勾选芯片（1-20）。空集合语义 = 每周（渲染为全亮），点击基于有效集合切换。 */
function WeekChips({ value, onChange }: { value: number[]; onChange: (next: number[]) => void }) {
  // 空数组 = 每周都有课：显示为全亮，取消任意一周得到其余周的显式集合
  const effective = value.length ? [...value].sort((a, b) => a - b) : ALL_WEEKS;
  return (
    <div className="week-chips" role="group" aria-label="上课周次">
      {ALL_WEEKS.map((w) => {
        const active = effective.includes(w);
        return (
          <button
            type="button"
            key={w}
            className={active ? "on" : ""}
            aria-pressed={active}
            onClick={() => onChange(active ? effective.filter((x) => x !== w) : [...effective, w])}
          >
            {w}
          </button>
        );
      })}
      <div className="week-chip-actions">
        <button type="button" onClick={() => onChange(ALL_WEEKS)}>全选</button>
        <button type="button" onClick={() => onChange([])}>每周</button>
      </div>
    </div>
  );
}

export function SchedulePage() {
  const data = useWorkspace();
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [teacher, setTeacher] = useState("");
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:40");
  const [weeks, setWeeks] = useState<number[]>(ALL_WEEKS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const courses = data.courses;
  const today = new Date();
  const todayWeekday = today.getDay() === 0 ? 7 : today.getDay();
  const termWeek = useMemo(() => currentTermWeek(data.terms), [data.terms]);

  const coursesByDay = useMemo(() => {
    const map = new Map<number, typeof courses>();
    for (let i = 1; i <= 7; i++) map.set(i, []);
    for (const c of courses) {
      const list = map.get(c.weekday) ?? [];
      list.push(c);
    }
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [courses]);

  const addCourse = () => {
    const n = name.trim();
    if (!n) return;
    workspaceRepository.update((d) => ({
      ...d,
      courses: [...d.courses, {
        id: crypto.randomUUID(),
        name: n,
        room: room.trim(),
        teacher: teacher.trim(),
        weekday,
        startTime,
        endTime,
        weeks: normalizeWeeks(weeks),
        termId: "",
        createdAt: new Date().toISOString(),
      }],
      updatedAt: new Date().toISOString(),
    }));
    setName(""); setRoom(""); setTeacher(""); setWeeks(ALL_WEEKS);
  };

  const removeCourse = (id: string) => {
    workspaceRepository.update((d) => ({ ...d, courses: d.courses.filter((c) => c.id !== id) }));
  };

  const setCourseWeeks = (id: string, next: number[]) => {
    const normalized = normalizeWeeks(next);
    workspaceRepository.update((d) => ({
      ...d,
      courses: d.courses.map((c) => (c.id === id ? { ...c, weeks: normalized } : c)),
    }));
  };

  /** 该课程本周是否上课（未标记周次视为每周都有） */
  const hasClassThisWeek = (weeks: number[]) => !weeks.length || (termWeek ? weeks.includes(termWeek.week) : true);

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p>每周安排</p>
        <h1>课程表</h1>
        <span>
          编排每周课程，可按周次（第 1-{MAX_WEEKS} 周）标记每门课哪几周上课。
          {termWeek && <strong className="term-week-badge">本学期第 {termWeek.week} 周 · {termWeek.termName}</strong>}
        </span>
      </header>

      <GlassPanel>
        <SectionTitle>添加课程</SectionTitle>
        <div className="schedule-form">
          <input aria-label="课程名称" value={name} onChange={(e) => setName(e.target.value)} placeholder="课程名称" />
          <select aria-label="星期" value={weekday} onChange={(e) => setWeekday(parseInt(e.target.value, 10))}>
            {WEEKDAYS.map((w, i) => <option key={w} value={i + 1}>{w}</option>)}
          </select>
          <input aria-label="开始时间" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <input aria-label="结束时间" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          <input aria-label="教室" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="教室" />
          <input aria-label="老师" value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="老师" />
          <button className="primary-action" onClick={addCourse}><Plus /> 添加</button>
          <div className="week-row">
            <label>上课周次<small>点亮的周为有课周；默认全部点亮 = 每周都有课</small></label>
            <WeekChips value={weeks} onChange={setWeeks} />
          </div>
        </div>
      </GlassPanel>

      <div className="schedule-grid">
        {WEEKDAYS.map((wd, i) => {
          const day = i + 1;
          const isToday = day === todayWeekday;
          const list = coursesByDay.get(day) ?? [];
          return (
            <GlassPanel key={wd} className={`schedule-day ${isToday ? "today" : ""}`}>
              <SectionTitle>{isToday ? `${wd} · 今天` : wd}</SectionTitle>
              {list.length === 0 ? (
                <p className="ledger-empty">无课</p>
              ) : (
                list.map((c, idx) => {
                  const thisWeek = hasClassThisWeek(c.weeks);
                  const expanded = expandedId === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`schedule-course ${thisWeek ? "" : "week-off"} ${expanded ? "expanded" : ""}`}
                      style={{ borderLeftColor: COURSE_COLORS[idx % COURSE_COLORS.length] }}
                      onClick={() => setExpandedId(expanded ? null : c.id)}
                    >
                      <strong>{c.name}{!thisWeek && <em className="week-off-tag">本周无课</em>}</strong>
                      <span>{c.startTime} - {c.endTime}</span>
                      {(c.room || c.teacher) && <small>{[c.room, c.teacher].filter(Boolean).join(" · ")}</small>}
                      <small className="course-weeks">{formatWeeks(c.weeks)}</small>
                      <button
                        aria-label="删除"
                        onClick={(e) => { e.stopPropagation(); removeCourse(c.id); }}
                      ><Trash2 /></button>
                      {expanded && (
                        <div className="week-editor" onClick={(e) => e.stopPropagation()}>
                          <label>上课周次</label>
                          <WeekChips value={c.weeks} onChange={(next) => setCourseWeeks(c.id, next)} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </GlassPanel>
          );
        })}
      </div>
    </div>
  );
}
