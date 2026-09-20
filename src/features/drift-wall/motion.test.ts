import { describe, expect, it } from "vitest";
import { createDriftMotion, driftStyleVars, driftSway, shouldPauseDrift } from "./motion";

describe("createDriftMotion", () => {
  it("相同 seed → 完全相同参数（稳定，不依赖 Math.random）", () => {
    expect(createDriftMotion(7)).toEqual(createDriftMotion(7));
    expect(createDriftMotion(42).amplitude).toBe(createDriftMotion(42).amplitude);
  });

  it("不同 seed → 参数不同", () => {
    expect(createDriftMotion(1)).not.toEqual(createDriftMotion(2));
  });

  it("参数落在推荐范围（amplitude 4~10、duration 4.5~8、delay 0~3）", () => {
    for (const seed of [1, 2, 3, 10, 99, 512, 1234, 987654]) {
      const motion = createDriftMotion(seed);
      expect(motion.amplitude).toBeGreaterThanOrEqual(4);
      expect(motion.amplitude).toBeLessThanOrEqual(10);
      expect(motion.duration).toBeGreaterThanOrEqual(4.5);
      expect(motion.duration).toBeLessThanOrEqual(8);
      expect(motion.delay).toBeGreaterThanOrEqual(0);
      expect(motion.delay).toBeLessThanOrEqual(3);
    }
  });
});

describe("shouldPauseDrift", () => {
  it("拖拽 / 悬停 / reducedMotion 任一成立即暂停", () => {
    expect(shouldPauseDrift(false, false, false)).toBe(false);
    expect(shouldPauseDrift(true, false, false)).toBe(true);
    expect(shouldPauseDrift(false, true, false)).toBe(true);
    expect(shouldPauseDrift(false, false, true)).toBe(true);
  });
});

describe("driftSway / driftStyleVars", () => {
  it("横向呼吸幅度限制在 1~3px（Y 轴仍是主运动）", () => {
    expect(driftSway(4)).toBeCloseTo(1);
    expect(driftSway(10)).toBeCloseTo(3);
    expect(driftSway(7)).toBeGreaterThan(1);
    expect(driftSway(7)).toBeLessThan(3);
  });

  it("生成可挂到 style 的 CSS 变量", () => {
    const vars = driftStyleVars({ amplitude: 7, duration: 6, delay: 1, phase: 0 });
    expect(vars["--drift-amp"]).toBe("7.00px");
    expect(vars["--drift-duration"]).toBe("6.00s");
    expect(vars["--drift-delay"]).toBe("1.00s");
    expect(Number.parseFloat(vars["--drift-sway"])).toBeGreaterThanOrEqual(1);
  });
});
