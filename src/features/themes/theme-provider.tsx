"use client";

import { useEffect } from "react";
import { useWorkspace } from "@/features/data/use-workspace";
import { applyTheme } from "./registry";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const data = useWorkspace();
  useEffect(() => {
    applyTheme(data.settings.theme);
    document.documentElement.dataset.reducedMotion = String(data.settings.reducedMotion);
  }, [data.settings.theme, data.settings.reducedMotion]);
  return children;
}
