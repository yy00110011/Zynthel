import { describe, it, expect } from "vitest";
import { festivalsForDate } from "./festivals";

describe("festivalsForDate", () => {
  it("公历固定节日：元旦、国庆、劳动节", () => {
    expect(festivalsForDate(2026, 1, 1).map((f) => f.name)).toContain("元旦");
    expect(festivalsForDate(2026, 10, 1).map((f) => f.name)).toContain("国庆节");
    expect(festivalsForDate(2026, 5, 1).map((f) => f.name)).toContain("劳动节");
  });

  it("农历节日：春节（2025-01-29）", () => {
    expect(festivalsForDate(2025, 1, 29).map((f) => f.name)).toContain("春节");
  });

  it("农历节日：中秋（2026-09-25）", () => {
    const f = festivalsForDate(2026, 9, 25).find((x) => x.name === "中秋节");
    expect(f).toBeDefined();
    expect(f?.type).toBe("lunar");
  });

  it("清明节：2024 和 2025 都在 04-04", () => {
    expect(festivalsForDate(2024, 4, 4).map((f) => f.name)).toContain("清明节");
    expect(festivalsForDate(2025, 4, 4).map((f) => f.name)).toContain("清明节");
  });

  it("普通日期无节日", () => {
    expect(festivalsForDate(2026, 3, 17)).toEqual([]);
  });

  it("超出农历对照表年份：只有公历节日", () => {
    // 2023 不在对照表，10-01 应只有公历国庆节
    const names = festivalsForDate(2023, 10, 1).map((f) => f.name);
    expect(names).toContain("国庆节");
    expect(names).not.toContain("中秋节");
  });
});
