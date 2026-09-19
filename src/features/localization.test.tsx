import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiChatPage } from "./ai/chat";

describe("中文界面", () => {
  it("AI 对话页未配置模型时给出中文引导文案", () => {
    render(<AiChatPage />);
    expect(screen.getByRole("heading", { name: "AI" })).toBeInTheDocument();
    expect(screen.getByText(/尚未配置模型/)).toBeInTheDocument();
  });
});
