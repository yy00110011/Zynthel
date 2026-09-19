import { describe, expect, it } from "vitest";
import { createDefaultWorkspace } from "./data/schema";
import { addTodo, deleteTodo, todayTodos, toggleTodo } from "./todos/model";
import { addProject, archiveProject, searchProjects } from "./projects/model";
import { addTool, moveTool, searchTools } from "./tools/model";
import { THEME_PRESETS } from "./themes/registry";

describe("todo model", () => {
  it("adds, completes, filters, and deletes todos immutably", () => {
    const before = createDefaultWorkspace("2026-09-18T00:00:00.000Z");
    const added = addTodo(before, { title: "Build the terminal", dueDate: "2026-09-18", projectId: null }, "todo-1", "2026-09-18T01:00:00.000Z");
    expect(before.todos).toHaveLength(0);
    expect(todayTodos(added, "2026-09-18")).toHaveLength(1);
    expect(toggleTodo(added, "todo-1", "2026-09-18T02:00:00.000Z").todos[0].completed).toBe(true);
    expect(deleteTodo(added, "todo-1").todos).toHaveLength(0);
  });
});

describe("project model", () => {
  it("creates searchable projects and archives without deleting", () => {
    const base = createDefaultWorkspace();
    const data = addProject(base, { name: "Wuthering Workspace", description: "Personal AI workspace", rootPath: "/tmp/work", tags: ["AI"], githubUrl: "", progress: 42 }, "project-1", "2026-09-18T01:00:00.000Z");
    expect(searchProjects(data, "ai")).toHaveLength(1);
    expect(archiveProject(data, "project-1", "2026-09-18T02:00:00.000Z").projects[0].status).toBe("archived");
  });
});

describe("tool model", () => {
  it("adds, searches, and reorders tools", () => {
    const base = createDefaultWorkspace();
    const added = addTool(base, { name: "Notes", icon: "note", launch: { type: "website", url: "https://example.com" } }, "tool-notes");
    expect(searchTools(added, "notes")).toHaveLength(1);
    const moved = moveTool(added, "tool-notes", 0);
    expect(moved.tools[0].id).toBe("tool-notes");
    expect(moved.tools.map((tool) => tool.order)).toEqual([0]);
  });
});

it("ships built-in themes and keeps default as the default", () => {
  expect(THEME_PRESETS.map((preset) => preset.id)).toEqual([
    "default", "ink-blue", "rose-mist", "sakura-almond", "moon-frost", "moss-peach",
  ]);
  // 旧数据兼容：默认工作区仍然使用 default 主题
  expect(createDefaultWorkspace().settings.theme).toBe("default");
});
