import type { ThemeId } from "../data/schema";

/** 主题预设：仅描述元信息与渐变预览，具体配色由 CSS 变量（theme-presets.css）承载。 */
export type ThemePreset = {
  id: ThemeId;
  label: string;
  /** 预览卡渐变，仅用于展示，不写入页面素材 */
  gradient: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  { id: "default", label: "默认", gradient: "linear-gradient(180deg,#eaf7f7 0%,#dceef0 100%)" },
  { id: "ink-blue", label: "砚蓝", gradient: "linear-gradient(180deg,#404D62 0%,#DDBECA 100%)" },
  { id: "rose-mist", label: "玫雾", gradient: "linear-gradient(180deg,#E87C8D 0%,#F9CB8E 100%)" },
  { id: "sakura-almond", label: "樱杏", gradient: "linear-gradient(180deg,#946368 0%,#F3D6BD 100%)" },
  { id: "moon-frost", label: "月霜", gradient: "linear-gradient(180deg,#B0B1CF 0%,#F1E2D2 100%)" },
  { id: "moss-peach", label: "苔桃", gradient: "linear-gradient(180deg,#A66191 0%,#F1E9DA 100%)" },
];

/** 非默认主题需要由 CSS 提供变量覆盖；这里用于统一判断。 */
export function isPresetTheme(theme: ThemeId): boolean {
  return theme !== "default";
}
