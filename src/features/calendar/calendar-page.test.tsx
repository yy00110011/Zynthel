import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarPage } from "./calendar-page";

// 锁死「节日月份不偏移」：festivalsForDate 的 month 为 1-based（数据键即真实月份），
// 组件必须传入 getMonth()+1；否则会出现「九月视图显示八月节日」的错位。
describe("CalendarPage 节日与待办", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 19, 12, 0, 0)); // 2026-09-19
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("九月视图显示九月/十月节日，且不出现八月节日", () => {
    render(<CalendarPage />);
    // 九月网格（8/31–10/11）应包含：教师节(9/10)、中秋节(9/25)、国庆节(10/1)
    expect(screen.getByText("中秋节")).toBeInTheDocument();
    expect(screen.getByText("教师节")).toBeInTheDocument();
    expect(screen.getByText("国庆节")).toBeInTheDocument();
    // 八月节日（建军节 8/1、七夕 8/19）不在九月网格内，绝不应出现
    expect(screen.queryByText("建军节")).toBeNull();
    expect(screen.queryByText("七夕")).toBeNull();
  });

  it("提供月份导航与添加待办入口", () => {
    render(<CalendarPage />);
    expect(screen.getByRole("button", { name: "上一月" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一月" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "今天" })).toBeInTheDocument();
    // 点击任意日期进入「添加待办」态
    expect(screen.getByText("点击任意日期添加待办，勾选即完成（与任务同步）。")).toBeInTheDocument();
  });
});
