import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiChatPage } from "./ai/chat";

describe("SOLARIS primary surfaces", () => {
  it("AI 对话页在未配置模型时展示引导而非任何预置服务", () => {
    render(<AiChatPage />);
    expect(screen.getByRole("heading", { name: "AI" })).toBeInTheDocument();
    // 不预置任何境外服务
    for (const name of ["Codex", "Gemini", "WorkBuddy", "豆包"]) {
      expect(screen.queryByRole("heading", { name })).not.toBeInTheDocument();
    }
  });
});
