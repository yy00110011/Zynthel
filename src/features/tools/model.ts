import type { ToolItem, WorkspaceData } from "../data/schema";

type ToolDraft = Pick<ToolItem, "name" | "icon" | "launch">;

export function addTool(data: WorkspaceData, draft: ToolDraft, id = crypto.randomUUID()): WorkspaceData {
  const tool: ToolItem = { ...draft, id, order: data.tools.length, lastOpenedAt: null };
  return { ...data, tools: [...data.tools, tool], updatedAt: new Date().toISOString() };
}

export function updateTool(data: WorkspaceData, id: string, patch: Partial<ToolDraft>): WorkspaceData {
  return { ...data, tools: data.tools.map((tool) => tool.id === id ? { ...tool, ...patch } : tool), updatedAt: new Date().toISOString() };
}

export function deleteTool(data: WorkspaceData, id: string): WorkspaceData {
  return { ...data, tools: data.tools.filter((tool) => tool.id !== id).map((tool, order) => ({ ...tool, order })), updatedAt: new Date().toISOString() };
}

export function moveTool(data: WorkspaceData, id: string, index: number): WorkspaceData {
  const sorted = [...data.tools].sort((a, b) => a.order - b.order);
  const from = sorted.findIndex((tool) => tool.id === id);
  if (from < 0) return data;
  const [item] = sorted.splice(from, 1);
  sorted.splice(Math.max(0, Math.min(index, sorted.length)), 0, item);
  return { ...data, tools: sorted.map((tool, order) => ({ ...tool, order })), updatedAt: new Date().toISOString() };
}

export function searchTools(data: WorkspaceData, query: string) {
  const needle = query.trim().toLocaleLowerCase();
  return [...data.tools].filter((tool) => !needle || tool.name.toLocaleLowerCase().includes(needle)).sort((a, b) => a.order - b.order);
}
