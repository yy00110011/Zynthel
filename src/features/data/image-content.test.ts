import { describe, expect, it } from "vitest";
import {
  detectImageFormat,
  formatFromExtension,
  formatFromMime,
  validateImageContent,
} from "./image-content";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe("图片文件头识别", () => {
  it("识别 PNG / JPEG / WebP 的 magic bytes", () => {
    expect(detectImageFormat(PNG)).toBe("png");
    expect(detectImageFormat(JPEG)).toBe("jpeg");
    expect(detectImageFormat(WEBP)).toBe("webp");
  });

  it("文本 / HTML / 任意二进制都不是图片", () => {
    expect(detectImageFormat(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(detectImageFormat(new TextEncoder().encode("just plain text"))).toBeNull();
    expect(detectImageFormat(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]))).toBeNull();
    expect(detectImageFormat(new Uint8Array([]))).toBeNull();
  });

  it("MIME → 格式映射正确，未知/空返回 null", () => {
    expect(formatFromMime("image/png")).toBe("png");
    expect(formatFromMime("image/jpeg")).toBe("jpeg");
    expect(formatFromMime("image/webp")).toBe("webp");
    expect(formatFromMime("image/gif")).toBeNull();
    expect(formatFromMime("")).toBeNull();
    expect(formatFromMime(null)).toBeNull();
    expect(formatFromMime(undefined)).toBeNull();
  });

  it("扩展名 → 格式映射正确，未知/空返回 null", () => {
    expect(formatFromExtension("png")).toBe("png");
    expect(formatFromExtension(".png")).toBe("png");
    expect(formatFromExtension("jpg")).toBe("jpeg");
    expect(formatFromExtension("jpeg")).toBe("jpeg");
    expect(formatFromExtension("webp")).toBe("webp");
    expect(formatFromExtension("gif")).toBeNull();
    expect(formatFromExtension("")).toBeNull();
    expect(formatFromExtension(null)).toBeNull();
  });
});

describe("图片内容真实性校验", () => {
  it("真实 PNG 通过，即使 MIME 为空", async () => {
    const blob = new Blob([PNG]);
    const result = await validateImageContent(blob, { expectedExtension: "png" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.format).toBe("png");
    expect(result.mime).toBe("image/png");
  });

  it("MIME 与内容冲突时拒绝", async () => {
    const blob = new Blob([PNG], { type: "image/jpeg" });
    expect((await validateImageContent(blob)).ok).toBe(false);
  });

  it("扩展名与内容冲突时拒绝", async () => {
    const blob = new Blob([PNG], { type: "image/png" });
    expect((await validateImageContent(blob, { expectedExtension: "jpg" })).ok).toBe(false);
  });

  it("非图片内容拒绝（文本 / 二进制）", async () => {
    expect((await validateImageContent(new Blob(["hello world"]))).ok).toBe(false);
    expect((await validateImageContent(new Blob([new Uint8Array([1, 2, 3, 4, 5])]))).ok).toBe(false);
  });

  it("JPEG 与 WebP 也通过", async () => {
    expect((await validateImageContent(new Blob([JPEG]))).ok).toBe(true);
    expect((await validateImageContent(new Blob([WEBP]))).ok).toBe(true);
  });
});
