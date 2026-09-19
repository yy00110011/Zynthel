import path from "node:path";
import { z } from "zod";

const safeText = z.string().max(512).refine((value) => !/[\0\r\n]/.test(value), "不允许控制字符");
const absolutePath = safeText.refine((value) => path.isAbsolute(value), "路径必须为绝对路径");
const executable = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_+./-]+$/, "可执行文件名称包含不安全字符");

export const launcherBodySchema = z.object({ launch: z.discriminatedUnion("type", [
  z.object({ type: z.literal("macos-app"), appName: safeText.min(1), path: absolutePath }),
  z.object({ type: z.literal("local-path"), path: absolutePath }),
  z.object({ type: z.literal("custom-command"), executable, args: z.array(safeText).max(30) }),
]) }).strict();

export function validateLauncherBody(value: unknown) { return launcherBodySchema.safeParse(value); }
export type LauncherBody = z.infer<typeof launcherBodySchema>;
