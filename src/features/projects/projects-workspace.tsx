"use client";

import { Archive, FolderKanban, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { workspaceRepository } from "@/features/data/repository";
import { useWorkspace } from "@/features/data/use-workspace";
import { addProject, archiveProject, deleteProject, searchProjects, updateProject } from "./model";

export function ProjectsWorkspace() {
  const data = useWorkspace(); const [query,setQuery]=useState(""); const [showForm,setShowForm]=useState(false); const [editingId,setEditingId]=useState<string|null>(null);
  const projects=searchProjects(data,query);
  const editing=data.projects.find(project=>project.id===editingId);
  const create=(form:FormData)=>{const name=String(form.get("name")??"").trim();if(!name)return;const draft={name,description:String(form.get("description")??""),rootPath:String(form.get("rootPath")??""),tags:String(form.get("tags")??"").split(",").map(v=>v.trim()).filter(Boolean),githubUrl:"",progress:null};workspaceRepository.set(editingId?updateProject(data,editingId,draft):addProject(data,draft));setShowForm(false);setEditingId(null)};
  return <div className="page-stack"><header className="page-heading"><p>项目空间</p><h1>项目</h1><span>项目、路径与知识资产在一个共振空间里保持联系。</span></header><div className="toolbar"><label><Search/><input aria-label="搜索项目" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索项目或标签…"/></label><button className="primary-action" onClick={()=>{setEditingId(null);setShowForm(!showForm)}}><Plus/> 新建项目</button></div>{showForm&&<GlassPanel className="editor-panel"><form key={editingId??"new"} action={create}><input name="name" required defaultValue={editing?.name} placeholder="项目名称"/><input name="description" defaultValue={editing?.description} placeholder="项目描述"/><input name="rootPath" defaultValue={editing?.rootPath} placeholder="/absolute/project/path"/><input name="tags" defaultValue={editing?.tags.join(", ")} placeholder="标签（用逗号分隔）"/><button className="primary-action">{editingId?"保存项目":"创建项目"}</button></form></GlassPanel>}<div className="collection-grid">{projects.map(project=><GlassPanel className="collection-card" key={project.id}><div className="card-icon"><FolderKanban/></div><h2>{project.name}</h2><p>{project.description||"暂无描述。"}</p><div className="tag-row">{project.tags.map(tag=><span key={tag}>{tag}</span>)}</div><div className="progress-track"><i style={{width:`${project.progress??0}%`}}/></div><footer><Link className="primary-action" href={`/projects/detail?id=${encodeURIComponent(project.id)}`}>打开</Link><button aria-label={`编辑 ${project.name}`} onClick={()=>{setEditingId(project.id);setShowForm(true)}}><Pencil/></button><button aria-label={`归档 ${project.name}`} onClick={()=>workspaceRepository.set(archiveProject(data,project.id))}><Archive/></button><button aria-label={`删除 ${project.name}`} onClick={()=>window.confirm(`确定删除 ${project.name}？`)&&workspaceRepository.set(deleteProject(data,project.id))}><Trash2/></button></footer></GlassPanel>)}{!projects.length&&<GlassPanel className="empty-state"><FolderKanban/><h2>暂无项目</h2><p>创建第一个项目，或调整搜索条件。</p></GlassPanel>}</div></div>;
}
