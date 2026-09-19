import { z } from "zod";

const timestamp = z.string();

/* ===== 记账本 bookkeeping ===== */
export const ledgerAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  icon: z.string().default("wallet"),
  createdAt: timestamp,
});

export const ledgerTransactionSchema = z.object({
  id: z.string().min(1),
  amount: z.number().int(), // 金额以「分」存储，避免浮点误差
  type: z.enum(["income", "expense"]),
  category: z.string().trim().min(1).max(40),
  accountId: z.string().min(1),
  date: z.string(), // YYYY-MM-DD
  note: z.string().default(""),
  tags: z.array(z.string().trim().min(1)).default([]),
  createdAt: timestamp,
});

/* ===== 健身打卡 fitness ===== */
export const workoutSchema = z.object({
  id: z.string().min(1),
  date: z.string(),
  exercise: z.string().trim().min(1).max(60),
  durationMinutes: z.number().int().positive(),
  sets: z.number().int().min(0).default(0),
  reps: z.number().int().min(0).default(0),
  note: z.string().default(""),
  createdAt: timestamp,
});

export const fitnessGoalSchema = z.object({
  id: z.string().min(1),
  period: z.enum(["weekly", "monthly"]),
  targetMinutes: z.number().int().positive(),
  targetDays: z.number().int().positive(),
});

/* ===== 日记 diary ===== */
export const diaryEntrySchema = z.object({
  id: z.string().min(1),
  date: z.string(),
  title: z.string().trim().max(120).default(""),
  body: z.string().default(""),
  mood: z.enum(["great", "good", "okay", "low", "bad"]),
  weather: z.string().default(""),
  tags: z.array(z.string().trim().min(1)).default([]),
  createdAt: timestamp,
  updatedAt: timestamp,
});

/* ===== 课程表 schedule ===== */
export const courseSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  room: z.string().default(""),
  teacher: z.string().default(""),
  weekday: z.number().int().min(1).max(7),
  startTime: z.string(),
  endTime: z.string(),
  weeks: z.array(z.number().int().min(1).max(20)).default([]),
  termId: z.string().default(""),
  createdAt: timestamp,
});

export const termSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  startDate: z.string(),
  endDate: z.string(),
});

/* ===== 习惯打卡 habits ===== */
export const habitSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  icon: z.string().default("droplet"),
  frequency: z.enum(["daily", "weekly", "custom"]).default("daily"),
  remind: z.boolean().default(false),
  createdAt: timestamp,
});

export const habitCheckSchema = z.object({
  habitId: z.string().min(1),
  date: z.string(),
  done: z.boolean(),
});

/* ===== 倒数日 countdown ===== */
export const countdownEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(80),
  targetDate: z.string(),
  mode: z.enum(["countdown", "countup"]).default("countdown"),
  pinned: z.boolean().default(false),
  repeatRule: z.enum(["none", "annual"]).default("none"),
  categoryId: z.string().default(""),
  createdAt: timestamp,
});

export const countdownCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  icon: z.string().default("flag"),
});

/* ===== 阅读清单 readingList ===== */
export const bookSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  author: z.string().trim().max(120).default(""),
  status: z.enum(["want", "reading", "finished"]).default("want"),
  rating: z.number().int().min(0).max(5).default(0),
  progress: z.number().int().min(0).max(100).default(0),
  note: z.string().default(""),
  createdAt: timestamp,
  updatedAt: timestamp,
});

/* ===== 密码本 vault ===== */
export const vaultMetaSchema = z.object({
  salt: z.string(),
  iv: z.string(),
  // 限制合理范围，防止损坏/恶意导入的极端 iterations 导致解锁长时间卡死。
  iterations: z.number().int().min(100_000).max(1_000_000),
  verifier: z.string(), // 用于校验主密码是否正确
});

export const vaultEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(80),
  username: z.string().default(""),
  passwordCipher: z.string(), // AES-GCM 加密后的 base64
  urlCipher: z.string(),
  noteCipher: z.string(),
  // 每个敏感字段独立 IV（默认空字符串兼容旧数据，旧数据回退 vaultMeta.iv 解密）。
  passwordIv: z.string().default(""),
  urlIv: z.string().default(""),
  noteIv: z.string().default(""),
  category: z.string().default(""),
  createdAt: timestamp,
});

export type LedgerAccount = z.infer<typeof ledgerAccountSchema>;
export type LedgerTransaction = z.infer<typeof ledgerTransactionSchema>;
export type Workout = z.infer<typeof workoutSchema>;
export type FitnessGoal = z.infer<typeof fitnessGoalSchema>;
export type DiaryEntry = z.infer<typeof diaryEntrySchema>;
export type Course = z.infer<typeof courseSchema>;
export type Term = z.infer<typeof termSchema>;
export type Habit = z.infer<typeof habitSchema>;
export type HabitCheck = z.infer<typeof habitCheckSchema>;
export type CountdownEvent = z.infer<typeof countdownEventSchema>;
export type CountdownCategory = z.infer<typeof countdownCategorySchema>;
export type Book = z.infer<typeof bookSchema>;
export type VaultMeta = z.infer<typeof vaultMetaSchema>;
export type VaultEntry = z.infer<typeof vaultEntrySchema>;
