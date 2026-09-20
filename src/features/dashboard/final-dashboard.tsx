"use client";
import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Code, Folder, Palette, Play, Plus, Smartphone, Terminal, Timer, GitBranch } from "lucide-react";
import { useWorkspace } from "@/features/data/use-workspace";
import { greetingFor } from "@/features/shell/mood";
import { workspaceRepository } from "@/features/data/repository";
import { toggleTodo } from "@/features/todos/model";
import { recentProjects } from "@/features/projects/model";
import { AppPicker } from "@/features/tools/app-picker";
import { openLaunch } from "@/lib/open-launch";
import { BUILTIN_SHORTCUTS, type BuiltinShortcut } from "@/features/tools/builtin-shortcuts";
import { findLocalApp, type LocalAppMatch } from "@/lib/installed-apps";
import { detectPlatform, type LaunchMethod } from "@/features/data/schema";
import { isWindowsDesktop } from "@/lib/runtime";

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
  const router=useRouter();
  const [now,setNow]=useState<Date|null>(null);
  const [picker,setPicker]=useState(false);
  useEffect(()=>{
    const immediate=window.setTimeout(()=>setNow(new Date()),0);
    const timer=window.setInterval(()=>setNow(new Date()),60_000);
    return ()=>{window.clearTimeout(immediate);window.clearInterval(timer);};
  },[]);
  // 小组件整体点击跳转到对应栏目；点在内部按钮/链接上时不跳转（保留子交互）
  const openSection=(href:string)=>(event:MouseEvent<HTMLElement>)=>{
    if((event.target as HTMLElement).closest("button,a,input,select,textarea,label"))return;
    router.push(href);
  };
  const today=now ?? new Date();
  const iso=today.toLocaleDateString("sv-SE");
  const tasks=data.todos.filter(t=>t.dueDate===iso).slice(0,4);
  const projects=recentProjects(data).slice(0,3);
  const days=Array.from({length:35},(_,i)=>new Date(today.getFullYear(),today.getMonth(),i-today.getDay()+1));
  return (<>
    <div className="final-home">
    <div className="scene-artwork" aria-hidden="true" style={data.settings.backgroundImage ? { backgroundImage: `url(${data.settings.backgroundImage})` } : undefined}/>
    <section className="final-greeting glass-light"><div><p>{now?greetingFor(now):"你好，"}</p><h1>让今天变得更有意义。</h1><span>专注于此刻，稳步向前。</span></div><div className="weather">{now&&(now.getHours()<6||now.getHours()>=18)?"🌙":"☀️"}<strong>—</strong><small>今日心情</small></div></section>
    <section className="today-panel glass-light clickable-card" onClick={openSection("/tasks")} title="打开任务"><header><h2>今日任务</h2><button aria-label="去任务页添加" onClick={()=>router.push("/tasks")}><Plus/></button></header><p>{today.toLocaleDateString("zh-CN",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}</p>{tasks.length?tasks.map(t=><button className="final-task" key={t.id} onClick={()=>workspaceRepository.set(toggleTodo(data,t.id))}><i>{t.completed?"✓":""}</i><span>{t.title}<small>{t.dueDate}</small></span></button>):<div className="final-empty">今天没有安排任务</div>}</section>
    <section className="calendar-panel glass-light clickable-card" onClick={openSection("/calendar")} title="打开日历"><header><CalendarDays/><h2>即将到来</h2></header><strong>{today.toLocaleDateString("zh-CN",{year:"numeric",month:"long"})}</strong><div className="mini-calendar">{["一","二","三","四","五","六","日"].map(x=><b key={x}>{x}</b>)}{days.map(d=><span className={d.toDateString()===today.toDateString()?"active":""} key={d.toISOString()}>{d.getDate()}</span>)}</div></section>
    <section className="recent-panel glass-light clickable-card" onClick={openSection("/projects")} title="打开项目"><header><Folder/><h2>最近项目</h2><ArrowRight/></header>{projects.length?projects.map(p=><div key={p.id}><Folder/><span>{p.name}<small>{p.description}</small></span><progress value={p.progress??0} max="100"/></div>):<div className="final-empty">还没有项目</div>}</section>
    <section className="apps-panel glass-light clickable-card" onClick={openSection("/tools")} title="打开工具"><header><h2>快捷应用</h2><ArrowRight/></header><div>{data.tools.slice(0,7).map(t=>{
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
    <Link href="/focus" className="focus-panel glass-light"><header><Timer/><h2>专注</h2></header><div className="focus-dial"><strong>25:00</strong><span>专注时间</span><button type="button" tabIndex={-1}><Play/></button></div></Link>
    <FavApps />
    {picker&&<AppPicker onClose={()=>setPicker(false)}/>}
  </div>
  </>);
}

// 首页「常用应用」：三个第三方快捷入口（虎扑 / 汽水音乐 / 豆包）。
// 这三个入口是 Windows 桌面端专属功能：仅在 Windows 上展示，点击「本地优先」——
// 先在本机已安装应用里找客户端，找到就用它打开；没装客户端才回落到官方 HTTPS 网页。
// Android / macOS 上不展示该区域（不打包、不下载任何第三方客户端）。
function FavApps() {
  const [localApps,setLocalApps]=useState<Record<string,LocalAppMatch|null>>({});
  const [probed,setProbed]=useState(false);
  useEffect(()=>{
    // Windows 专属：非 Windows 直接不探测、不渲染。
    if(!isWindowsDesktop()){return;}
    let alive=true;
    void (async()=>{
      const found:Record<string,LocalAppMatch|null>={};
      for(const shortcut of BUILTIN_SHORTCUTS){
        found[shortcut.id]=await findLocalApp(shortcut.appKeywords);
      }
      if(alive){setLocalApps(found);setProbed(true);}
    })();
    return ()=>{alive=false;};
  },[]);

  const open=(shortcut:BuiltinShortcut)=>{
    const local=localApps[shortcut.id];
    // 本机有客户端 → 走「后端确认应用」专用通道（local-app）；否则打开官方网页。
    // 不能用 local-path：普通本地路径通道在 Windows 上已拒绝 exe/lnk/url 等可启动文件。
    return void openLaunch(local?{type:"local-app",path:local.path}:{type:"website",url:shortcut.url});
  };

  // 非 Windows 桌面端不渲染这三个快捷入口。
  if(!isWindowsDesktop()){return null;}

  return (
    <section className="fav-apps glass-light" aria-label="常用应用">
      <header>
        <h2>常用应用</h2>
        <span className="fav-apps-tag">优先本地应用 · 未安装则开网页</span>
      </header>
      <div className="fav-apps-row">
        {BUILTIN_SHORTCUTS.map((shortcut)=>{
          const local=localApps[shortcut.id];
          const source=local?"本地应用":(probed?"网页":"检测中");
          return (
            <button
              key={shortcut.id}
              type="button"
              className={`fav-app-card${local?" has-local":""}`}
              onClick={()=>open(shortcut)}
              title={local?`用本机客户端打开：${local.name}`:`在浏览器中打开 ${shortcut.url}`}
            >
              <i className="fav-app-icon"><shortcut.Icon size={20}/></i>
              <span className="fav-app-name">{shortcut.name}</span>
              <em className="fav-app-source">{source}</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}
