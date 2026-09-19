import { z } from "zod";
import {
  ledgerAccountSchema,
  ledgerTransactionSchema,
  workoutSchema,
  fitnessGoalSchema,
  diaryEntrySchema,
  courseSchema,
  termSchema,
  habitSchema,
  habitCheckSchema,
  countdownEventSchema,
  countdownCategorySchema,
  bookSchema,
  vaultMetaSchema,
  vaultEntrySchema,
} from "./life-schema";
import {
  aiModelConfigSchema,
  aiConversationSchema,
} from "./ai-schema";

// 单一默认主题：不再提供多主题切换，theme 固定为 "default"。
export const themeIdSchema = z.enum(["default"]);
export type ThemeId = z.infer<typeof themeIdSchema>;

const timestamp = z.string();

export const todoSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  completed: z.boolean(),
  description: z.string().default(""),
  status: z.enum(["inbox", "todo", "in-progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  tags: z.array(z.string()).default([]),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  dueDate: z.string().nullable(),
  projectId: z.string().nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500),
  rootPath: z.string(),
  tags: z.array(z.string().trim().min(1)).max(12),
  status: z.enum(["active", "paused", "archived"]),
  progress: z.number().int().min(0).max(100).nullable(),
  githubUrl: z.string(),
  lastOpenedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const websiteLaunchSchema = z.object({ type: z.literal("website"), url: z.string().url() });
const appLaunchSchema = z.object({ type: z.literal("macos-app"), appName: z.string().min(1), path: z.string() });
const androidAppLaunchSchema = z.object({
  type: z.literal("android-app"),
  packageName: z.string().min(1).max(200),
  fallbackUrl: z.string().url().optional(),
});
const pathLaunchSchema = z.object({ type: z.literal("local-path"), path: z.string() });
const commandLaunchSchema = z.object({
  type: z.literal("custom-command"),
  executable: z.string().min(1),
  args: z.array(z.string()).max(30),
});

export const launchMethodSchema = z.discriminatedUnion("type", [
  websiteLaunchSchema,
  appLaunchSchema,
  androidAppLaunchSchema,
  pathLaunchSchema,
  commandLaunchSchema,
]);

export const toolSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  icon: z.string(),
  launch: launchMethodSchema,
  order: z.number().int().min(0),
  lastOpenedAt: timestamp.nullable(),
});

export const settingsSchema = z.object({
  theme: themeIdSchema,
  reducedMotion: z.boolean(),
  projectRoot: z.string(),
  preferredTerminal: z.string(),
  preferredEditor: z.string(),
  focusDuration: z.number().int().min(1).max(180).default(25),
  sidebarOrder: z.array(z.string()).default([]),
  // 自定义背景图：用户上传的图片以 dataURL/base64 存本地，不打包进 APK。
  // 为空时使用默认几何渐变背景。
  backgroundImage: z.string().default(""),
});

export const calendarEventSchema = z.object({
  id: z.string(), title: z.string().min(1), date: z.string(), time: z.string().default(""),
  description: z.string().default(""), createdAt: timestamp, updatedAt: timestamp,
});

export const noteSchema = z.object({
  id: z.string(), title: z.string().min(1), content: z.string().default(""),
  projectId: z.string().nullable().default(null), tags: z.array(z.string()).default([]),
  createdAt: timestamp, updatedAt: timestamp,
});

export const focusSessionSchema = z.object({
  id: z.string(), taskId: z.string().nullable(), durationMinutes: z.number().int().positive(),
  completedAt: timestamp,
});

export const workspaceSchema = z.object({
  version: z.literal(2),
  projects: z.array(projectSchema),
  todos: z.array(todoSchema),
  tools: z.array(toolSchema).default([]),
  events: z.array(calendarEventSchema).default([]),
  notes: z.array(noteSchema).default([]),
  focusSessions: z.array(focusSessionSchema).default([]),
  settings: settingsSchema,
  recentItems: z.array(z.object({ id: z.string(), type: z.enum(["project", "tool", "ai"]), openedAt: timestamp })),
  // AI 纯配置 + 对话
  aiModels: z.array(aiModelConfigSchema).default([]),
  aiConversations: z.array(aiConversationSchema).default([]),
  // 8 个生活工具
  ledgerAccounts: z.array(ledgerAccountSchema).default([]),
  ledgerTransactions: z.array(ledgerTransactionSchema).default([]),
  workouts: z.array(workoutSchema).default([]),
  fitnessGoals: z.array(fitnessGoalSchema).default([]),
  diaryEntries: z.array(diaryEntrySchema).default([]),
  courses: z.array(courseSchema).default([]),
  terms: z.array(termSchema).default([]),
  habits: z.array(habitSchema).default([]),
  habitChecks: z.array(habitCheckSchema).default([]),
  countdownEvents: z.array(countdownEventSchema).default([]),
  countdownCategories: z.array(countdownCategorySchema).default([]),
  books: z.array(bookSchema).default([]),
  vaultMeta: vaultMetaSchema.nullable().default(null),
  vaultEntries: z.array(vaultEntrySchema).default([]),
  updatedAt: timestamp,
});

export type WorkspaceData = z.infer<typeof workspaceSchema>;
export type Project = z.infer<typeof projectSchema>;
export type TodoItem = z.infer<typeof todoSchema>;
export type ToolItem = z.infer<typeof toolSchema>;
export type LaunchMethod = z.infer<typeof launchMethodSchema>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type NoteItem = z.infer<typeof noteSchema>;
export type FocusSession = z.infer<typeof focusSessionSchema>;
export type Settings = z.infer<typeof settingsSchema>;

export type PlatformKind = "android" | "desktop";

export function detectPlatform(): PlatformKind {
  const pinned = process.env.NEXT_PUBLIC_TARGET_PLATFORM;
  if (pinned === "android" || pinned === "desktop") return pinned;
  if (typeof navigator === "undefined") return "desktop";
  return /android/i.test(navigator.userAgent) ? "android" : "desktop";
}

// 默认工具列表为空，不预置任何境内外应用与网站
const DEFAULT_TOOLS: ToolItem[] = [];

export function launchDetail(launch: LaunchMethod): string {
  switch (launch.type) {
    case "website":
      return launch.url;
    case "macos-app":
      return launch.path;
    case "android-app":
      return launch.packageName;
    case "local-path":
      return launch.path;
    case "custom-command":
      return [launch.executable, ...launch.args].join(" ");
  }
}

export function createDefaultWorkspace(
  now = new Date().toISOString(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _platform: PlatformKind = detectPlatform(),
): WorkspaceData {
  return {
    version: 2,
    projects: [],
    todos: [],
    events: [],
    notes: [],
    focusSessions: [],
    tools: DEFAULT_TOOLS,
    settings: {
      theme: "default",
      reducedMotion: false,
      projectRoot: "",
      preferredTerminal: "Terminal",
      preferredEditor: "",
      focusDuration: 25,
      sidebarOrder: [],
      backgroundImage: "",
    },
    recentItems: [],
    aiModels: [],
    aiConversations: [],
    ledgerAccounts: [],
    ledgerTransactions: [],
    workouts: [],
    fitnessGoals: [],
    diaryEntries: [],
    courses: [],
    terms: [],
    habits: [],
    habitChecks: [],
    countdownEvents: [],
    countdownCategories: [],
    books: [],
    vaultMeta: null,
    vaultEntries: [],
    updatedAt: now,
  };
}
