import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_IMAGE_BYTES,
  MAX_SOURCE_PIXELS,
  isAllowedImageMime,
  processImageFile,
  releaseDecodedImage,
  validateImageFile,
} from "./image";

describe("图片安全校验（只看 MIME，不看扩展名）", () => {
  it("接受 PNG / JPEG / WEBP", () => {
    expect(isAllowedImageMime("image/png")).toBe(true);
    expect(isAllowedImageMime("image/jpeg")).toBe(true);
    expect(isAllowedImageMime("image/webp")).toBe(true);
  });

  it("拒绝 SVG / HTML / JS / PDF / GIF 等", () => {
    for (const type of ["image/svg+xml", "text/html", "application/javascript", "application/pdf", "image/gif", ""]) {
      expect(isAllowedImageMime(type)).toBe(false);
    }
  });

  it("validateImageFile：类型与大小", () => {
    expect(validateImageFile({ type: "image/png", size: 1024 })).toBeNull();
    expect(validateImageFile({ type: "image/webp", size: 1024 })).toBeNull();
    expect(validateImageFile({ type: "image/svg+xml", size: 1024 })).toBe("unsupported-type");
    expect(validateImageFile({ type: "text/html", size: 10 })).toBe("unsupported-type");
    expect(validateImageFile({ type: "image/png", size: MAX_IMAGE_BYTES + 1 })).toBe("too-large");
    expect(validateImageFile({ type: "image/png", size: 0 })).toBe("decode-failed");
  });
});

describe("processImageFile", () => {
  it("SVG（伪装安全类型）被直接拒绝，且不尝试解码", async () => {
    const file = new File(["<svg/>"], "evil.svg", { type: "image/svg+xml" });
    const result = await processImageFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("unsupported-type");
  });

  it("超大图片被拒绝", async () => {
    const fake = { type: "image/png", size: MAX_IMAGE_BYTES + 1 } as unknown as File;
    const result = await processImageFile(fake);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("too-large");
  });

  it("损坏图片解码失败被拒绝", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], "broken.png", { type: "image/png" });
    const result = await processImageFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("decode-failed");
  });
});

// ImageBitmap 持有需要显式释放的解码缓冲。Android WebView 连续导入高分辨率图时，
// 若任何路径漏掉 close()，内存峰值会抬高、增加 OOM 风险。
// jsdom 没有 createImageBitmap 与 canvas 实现，因此用 mock 覆盖「正常完成 / 各类失败」全部出口。
describe("ImageBitmap 资源释放（全部出口都必须 close）", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const originalBitmap = globals.createImageBitmap;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob as unknown;
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

  afterEach(() => {
    if (originalBitmap === undefined) delete globals.createImageBitmap;
    else globals.createImageBitmap = originalBitmap;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob as typeof HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
  });

  const makeFile = (type: string) => new File([new Uint8Array(64)], "pic.bin", { type });

  function installBitmap(width: number, height: number, closed: number[]) {
    globals.createImageBitmap = async () =>
      ({ width, height, close: () => { closed.push(1); } }) as unknown as ImageBitmap;
  }

  function installCanvas(options: { failContext?: boolean; failEncode?: boolean } = {}) {
    const context = { drawImage: () => {} };
    HTMLCanvasElement.prototype.getContext = (() => (options.failContext ? null : context)) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback) {
      if (options.failEncode) { callback(null); return; }
      callback(new Blob(["webp-bytes"], { type: "image/webp" }));
    } as unknown as typeof HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toDataURL = () => "data:image/webp;base64,AAAA";
  }

  it("PNG / JPEG / WEBP 正常处理，且各自释放一次", async () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      const closed: number[] = [];
      installBitmap(2000, 1000, closed);
      installCanvas();
      const result = await processImageFile(makeFile(type));
      expect(result.ok, `${type} 应处理成功`).toBe(true);
      expect(closed).toHaveLength(1);
    }
  });

  it("超过像素上限被拒绝，且仍然释放（失败路径不能漏 close）", async () => {
    const closed: number[] = [];
    installBitmap(MAX_SOURCE_PIXELS, 2, closed); // 远超 4000 万像素
    installCanvas();
    const result = await processImageFile(makeFile("image/png"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("too-large");
    expect(closed).toHaveLength(1);
  });

  it("canvas 创建失败被拒绝，且仍然释放", async () => {
    const closed: number[] = [];
    installBitmap(1000, 500, closed);
    installCanvas({ failContext: true });
    const result = await processImageFile(makeFile("image/png"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("decode-failed");
    expect(closed).toHaveLength(1);
  });

  it("WebP 编码失败被拒绝（异常不冒到 UI），且仍然释放", async () => {
    const closed: number[] = [];
    installBitmap(1000, 500, closed);
    installCanvas({ failEncode: true });
    const result = await processImageFile(makeFile("image/webp"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("decode-failed");
    expect(closed).toHaveLength(1);
  });

  it("超过 10MB 的文件在解码前就被拒绝，不会创建 ImageBitmap", async () => {
    let created = 0;
    globals.createImageBitmap = async () => { created += 1; throw new Error("不应调用"); };
    const file = new File([new Uint8Array(16)], "big.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: MAX_IMAGE_BYTES + 1 });
    const result = await processImageFile(file);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("too-large");
    expect(created).toBe(0);
  });

  it("releaseDecodedImage 对 HTMLImageElement fallback 不调用 close（兼容旧路径）", () => {
    const element = document.createElement("img");
    expect("close" in element).toBe(false);
    expect(() => releaseDecodedImage({ source: element, width: 10, height: 10 })).not.toThrow();
    expect(() => releaseDecodedImage(null)).not.toThrow();
  });
});
