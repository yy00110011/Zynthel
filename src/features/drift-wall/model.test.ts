import { describe, expect, it } from "vitest";
import { createDefaultWorkspace, workspaceSchema } from "@/features/data/schema";
import { DRIFT_WALL_SIZES } from "./geometry";
import {
  addDriftWallItem,
  clearDriftWallItemImage,
  ensureDriftWallSeeded,
  moveDriftWallItem,
  removeDriftWallItem,
  setDriftWallSize,
  updateDriftWallItem,
} from "./model";

const base = () => createDefaultWorkspace("2026-01-01T00:00:00.000Z", "desktop");

describe("浮光墙数据模型", () => {
  it("首次进入自动生成 8 个占位；已有数据时不重复生成", () => {
    const seeded = ensureDriftWallSeeded(base());
    expect(seeded.driftWallItems).toHaveLength(8);
    expect(ensureDriftWallSeeded(seeded).driftWallItems).toHaveLength(8);
  });

  it("新增图片项并写入缩略图 dataURL", () => {
    const data = addDriftWallItem(
      base(),
      { imageData: "data:image/webp;base64,AAAA", size: DRIFT_WALL_SIZES.medium, driftSeed: 5 },
      "id-1",
    );
    expect(data.driftWallItems).toHaveLength(1);
    expect(data.driftWallItems[0].id).toBe("id-1");
    expect(data.driftWallItems[0].imageData).toBe("data:image/webp;base64,AAAA");
  });

  it("新增项未给坐标时自动寻找空位（不堆在左上角）", () => {
    const data = addDriftWallItem(base(), { size: DRIFT_WALL_SIZES.medium }, "id-pos");
    const item = data.driftWallItems[0];
    expect(item.x).toBeGreaterThan(0);
    expect(item.y).toBeGreaterThan(0);
    expect(item.x).not.toBe(0);
    expect(item.y).not.toBe(0);
  });

  it("拖动后保存归一化坐标", () => {
    let data = addDriftWallItem(base(), { size: DRIFT_WALL_SIZES.small }, "id-2");
    data = moveDriftWallItem(data, "id-2", 0.34, 0.62);
    expect(data.driftWallItems[0].x).toBeCloseTo(0.34);
    expect(data.driftWallItems[0].y).toBeCloseTo(0.62);
  });

  it("调整大小（小/中/大）", () => {
    let data = addDriftWallItem(base(), { size: DRIFT_WALL_SIZES.small }, "id-3");
    data = setDriftWallSize(data, "id-3", DRIFT_WALL_SIZES.large);
    expect(data.driftWallItems[0].size).toBe(DRIFT_WALL_SIZES.large);
  });

  it("更换图片", () => {
    let data = addDriftWallItem(base(), { imageData: "data:image/webp;base64,AAAA", size: DRIFT_WALL_SIZES.medium }, "id-4");
    data = updateDriftWallItem(data, "id-4", { imageData: "data:image/webp;base64,BBBB" });
    expect(data.driftWallItems[0].imageData).toBe("data:image/webp;base64,BBBB");
  });

  it("删除项", () => {
    let data = addDriftWallItem(base(), { size: DRIFT_WALL_SIZES.medium }, "id-5");
    data = removeDriftWallItem(data, "id-5");
    expect(data.driftWallItems).toHaveLength(0);
  });

  it("移除图片：只清空照片，圆形保留为空白占位（位置/大小/种子不变）", () => {
    let data = addDriftWallItem(
      base(),
      { imageData: "data:image/webp;base64,AAAA", x: 0.2, y: 0.4, size: DRIFT_WALL_SIZES.large, driftSeed: 9 },
      "id-photo",
    );
    data = clearDriftWallItemImage(data, "id-photo");
    // 圆形条目仍在，不能因移除照片而消失
    expect(data.driftWallItems).toHaveLength(1);
    expect(data.driftWallItems[0].id).toBe("id-photo");
    expect(data.driftWallItems[0].imageData).toBeNull();
    expect(data.driftWallItems[0].x).toBeCloseTo(0.2);
    expect(data.driftWallItems[0].y).toBeCloseTo(0.4);
    expect(data.driftWallItems[0].size).toBe(DRIFT_WALL_SIZES.large);
    expect(data.driftWallItems[0].driftSeed).toBe(9);
  });

  it("新增后的 workspace 可通过 schema 校验", () => {
    const data = addDriftWallItem(
      base(),
      { imageData: "data:image/webp;base64,AAAA", size: DRIFT_WALL_SIZES.medium, driftSeed: 3 },
      "id-6",
    );
    expect(workspaceSchema.safeParse(data).success).toBe(true);
  });

  it("旧版 workspace（无 driftWallItems 字段）仍可校验，默认补空数组（备份互导兼容）", () => {
    const legacy = { ...base() } as Record<string, unknown>;
    delete legacy.driftWallItems;
    const parsed = workspaceSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.driftWallItems).toEqual([]);
  });
});
