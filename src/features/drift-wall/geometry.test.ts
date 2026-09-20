import { describe, expect, it } from "vitest";
import {
  clamp,
  createDefaultDriftWallItems,
  distance,
  findFreePosition,
  normalizedToPixels,
  pixelsToNormalized,
} from "./geometry";

describe("clamp", () => {
  it("把值限制在 [min,max] 内", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("坐标换算", () => {
  it("normalizedToPixels：归一化 → 像素", () => {
    expect(normalizedToPixels(0.5, 0.25, 1000, 800)).toEqual({ left: 500, top: 200 });
  });

  it("pixelsToNormalized：像素 → 归一化并 clamp", () => {
    expect(pixelsToNormalized(500, 200, 1000, 800)).toEqual({ x: 0.5, y: 0.25 });
    expect(pixelsToNormalized(-10, 900, 1000, 800)).toEqual({ x: 0, y: 1 });
  });

  it("画布尺寸为 0 时不产生 NaN", () => {
    expect(pixelsToNormalized(10, 10, 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it("换算可往返（改变窗口尺寸后构图保持）", () => {
    const normalized = { x: 0.34, y: 0.62 };
    const pixels = normalizedToPixels(normalized.x, normalized.y, 1200, 700);
    expect(pixelsToNormalized(pixels.left, pixels.top, 1200, 700)).toEqual(normalized);
  });
});

describe("distance", () => {
  it("返回欧氏距离", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("findFreePosition", () => {
  it("没有任何图片时返回第一个候选位置", () => {
    expect(findFreePosition([])).toEqual({ x: 0.14, y: 0.22 });
  });

  it("选择与现有图片最近邻距离最大的候选（避免重叠）", () => {
    const position = findFreePosition([{ x: 0.14, y: 0.22 }]);
    expect(distance(position, { x: 0.14, y: 0.22 })).toBeGreaterThan(0.5);
  });

  it("候选为空时回退到画布中心", () => {
    expect(findFreePosition([], [])).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("createDefaultDriftWallItems", () => {
  it("生成 8 个错落的空白占位圆", () => {
    const items = createDefaultDriftWallItems("2026-01-01T00:00:00.000Z");
    expect(items).toHaveLength(8);
    expect(new Set(items.map((item) => item.id)).size).toBe(8);
    expect(items.every((item) => item.imageData === null)).toBe(true);
    // 尺寸刻意略有差异
    expect(new Set(items.map((item) => item.size)).size).toBeGreaterThan(3);
    // 每个 seed 不同 → 漂浮节奏不同
    expect(new Set(items.map((item) => item.driftSeed)).size).toBe(8);
    // 坐标均落在画布内且错落
    expect(items.every((item) => item.x > 0 && item.x < 1 && item.y > 0 && item.y < 1)).toBe(true);
    expect(new Set(items.map((item) => `${item.x},${item.y}`)).size).toBe(8);
  });
});
