// 浮光墙图片处理：只接受普通位图（PNG/JPEG/WEBP），按 MIME 校验（不看扩展名）；
// 限制单张大小与像素；解码失败直接拒绝；下采样到最长边 1024 后生成：
//   - full：处理后的 Blob（存 IndexedDB，供完整备份）
//   - thumbnail：小尺寸 dataURL（存 workspace，用于同步渲染）
// 不处理 SVG / HTML / JS / 可执行内容，也不做任何外部嵌入。

export const DRIFT_WALL_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 单张 10MB
export const MAX_SOURCE_PIXELS = 40_000_000; // 源图 4000 万像素上限
export const MAX_FULL_EDGE = 1024; // 处理后的最长边
export const THUMB_EDGE = 192; // 缩略图最长边

export type ProcessImageError = "unsupported-type" | "too-large" | "decode-failed";

export type ProcessedImage = { full: Blob; thumbnail: string; width: number; height: number };

export type ProcessImageResult =
  | { ok: true; image: ProcessedImage }
  | { ok: false; error: ProcessImageError };

/** 仅接受 PNG / JPEG / WEBP 三种位图 MIME。 */
export function isAllowedImageMime(type: string): boolean {
  return (DRIFT_WALL_ALLOWED_TYPES as readonly string[]).includes(type);
}

/**
 * 纯校验：返回错误码或 null。与真实解码分开，便于单测。
 * 只依据 MIME（不看扩展名）。
 */
export function validateImageFile(file: { type: string; size: number }): ProcessImageError | null {
  if (!isAllowedImageMime(file.type)) return "unsupported-type";
  if (file.size > MAX_IMAGE_BYTES) return "too-large";
  if (file.size <= 0) return "decode-failed";
  return null;
}

export type DecodedImage = { source: CanvasImageSource; width: number; height: number };

/**
 * 释放解码资源。
 * 只有 `createImageBitmap()` 出来的 **ImageBitmap** 持有需要显式释放的解码缓冲（Android WebView
 * 上连续导入高分辨率图时若不释放会抬高内存峰值、增加 OOM 风险）；
 * HTMLImageElement fallback（老浏览器/不支持 createImageBitmap 时）**没有** close()，不能调用。
 */
export function releaseDecodedImage(decoded: DecodedImage | null): void {
  if (!decoded) return;
  const candidate = decoded.source as { close?: () => void } | null;
  if (candidate && typeof candidate.close === "function") candidate.close();
}

async function decodeImage(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  }
  if (typeof Image === "undefined") throw new Error("decode-unavailable");
  const url = URL.createObjectURL(file);
  try {
    const element = new Image();
    element.src = url;
    await (typeof element.decode === "function"
      ? element.decode()
      : new Promise<void>((resolve, reject) => {
          element.onload = () => resolve();
          element.onerror = () => reject(new Error("decode-failed"));
        }));
    return { source: element, width: element.naturalWidth, height: element.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawToCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no-2d-context");
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== "function") { reject(new Error("toBlob-unavailable")); return; }
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode-failed"))), "image/webp", quality);
  });
}

function fit(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** 读取文件 → 校验 → 解码 → 下采样 → 输出 { full, thumbnail }。任何一步失败都返回错误码。 */
export async function processImageFile(file: File): Promise<ProcessImageResult> {
  const invalid = validateImageFile(file);
  if (invalid) return { ok: false, error: invalid };

  let decoded: DecodedImage | null = null;
  try {
    decoded = await decodeImage(file);
    // createImageBitmap 不会被 SVG 解码成功；这里再兜一道尺寸合法性。
    if (!decoded.width || !decoded.height) return { ok: false, error: "decode-failed" };
    if (decoded.width * decoded.height > MAX_SOURCE_PIXELS) return { ok: false, error: "too-large" };

    const fullSize = fit(decoded.width, decoded.height, MAX_FULL_EDGE);
    const full = await canvasToBlob(drawToCanvas(decoded.source, fullSize.width, fullSize.height), 0.86);
    const thumbSize = fit(decoded.width, decoded.height, THUMB_EDGE);
    const thumbnail = drawToCanvas(decoded.source, thumbSize.width, thumbSize.height).toDataURL("image/webp", 0.7);
    return { ok: true, image: { full, thumbnail, width: fullSize.width, height: fullSize.height } };
  } catch {
    // 解码失败 / canvas 创建失败 / 绘制失败 / WebP 编码失败 / 缩略图失败：统一按解码失败返回，
    // 不把底层异常冒到 UI。
    return { ok: false, error: "decode-failed" };
  } finally {
    // 关键：所有出口（正常完成、像素超限、绘制失败、编码失败、中途抛异常）都必须释放 ImageBitmap。
    releaseDecodedImage(decoded);
  }
}
