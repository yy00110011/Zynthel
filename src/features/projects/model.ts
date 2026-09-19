import type { Project, WorkspaceData } from "../data/schema";

type ProjectDraft = Pick<Project, "name" | "description" | "rootPath" | "tags" | "githubUrl" | "progress">;

export function addProject(data: WorkspaceData, draft: ProjectDraft, id = crypto.randomUUID(), now = new Date().toISOString()): WorkspaceData {
  const project: Project = { ...draft, id, status: "active", lastOpenedAt: null, createdAt: now, updatedAt: now };
  return { ...data, projects: [...data.projects, project], updatedAt: now };
}

export function updateProject(data: WorkspaceData, id: string, patch: Partial<ProjectDraft>, now = new Date().toISOString()): WorkspaceData {
  return { ...data, projects: data.projects.map((project) => project.id === id ? { ...project, ...patch, updatedAt: now } : project), updatedAt: now };
}

export function archiveProject(data: WorkspaceData, id: string, now = new Date().toISOString()): WorkspaceData {
  return { ...data, projects: data.projects.map((project) => project.id === id ? { ...project, status: project.status === "archived" ? "active" : "archived", updatedAt: now } : project), updatedAt: now };
}

export function deleteProject(data: WorkspaceData, id: string): WorkspaceData {
  return { ...data, projects: data.projects.filter((project) => project.id !== id), todos: data.todos.filter((todo) => todo.projectId !== id), updatedAt: new Date().toISOString() };
}

export function searchProjects(data: WorkspaceData, query: string) {
  const needle = query.trim().toLocaleLowerCase();
  return data.projects.filter((project) => project.status !== "archived" && (!needle || [project.name, project.description, ...project.tags].some((value) => value.toLocaleLowerCase().includes(needle))));
}

export function recentProjects(data: WorkspaceData) {
  return [...data.projects].filter((project) => project.status !== "archived").sort((a, b) => (b.lastOpenedAt ?? b.updatedAt).localeCompare(a.lastOpenedAt ?? a.updatedAt)).slice(0, 4);
}
