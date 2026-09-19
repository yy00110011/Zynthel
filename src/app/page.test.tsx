import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import HomePage from "./page";

it("renders the Zynthel final home greeting", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { name: "让今天变得更有意义。" })).toBeInTheDocument();
  expect(screen.getByText("专注于此刻，稳步向前。")).toBeInTheDocument();
});

it("renders every final home region in the reference layout", () => {
  const { container } = render(<HomePage />);
  expect(screen.getByRole("heading", { name: "今日任务" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "即将到来" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "最近项目" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "快捷应用" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "专注" })).toBeInTheDocument();
  // 背景层必须挂载，否则最终版视觉不成立
  expect(container.querySelector(".final-home > .scene-artwork")).not.toBeNull();
});

it("keeps every final home grid region mounted", () => {
  const { container } = render(<HomePage />);
  const home = container.querySelector(".final-home");
  expect(home).not.toBeNull();
  for (const region of [
    ".final-greeting",
    ".today-panel",
    ".calendar-panel",
    ".recent-panel",
    ".apps-panel",
    ".focus-panel",
  ]) {
    expect(home?.querySelector(region), `${region} 缺失`).not.toBeNull();
  }
});
