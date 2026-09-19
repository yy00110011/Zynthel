import type { ThemeId } from "../data/schema";

export type ThemeDefinition = {
  label: string;
  character: string;
  tokens: Record<"base" | "surface" | "surfaceStrong" | "text" | "muted" | "accent" | "accentSoft" | "border" | "glow" | "heroStart" | "heroEnd", string>;
};

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  "peach-bloom": {
    label: "蜜桃 · 晨曦", character: "Peach",
    tokens: { base: "#0d0b13", surface: "rgba(31,24,37,.62)", surfaceStrong: "rgba(38,29,44,.84)", text: "#fff8fb", muted: "#c8bbc6", accent: "#ff9fbe", accentSoft: "#ffd0de", border: "rgba(255,188,210,.3)", glow: "rgba(255,126,172,.24)", heroStart: "#331c32", heroEnd: "#17101f" },
  },
  "dark-purple": {
    label: "幽紫 · 夜幕", character: "Violet",
    tokens: { base: "#0b0913", surface: "rgba(25,20,40,.64)", surfaceStrong: "rgba(31,24,50,.84)", text: "#fbf7ff", muted: "#bdb3cf", accent: "#b894ff", accentSoft: "#d8c8ff", border: "rgba(190,157,255,.3)", glow: "rgba(132,84,230,.26)", heroStart: "#281a45", heroEnd: "#100d1c" },
  },
  ember: {
    label: "余烬 · 暖阳", character: "Ember",
    tokens: { base: "#120b0d", surface: "rgba(39,24,26,.64)", surfaceStrong: "rgba(48,29,30,.84)", text: "#fff9f6", muted: "#ccb9b2", accent: "#ff8f75", accentSoft: "#ffc0ad", border: "rgba(255,158,129,.3)", glow: "rgba(238,83,54,.24)", heroStart: "#4a201c", heroEnd: "#1b0d12" },
  },
};

export function applyTheme(theme: ThemeId, root: HTMLElement = document.documentElement) {
  const definition = THEMES[theme];
  root.dataset.theme = theme;
  Object.entries(definition.tokens).forEach(([key, value]) => {
    root.style.setProperty(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value);
  });
}
