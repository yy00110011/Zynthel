"use client";

import { useEffect } from "react";
import { useWorkspace } from "@/features/data/use-workspace";

/**
 * 主题应用器：只把当前主题写到 <html data-theme>，配色全部由 CSS 变量承载。
 * 默认主题（default）在 CSS 中没有任何覆盖规则，因此不会改变原有视觉。
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const data = useWorkspace();
  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
  }, [data.settings.theme]);
  return children;
}
