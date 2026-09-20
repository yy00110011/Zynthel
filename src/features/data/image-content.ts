/**
 * 图片内容真实性校验。
 *
 * 完整 ZIP 备份恢复时，仅凭「扩展名」或 `blob.type` 判断一张图是不是图片是不可靠的：
 * 扩展名可以随便改，JSZip 又是按扩展名推断 MIME 的，而真实图片的 MIME 为空也很常见。
 * 因此这里以文件头（magic bytes）作为事实来源：只有真正是 PNG / JPEG / WebP 的内容才放行，
 * 并在 MIME 或扩展名与内容明显冲突时拒绝——避免把 HTML/JS/二进制垃圾当图片写进 IndexedDB。
 */

export type ImageFormat = "png" | "jpeg" | "webp";

const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** 读取文件头所需的字节数（覆盖 WebP 的 RIFF....WEBP 结构）。 */
const MAGIC_BYTES = 12;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]; // ‰PNG\r\n\x1a\n
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50]; // "WEBP"

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((byte, index) => bytes[index] === byte);
}

function startsAt(bytes: Uint8Array, offset: number, magic: number[]): boolean {
  if (bytes.length < offset + magic.length) return false;
  return magic.every((byte, index) => bytes[offset + index] === byte);
}

/** 按文件头判断真实格式；无法识别（文本 / HTML / 任意二进制）返回 null。 */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (startsWith(bytes, PNG_MAGIC)) return "png";
  if (startsWith(bytes, JPEG_MAGIC)) return "jpeg";
  if (startsWith(bytes, RIFF_MAGIC) && startsAt(bytes, 8, WEBP_MAGIC)) return "webp";
  return null;
}

/** MIME → 格式；未知或空返回 null。 */
export function formatFromMime(type: string | null | undefined): ImageFormat | null {
  if (!type) return null;
  const normalized = type.split(";")[0]!.trim().toLowerCase();
  for (const [format, mime] of Object.entries(MIME_BY_FORMAT)) {
    if (mime === normalized) return format as ImageFormat;
  }
  return null;
}

/** 扩展名 → 格式；未知返回 null。 */
export function formatFromExtension(extension: string | null | undefined): ImageFormat | null {
  if (!extension) return null;
  const normalized = extension.toLowerCase().replace(/^\./, "");
  if (normalized === "png") return "png";
  if (normalized === "jpg" || normalized === "jpeg") return "jpeg";
  if (normalized === "webp") return "webp";
  return null;
}

export function mimeFromFormat(format: ImageFormat): string {
  return MIME_BY_FORMAT[format];
}

export type ImageContentCheck =
  | { ok: true; format: ImageFormat; mime: string }
  | { ok: false; reason: "not-an-image" | "mime-conflict" | "extension-conflict" };

/**
 * 校验一个 Blob 是否真的是 PNG / JPEG / WebP。
 * - 内容不合法 → not-an-image
 * - 非空 MIME 与内容不符 → mime-conflict
 * - 扩展名与内容不符 → extension-conflict
 * MIME 为空时不作为拒绝理由（真实图片常见），只看内容。
 */
export async function validateImageContent(
  blob: Blob,
  options: { expectedMime?: string | null; expectedExtension?: string | null } = {},
): Promise<ImageContentCheck> {
  let head: Uint8Array;
  try {
    head = new Uint8Array(await blob.slice(0, MAGIC_BYTES).arrayBuffer());
  } catch {
    return { ok: false, reason: "not-an-image" };
  }

  const format = detectImageFormat(head);
  if (!format) return { ok: false, reason: "not-an-image" };

  const declared = formatFromMime(options.expectedMime ?? blob.type);
  if (declared !== null && declared !== format) return { ok: false, reason: "mime-conflict" };

  const byExtension = formatFromExtension(options.expectedExtension);
  if (byExtension !== null && byExtension !== format) return { ok: false, reason: "extension-conflict" };

  return { ok: true, format, mime: MIME_BY_FORMAT[format] };
}
