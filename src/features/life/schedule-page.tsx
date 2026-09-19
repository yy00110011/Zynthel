"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { GlassPanel, SectionTitle } from "@/components/ui/glass-panel";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
// 课程色块用主题系统配色（几何色块，无品牌元素）
const COURSE_COLORS = ["#48b9bd", "#f59e0b", "#8b5cf6", "#10b981", "#f97316", "#3b82f6", "#ec4899", "#14b8a6"];

export function SchedulePage() {
  const data = useWorkspace();
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [teacher, setTeacher] = useState("");
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:40");

  const courses = data.courses;
  const today = new Date();
  const todayWeekday = today.getDay() === 0 ? 7 : today.getDay();

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
        weeks: [],
        termId: "",
        createdAt: new Date().toISOString(),
      }],
      updatedAt: new Date().toISOString(),
    }));
    setName(""); setRoom(""); setTeacher("");
  };

  const removeCourse = (id: string) => {
    workspaceRepository.update((d) => ({ ...d, courses: d.courses.filter((c) => c.id !== id) }));
  };

  return (
    <div className="page-stack">
      <header className="page-heading"><p>每周安排</p><h1>课程表</h1><span>编排你的每周课程，今日课程自动高亮。</span></header>

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
                list.map((c, idx) => (
                  <div key={c.id} className="schedule-course" style={{ borderLeftColor: COURSE_COLORS[idx % COURSE_COLORS.length] }}>
                    <strong>{c.name}</strong>
                    <span>{c.startTime} - {c.endTime}</span>
                    {(c.room || c.teacher) && <small>{[c.room, c.teacher].filter(Boolean).join(" · ")}</small>}
                    <button aria-label="删除" onClick={() => removeCourse(c.id)}><Trash2 /></button>
                  </div>
                ))
              )}
            </GlassPanel>
          );
        })}
      </div>
    </div>
  );
}
