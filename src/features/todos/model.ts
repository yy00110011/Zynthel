import type { TodoItem, WorkspaceData } from "../data/schema";

type TodoDraft = Pick<TodoItem, "title" | "dueDate" | "projectId"> & Partial<Pick<TodoItem, "description" | "status" | "priority" | "tags" | "recurrence">>;

export function addTodo(data: WorkspaceData, draft: TodoDraft, id = crypto.randomUUID(), now = new Date().toISOString()): WorkspaceData {
  const todo: TodoItem = { description: "", status: "todo", priority: "medium", tags: [], recurrence: "none", ...draft, id, completed: false, createdAt: now, updatedAt: now };
  return { ...data, todos: [...data.todos, todo], updatedAt: now };
}

export function updateTodo(data: WorkspaceData, id: string, patch: Partial<TodoItem>, now = new Date().toISOString()): WorkspaceData {
  return { ...data, todos: data.todos.map((todo) => todo.id === id ? { ...todo, ...patch, updatedAt: now } : todo), updatedAt: now };
}

export function toggleTodo(data: WorkspaceData, id: string, now = new Date().toISOString()): WorkspaceData {
  return { ...data, todos: data.todos.map((todo) => todo.id === id ? { ...todo, completed: !todo.completed, status: todo.completed ? "todo" : "done", updatedAt: now } : todo), updatedAt: now };
}

export function deleteTodo(data: WorkspaceData, id: string): WorkspaceData {
  return { ...data, todos: data.todos.filter((todo) => todo.id !== id), updatedAt: new Date().toISOString() };
}

export function todayTodos(data: WorkspaceData, date: string) {
  return data.todos.filter((todo) => todo.dueDate === date).slice(0, 3);
}
