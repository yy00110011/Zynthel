import { describe, expect, it } from "vitest";
import { currentTermWeek, parseLocalDate, wholeDaysBetween } from "./schedule-page";

// 用固定「今天」注入，覆盖第 1 周 / 周日周一 / 跨月 / 跨年 / 第 20 周 / 第 21 周后 / 时区边界
const term = { name: "测试学期", startDate: "2026-09-07", endDate: "2027-01-31" }; // 周一开学

describe("parseLocalDate", () => {
  it("解析 yyyy-MM-dd 为本地 0 点日期", () => {
    const d = parseLocalDate("2026-09-07")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // 9 月 = 下标 8
    expect(d.getDate()).toBe(7);
    expect(d.getHours()).toBe(0);
  });
  it("非法格式返回 null", () => {
    expect(parseLocalDate("2026/09/07")).toBeNull();
    expect(parseLocalDate("abc")).toBeNull();
    expect(parseLocalDate("")).toBeNull();
  });
});

describe("wholeDaysBetween", () => {
  it("跨月/跨年用整数天数差", () => {
    const from = new Date(2026, 8, 7); // 9月7日
    expect(wholeDaysBetween(from, new Date(2026, 8, 7))).toBe(0);
    expect(wholeDaysBetween(from, new Date(2026, 8, 8))).toBe(1);
    expect(wholeDaysBetween(from, new Date(2026, 9, 7))).toBe(30); // 跨月
    expect(wholeDaysBetween(new Date(2026, 11, 31), new Date(2027, 0, 1))).toBe(1); // 跨年
  });
});

describe("currentTermWeek", () => {
  it("第 1 周（开学当天）", () => {
    expect(currentTermWeek([term], new Date(2026, 8, 7))?.week).toBe(1);
  });
  it("第 1 周最后一天（周日）", () => {
    expect(currentTermWeek([term], new Date(2026, 8, 13))?.week).toBe(1);
  });
  it("周日→周一 进入第 2 周", () => {
    expect(currentTermWeek([term], new Date(2026, 8, 13))?.week).toBe(1);
    expect(currentTermWeek([term], new Date(2026, 8, 14))?.week).toBe(2);
  });
  it("第 20 周", () => {
    // 开学日 + 19 周 = 2026-09-07 + 133 天 = 2027-01-18
    expect(currentTermWeek([term], new Date(2027, 0, 18))?.week).toBe(20);
  });
  it("第 21 周之后封顶为 20", () => {
    expect(currentTermWeek([term], new Date(2027, 0, 25))?.week).toBe(20);
    expect(currentTermWeek([term], new Date(2027, 0, 31))?.week).toBe(20);
  });
  it("跨年学期仍正确", () => {
    const crossYear = { name: "跨年", startDate: "2026-12-28", endDate: "2027-02-28" };
    expect(currentTermWeek([crossYear], new Date(2027, 0, 4))?.week).toBe(2); // 2027-01-04 是第 2 周
  });
  it("不在任何学期内返回 null", () => {
    expect(currentTermWeek([term], new Date(2026, 8, 6))).toBeNull(); // 开学前一天
    expect(currentTermWeek([term], new Date(2027, 1, 1))).toBeNull(); // 学期结束后
  });
  it("学期起止日期非法时跳过", () => {
    expect(currentTermWeek([{ name: "坏", startDate: "bad", endDate: "2027-01-31" }], new Date(2026, 8, 7))).toBeNull();
  });
});
