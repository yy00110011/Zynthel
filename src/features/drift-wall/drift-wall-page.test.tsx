import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { workspaceRepository } from "@/features/data/repository";
import { DriftWallPage } from "./drift-wall-page";
import { addDriftWallItem } from "./model";

// 锁死浮光墙的交互骨架：首次进入 8 个占位圆、顶部添加按钮、右键菜单可移除。
describe("浮光墙页面", () => {
  beforeEach(() => {
    localStorage.clear();
    workspaceRepository.reset();
  });

  it("首次进入渲染 8 个占位圆与顶部添加按钮", () => {
    const { container } = render(<DriftWallPage />);
    expect(screen.getByRole("heading", { name: "浮光墙" })).toBeInTheDocument();
    expect(container.querySelectorAll(".drift-item")).toHaveLength(8);
    expect(container.querySelectorAll(".drift-item.placeholder")).toHaveLength(8);
    // 顶部「添加图片」按钮（占位圆也用同名无障碍标签，故按类名定位头部按钮）
    const addButton = container.querySelector(".drift-add-btn") as HTMLElement;
    expect(addButton).toBeInTheDocument();
    expect(addButton.textContent).toContain("添加图片");
    expect(container.querySelector(".drift-board")).toBeInTheDocument();
  });

  it("占位圆可被点击（进入选图流程）且带无障碍标签", () => {
    const { container } = render(<DriftWallPage />);
    const first = container.querySelector(".drift-item") as HTMLElement;
    expect(first.getAttribute("role")).toBe("button");
    expect(first.getAttribute("aria-label")).toBe("添加图片");
    expect(() => fireEvent.click(first)).not.toThrow();
  });

  it("右键占位圆弹出菜单，移除后画布上的圆减少一个", () => {
    const { container } = render(<DriftWallPage />);
    const first = container.querySelector(".drift-item") as HTMLElement;
    fireEvent.contextMenu(first, { clientX: 20, clientY: 20 });
    // 占位状态下菜单只提供「添加图片 / 移除占位」，不提供「调整大小」
    expect(screen.getByText("移除占位")).toBeInTheDocument();
    expect(screen.queryByText("调整大小")).toBeNull();

    fireEvent.click(screen.getByText("移除占位"));
    expect(container.querySelectorAll(".drift-item")).toHaveLength(7);
  });

  it("有图圆形「移除图片」后圆形不消失，退回空白占位", () => {
    // 预置一个带缩略图的圆形（测试环境无 IndexedDB，全图清理走「忽略失败」分支）
    workspaceRepository.set(
      addDriftWallItem(workspaceRepository.get(), { imageData: "data:image/png;base64,iVBORw0KGgo=", size: 120, driftSeed: 1 }, "wall-photo-1"),
    );
    const { container } = render(<DriftWallPage />);
    expect(container.querySelectorAll(".drift-item")).toHaveLength(1);
    expect(container.querySelectorAll(".drift-item.has-image")).toHaveLength(1);

    fireEvent.contextMenu(container.querySelector(".drift-item") as HTMLElement, { clientX: 20, clientY: 20 });
    expect(screen.getByText("移除图片")).toBeInTheDocument();
    expect(screen.queryByText("移除占位")).toBeNull();

    fireEvent.click(screen.getByText("移除图片"));

    // 圆形仍在画布上，只是退回带「+」的空白占位
    expect(container.querySelectorAll(".drift-item")).toHaveLength(1);
    expect(container.querySelectorAll(".drift-item.placeholder")).toHaveLength(1);
    expect(container.querySelectorAll(".drift-item.has-image")).toHaveLength(0);
    expect(workspaceRepository.get().driftWallItems[0].imageData).toBeNull();
  });

  it("画布上存在漂浮动画载体（内层 drift-float）", () => {
    const { container } = render(<DriftWallPage />);
    expect(container.querySelectorAll(".drift-float")).toHaveLength(8);
  });
});
