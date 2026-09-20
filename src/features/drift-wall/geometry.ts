// 浮光墙几何工具：归一化坐标 ↔ 像素、距离、自动寻找空位、默认占位圆。
// 位置一律以归一化坐标（0~1）保存，窗口尺寸变化后构图仍能保持。

import type { DriftWallItem } from "@/features/data/schema";

/** 圆形尺寸档位（小 / 中 / 大），不允许无限放大。 */
export const DRIFT_WALL_SIZES = { small: 64, medium: 82, large: 104 } as const;
export type DriftWallSizeKey = keyof typeof DRIFT_WALL_SIZES;

/** 一组自然错位的候选位置（非严格网格），用于自动放置新图片。 */
export const DRIFT_WALL_POSITIONS: { x: number; y: number }[] = [
  { x: 0.14, y: 0.22 },
  { x: 0.35, y: 0.14 },
  { x: 0.58, y: 0.25 },
  { x: 0.79, y: 0.16 },
  { x: 0.22, y: 0.48 },
  { x: 0.46, y: 0.42 },
  { x: 0.70, y: 0.52 },
  { x: 0.12, y: 0.72 },
  { x: 0.37, y: 0.68 },
  { x: 0.61, y: 0.76 },
  { x: 0.84, y: 0.66 },
];

/** 首次进入浮光墙时自动生成的 8 个占位圆尺寸（刻意略有差异，更自然）。 */
const SEED_SIZES = [72, 88, 76, 96, 82, 72, 92, 80];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 归一化坐标 → 像素位置（左上角）。 */
export function normalizedToPixels(x: number, y: number, boardWidth: number, boardHeight: number) {
  return { left: x * boardWidth, top: y * boardHeight };
}

/** 像素位置 → 归一化坐标（自动 clamp 到 0~1，避免拖出墙外）。 */
export function pixelsToNormalized(left: number, top: number, boardWidth: number, boardHeight: number) {
  if (boardWidth <= 0 || boardHeight <= 0) return { x: 0, y: 0 };
  return { x: clamp(left / boardWidth, 0, 1), y: clamp(top / boardHeight, 0, 1) };
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 选出一个与现有图片「最近邻距离最大」的候选位置，避免新图片堆在角落或互相重叠。
 * 无现有图片时直接返回第一个候选。
 */
export function findFreePosition(
  existingItems: Pick<DriftWallItem, "x" | "y">[],
  candidates: { x: number; y: number }[] = DRIFT_WALL_POSITIONS,
): { x: number; y: number } {
  if (candidates.length === 0) return { x: 0.5, y: 0.5 };
  if (existingItems.length === 0) return candidates[0];
  let best = candidates[0];
  let bestDistance = -1;
  for (const candidate of candidates) {
    const nearest = Math.min(
      ...existingItems.map((item) => distance(candidate, { x: item.x, y: item.y })),
    );
    if (nearest > bestDistance) {
      bestDistance = nearest;
      best = candidate;
    }
  }
  return best;
}

/** 首屏 8 个空白占位圆（错落、尺寸略有差异、各自不同 driftSeed）。 */
export function createDefaultDriftWallItems(now = new Date().toISOString()): DriftWallItem[] {
  return DRIFT_WALL_POSITIONS.slice(0, 8).map((position, index) => ({
    id: `dw-seed-${String(index + 1).padStart(2, "0")}`,
    imageData: null,
    x: position.x,
    y: position.y,
    size: SEED_SIZES[index] ?? DRIFT_WALL_SIZES.medium,
    driftSeed: index + 1,
    createdAt: now,
    updatedAt: now,
  }));
}
