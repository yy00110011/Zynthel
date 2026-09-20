// 浮光墙数据模型：所有变更都返回新的 WorkspaceData（不可变更新）。

import type { DriftWallItem, WorkspaceData } from "@/features/data/schema";
import { createDefaultDriftWallItems, findFreePosition } from "./geometry";

function withItems(data: WorkspaceData, items: DriftWallItem[], now: string): WorkspaceData {
  return { ...data, driftWallItems: items, updatedAt: now };
}

/** 首次进入浮光墙（还没有任何数据）时自动生成 8 个空白占位圆。 */
export function ensureDriftWallSeeded(data: WorkspaceData, now = new Date().toISOString()): WorkspaceData {
  if (data.driftWallItems.length > 0) return data;
  return withItems(data, createDefaultDriftWallItems(now), now);
}

export type NewDriftWallItem = {
  imageData: string | null;
  x: number;
  y: number;
  size: number;
  driftSeed: number;
};

/** 新增一项（图片或占位）。未指定坐标时自动寻找空位。 */
export function addDriftWallItem(
  data: WorkspaceData,
  draft: Partial<NewDriftWallItem> & { size: number },
  id = crypto.randomUUID(),
  now = new Date().toISOString(),
): WorkspaceData {
  const position = draft.x !== undefined && draft.y !== undefined
    ? { x: draft.x, y: draft.y }
    : findFreePosition(data.driftWallItems);
  const item: DriftWallItem = {
    id,
    imageData: draft.imageData ?? null,
    x: position.x,
    y: position.y,
    size: draft.size,
    driftSeed: draft.driftSeed ?? Math.random() * 1000,
    createdAt: now,
    updatedAt: now,
  };
  return withItems(data, [...data.driftWallItems, item], now);
}

export function updateDriftWallItem(
  data: WorkspaceData,
  id: string,
  patch: Partial<Omit<DriftWallItem, "id" | "createdAt">>,
  now = new Date().toISOString(),
): WorkspaceData {
  return withItems(data, data.driftWallItems.map((item) =>
    item.id === id ? { ...item, ...patch, updatedAt: now } : item), now);
}

/** 拖动结束：保存归一化坐标。 */
export function moveDriftWallItem(
  data: WorkspaceData,
  id: string,
  x: number,
  y: number,
  now = new Date().toISOString(),
): WorkspaceData {
  return updateDriftWallItem(data, id, { x, y }, now);
}

/** 右键菜单「调整大小」。 */
export function setDriftWallSize(
  data: WorkspaceData,
  id: string,
  size: number,
  now = new Date().toISOString(),
): WorkspaceData {
  return updateDriftWallItem(data, id, { size }, now);
}

/** 右键菜单「移除图片」：只清空照片，圆形退回空白占位（保留位置/大小/漂移种子）。 */
export function clearDriftWallItemImage(
  data: WorkspaceData,
  id: string,
  now = new Date().toISOString(),
): WorkspaceData {
  return updateDriftWallItem(data, id, { imageData: null }, now);
}

export function removeDriftWallItem(
  data: WorkspaceData,
  id: string,
  now = new Date().toISOString(),
): WorkspaceData {
  return withItems(data, data.driftWallItems.filter((item) => item.id !== id), now);
}
