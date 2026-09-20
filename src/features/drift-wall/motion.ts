// 浮光墙漂浮动画参数：由固定 seed 生成稳定参数（禁止在 render 时用 Math.random，
// 否则每次重渲染动画参数都会变）。动画本体交给 CSS transform/合成层，不用 rAF。

export interface DriftMotion {
  amplitude: number;
  duration: number;
  delay: number;
  phase: number;
}

/** 由 seed 生成一组稳定的漂浮参数：amplitude 4~10px、duration 4.5~8s、delay 0~3s。 */
export function createDriftMotion(seed: number): DriftMotion {
  const pseudo = (offset: number) => {
    const value = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
  return {
    amplitude: 4 + pseudo(1) * 6,
    duration: 4.5 + pseudo(2) * 3.5,
    delay: pseudo(3) * 3,
    phase: pseudo(4) * Math.PI * 2,
  };
}

/** 拖拽中 / hover / 系统要求减少动效时，暂停漂浮动画。 */
export function shouldPauseDrift(isDragging: boolean, isHovered: boolean, reducedMotion: boolean): boolean {
  return isDragging || isHovered || reducedMotion;
}

/** 横向呼吸幅度（1~3px），由纵向幅度派生，保证 Y 轴始终是主要运动方向。 */
export function driftSway(amplitude: number): number {
  const t = Math.min(1, Math.max(0, (amplitude - 4) / 6));
  return 1 + t * 2;
}

/** 生成挂到元素 style 上的 CSS 变量（供 drift-wall-float 关键帧消费）。 */
export function driftStyleVars(motion: DriftMotion): Record<string, string> {
  return {
    "--drift-amp": `${motion.amplitude.toFixed(2)}px`,
    "--drift-sway": `${driftSway(motion.amplitude).toFixed(2)}px`,
    "--drift-duration": `${motion.duration.toFixed(2)}s`,
    "--drift-delay": `${motion.delay.toFixed(2)}s`,
  };
}

/** 是否应当完全关闭漂浮（用户设置 reducedMotion）。 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** 订阅系统「减弱动态效果」偏好变化，供 useSyncExternalStore 使用（返回取消订阅函数）。 */
export function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  let query: MediaQueryList;
  try {
    query = window.matchMedia("(prefers-reduced-motion: reduce)");
  } catch {
    return () => {};
  }
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }
  // 旧版 Safari
  query.addListener(onChange);
  return () => query.removeListener(onChange);
}
