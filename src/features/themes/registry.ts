import type { ThemeId } from "../data/schema";

export type ThemeDefinition = {
  label: string;
  character: string;
  tokens: Record<"base" | "surface" | "surfaceStrong" | "text" | "muted" | "accent" | "accentSoft" | "border" | "glow" | "heroStart" | "heroEnd", string>;
};

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  default: {
    label: "默认", character: "Zynthel",
    tokens: { base: "#0d0b13", surface: "rgba(31,24,37,.62)", surfaceStrong: "rgba(38,29,44,.84)", text: "#fff8fb", muted: "#c8bbc6", accent: "#ff9fbe", accentSoft: "#ffd0de", border: "rgba(255,188,210,.3)", glow: "rgba(255,126,172,.24)", heroStart: "#331c32", heroEnd: "#17101f" },
  },
};

export function applyTheme(theme: ThemeId, root: HTMLElement = document.documentElement) {
  const definition = THEMES[theme];
  root.dataset.theme = theme;
  Object.entries(definition.tokens).forEach(([key, value]) => {
    root.style.setProperty(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
  });
}
