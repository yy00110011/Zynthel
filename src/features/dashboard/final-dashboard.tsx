"use client";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Code, Folder, Palette, Play, Plus, Smartphone, Terminal, Timer, GitBranch } from "lucide-react";
import { useWorkspace } from "@/features/data/use-workspace";
import { greetingFor } from "@/features/shell/mood";
import { workspaceRepository } from "@/features/data/repository";
import { toggleTodo } from "@/features/todos/model";
import { recentProjects } from "@/features/projects/model";
import { AppPicker } from "@/features/tools/app-picker";
import { openLaunch } from "@/lib/open-launch";
import { detectPlatform, type LaunchMethod } from "@/features/data/schema";

type ToolVisual = { Icon: typeof Terminal; color: string };

const TOOL_VISUALS: Record<string, ToolVisual> = {
  Terminal: { Icon: Terminal, color: "#334155" },
  Finder: { Icon: Folder, color: "#38bdf8" },
  Krita: { Icon: Palette, color: "#f97316" },
  "Visual Studio Code": { Icon: Code, color: "#2563eb" },
  "GitHub Desktop": { Icon: GitBranch, color: "#111827" },
};

const FALLBACK_VISUAL: ToolVisual = { Icon: Smartphone, color: "#48b9bd" };

export function FinalDashboard(){
  const data=useWorkspace();
  const [now,setNow]=useState<Date|null>(null);
  const [picker,setPicker]=useState(false);
  useEffect(()=>{
    const immediate=window.setTimeout(()=>setNow(new Date()),0);
    const timer=window.setInterval(()=>setNow(new Date()),60_000);
    return ()=>{window.clearTimeout(immediate);window.clearInterval(timer);};
  },[]);
  const today=now ?? new Date();
  const iso=today.toLocaleDateString("sv-SE");
  const tasks=data.todos.filter(t=>t.dueDate===iso).slice(0,4);
  const projects=recentProjects(data).slice(0,3);
  const days=Array.from({length:35},(_,i)=>new Date(today.getFullYear(),today.getMonth(),i-today.getDay()+1));
  return <div className="final-home">
    <div className="scene-artwork" aria-hidden="true"/>
    <section className="final-greeting glass-light"><div><p>{now?greetingFor(now):"你好，"}</p><h1>让今天变得更有意义。</h1><span>专注于此刻，稳步向前。</span></div><div className="weather">{now&&(now.getHours()<6||now.getHours()>=18)?"🌙":"☀️"}<strong>—</strong><small>今日心情</small></div></section>
    <section className="today-panel glass-light"><header><h2>今日任务</h2><button><Plus/></button></header><p>{today.toLocaleDateString("zh-CN",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}</p>{tasks.length?tasks.map(t=><button className="final-task" key={t.id} onClick={()=>workspaceRepository.set(toggleTodo(data,t.id))}><i>{t.completed?"✓":""}</i><span>{t.title}<small>{t.dueDate}</small></span></button>):<div className="final-empty">今天没有安排任务</div>}</section>
    <section className="calendar-panel glass-light"><header><CalendarDays/><h2>即将到来</h2></header><strong>{today.toLocaleDateString("zh-CN",{year:"numeric",month:"long"})}</strong><div className="mini-calendar">{["一","二","三","四","五","六","日"].map(x=><b key={x}>{x}</b>)}{days.map(d=><span className={d.toDateString()===today.toDateString()?"active":""} key={d.toISOString()}>{d.getDate()}</span>)}</div></section>
    <section className="recent-panel glass-light"><header><Folder/><h2>最近项目</h2><ArrowRight/></header>{projects.length?projects.map(p=><div key={p.id}><Folder/><span>{p.name}<small>{p.description}</small></span><progress value={p.progress??0} max="100"/></div>):<div className="final-empty">还没有项目</div>}</section>
    <section className="apps-panel glass-light"><header><h2>快捷应用</h2><ArrowRight/></header><div>{data.tools.slice(0,7).map(t=>{
      const visual=TOOL_VISUALS[t.name]??FALLBACK_VISUAL;
      const {Icon,color}=visual;
      return <button key={t.id} onClick={()=>void openLaunch(t.launch as LaunchMethod)}>
        <i className="app-tile" style={{background:`linear-gradient(150deg,${color},${color}b0)`,boxShadow:`0 6px 16px ${color}33`}}><Icon size={20} color="#fff"/></i>
        <span>{t.name}</span>
      </button>;
    })}{detectPlatform()==="android"&&<button onClick={()=>setPicker(true)}>
      <i className="app-tile app-tile-add"><Plus size={20}/></i>
      <span>添加</span>
    </button>}</div>{!data.tools.length&&<p className="apps-empty">还没有应用，点「添加」从本机里挑一个吧。</p>}</section>
    <section className="focus-panel glass-light"><header><Timer/><h2>专注</h2></header><div className="focus-dial"><strong>25:00</strong><span>专注时间</span><button><Play/></button></div></section>
    {picker&&<AppPicker onClose={()=>setPicker(false)}/>}
  </div>
}
