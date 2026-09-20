import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createDefaultWorkspace } from "./schema";
import type { DriftWallItem, WorkspaceData } from "./schema";
import { buildFullBackup, parseFullBackup } from "./transfer";
import type { FullBackupDriftWallFile, FullBackupFile } from "./transfer";

const NOW = "2026-01-01T00:00:00.000Z";

function wallItem(id: string, imageData: string | null = "data:image/png;base64,AAAA"): DriftWallItem {
  return {
    id,
    imageData,
    x: 0.5,
    y: 0.5,
    size: 96,
    driftSeed: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function workspaceWith(items: DriftWallItem[]): WorkspaceData {
  const base = createDefaultWorkspace();
  return { ...base, driftWallItems: items };
}

/** 最小合法 PNG（1×1 透明像素，带 IEND 结束块）。 */
function pngBytes(markerByte = 0x01): Uint8Array<ArrayBuffer> {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdr = [0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0, 0, 0, 0];
  const idat = [0, 0, 0, 2, 0x49, 0x44, 0x41, 0x54, markerByte, 0x00];
  const iend = [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44];
  return new Uint8Array([...sig, ...ihdr, ...idat, ...iend]);
}

/** 最小合法 JPEG（SOI + EOI）。 */
function jpegBytes(): Uint8Array<ArrayBuffer> {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
}

/** 最小合法 WebP（RIFF....WEBP）。 */
function webpBytes(): Uint8Array<ArrayBuffer> {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x04, 0x00, 0x00, 0x00, // size
    0x57, 0x45, 0x42, 0x50, // WEBP
  ]);
}

/** 构造一张「真实」位图 blob：字节必须带正确的文件头（内容真实性校验只认文件头）。 */
function imageBlob(type: string, format: "png" | "jpeg" | "webp" = "png"): Blob {
  const bytes = format === "png" ? pngBytes() : format === "jpeg" ? jpegBytes() : webpBytes();
  return new Blob([bytes], { type });
}

async function bytesOf(blob: Blob): Promise<string> {
  return new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()));
}

/** 直接手工组装一个备份 ZIP，用于构造 transfer 层正常流程之外的异常输入。 */
async function rawZip(options: {
  marker?: string;
  workspace?: unknown;
  driftWall?: Record<string, string | Uint8Array>;
  books?: Record<string, string>;
}): Promise<Blob> {
  const zip = new JSZip();
  const workspace = options.workspace ?? workspaceWith([wallItem("w1")]);
  zip.file(
    "backup.json",
    JSON.stringify({
      marker: options.marker ?? "zynthel-full-backup",
      exportedAt: NOW,
      workspace,
    }),
  );
  for (const [name, content] of Object.entries(options.driftWall ?? {})) {
    zip.folder("drift-wall")!.file(name, content);
  }
  for (const [name, content] of Object.entries(options.books ?? {})) {
    zip.folder("books")!.file(name, content);
  }
  return zip.generateAsync({ type: "blob" });
}

describe("完整备份 · 浮光墙往返", () => {
  it("1. 导出包含浮光墙图片，且按 MIME 选择扩展名", async () => {
    const data = workspaceWith([wallItem("w1"), wallItem("w2")]);
    const blob = await buildFullBackup(data, [], [
      { itemId: "w1", blob: imageBlob("image/png", "png") },
      { itemId: "w2", blob: imageBlob("image/jpeg", "jpeg") },
    ]);
    const zip = await JSZip.loadAsync(blob);
    const names = Object.keys(zip.files).filter((n) => n.startsWith("drift-wall/") && !zip.files[n].dir);
    expect(names.sort()).toEqual(["drift-wall/w1.png", "drift-wall/w2.jpg"]);
  });

  it("2. 导出 → 解析后，浮光墙项与图片逐字节一致", async () => {
    const items = [wallItem("w1"), wallItem("w2")];
    const data = workspaceWith(items);
    const files: FullBackupDriftWallFile[] = [
      { itemId: "w1", blob: imageBlob("image/png", "png") },
      { itemId: "w2", blob: imageBlob("image/webp", "webp") },
    ];
    const result = await parseFullBackup(await buildFullBackup(data, [], files));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.driftWallFiles).toHaveLength(2);
    expect(result.data.driftWallItems).toEqual(items);
    const byId = new Map(result.driftWallFiles.map((f) => [f.itemId, f.blob]));
    expect(await bytesOf(byId.get("w1")!)).toBe(await bytesOf(files[0].blob));
    expect(await bytesOf(byId.get("w2")!)).toBe(await bytesOf(files[1].blob));
  });

  it("3. 空白占位项（imageData 为 null）不导出也不恢复图片", async () => {
    const data = workspaceWith([wallItem("blank", null)]);
    const zip = await JSZip.loadAsync(await buildFullBackup(data, [], [{ itemId: "blank", blob: imageBlob("image/png", "png") }]));
    // 导出的 ZIP 仍含该文件（导出不做过滤），但恢复时必须被忽略
    expect(Object.keys(zip.files)).toContain("drift-wall/blank.png");
    const result = await parseFullBackup(await rawZip({ workspace: data, driftWall: { "blank.png": pngBytes() } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.driftWallFiles).toEqual([]);
  });

  it("4. 孤儿图片（不在 driftWallItems 中）被忽略", async () => {
    const data = workspaceWith([wallItem("w1")]);
    const result = await parseFullBackup(
      await rawZip({
        workspace: data,
        driftWall: { "w1.png": pngBytes(), "deleted.png": pngBytes() },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.driftWallFiles.map((f) => f.itemId)).toEqual(["w1"]);
  });

  it("5. 同一 itemId 多份文件只取第一份", async () => {
    const data = workspaceWith([wallItem("w1")]);
    const result = await parseFullBackup(
      await rawZip({ workspace: data, driftWall: { "w1.png": pngBytes(0x01), "w1.jpg": jpegBytes() } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.driftWallFiles).toHaveLength(1);
    expect(await bytesOf(result.driftWallFiles[0].blob)).toBe(await bytesOf(new Blob([pngBytes(0x01)])));
  });

  it("6. 非位图扩展名被忽略（即使是同名 item）", async () => {
    const data = workspaceWith([wallItem("w1")]);
    const result = await parseFullBackup(
      await rawZip({ workspace: data, driftWall: { "w1.txt": "evil", "w1.exe": "evil" } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.driftWallFiles).toEqual([]);
  });

  it("7. 浮光墙图片与书籍文件同时恢复，互不干扰", async () => {
    const base = createDefaultWorkspace();
    const book = {
      id: "b1",
      title: "书",
      author: "",
      status: "reading" as const,
      rating: 0,
      progress: 0,
      note: "",
      source: "file" as const,
      fileName: "a.pdf",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const data: WorkspaceData = { ...base, books: [book], driftWallItems: [wallItem("w1")] };
    const bookFiles: FullBackupFile[] = [{ bookId: "b1", fileName: "a.pdf", blob: new Blob(["pdf-body"]) }];
    const wallFiles: FullBackupDriftWallFile[] = [{ itemId: "w1", blob: imageBlob("image/png", "png") }];
    const result = await parseFullBackup(await buildFullBackup(data, bookFiles, wallFiles));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.files.map((f) => f.bookId)).toEqual(["b1"]);
    expect(result.driftWallFiles.map((f) => f.itemId)).toEqual(["w1"]);
    expect(await bytesOf(result.driftWallFiles[0].blob)).toBe(await bytesOf(wallFiles[0].blob));
  });

  it("8. 没有 drift-wall 目录的旧备份仍可恢复（向后兼容）", async () => {
    const data = workspaceWith([wallItem("w1")]);
    const result = await parseFullBackup(await rawZip({ workspace: data, driftWall: {} }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.driftWallFiles).toEqual([]);
    expect(result.data.driftWallItems).toHaveLength(1);
  });
});

describe("完整备份 · 浮光墙防护", () => {
  it("9. 单张图片超过 8MB 时拒绝恢复（file-too-large）", async () => {
    const data = workspaceWith([wallItem("w1")]);
    const zip = new JSZip();
    zip.file("backup.json", JSON.stringify({ marker: "zynthel-full-backup", exportedAt: NOW, workspace: data }));
    // 真实 PNG 文件头 + 填充到超过 8MB，确保先通过内容校验、再命中大小上限
    const oversized = new Uint8Array(8 * 1024 * 1024 + 1);
    oversized.set(pngBytes());
    zip.folder("drift-wall")!.file("w1.png", oversized);
    const result = await parseFullBackup(await zip.generateAsync({ type: "blob" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("file-too-large");
  });

  it("10. 图片总量超过 80MB 时拒绝恢复（total-too-large）", async () => {
    const items = Array.from({ length: 11 }, (_, i) => wallItem(`w${i}`));
    const data = workspaceWith(items);
    const zip = new JSZip();
    zip.file("backup.json", JSON.stringify({ marker: "zynthel-full-backup", exportedAt: NOW, workspace: data }));
    const chunk = new Uint8Array(8 * 1024 * 1024);
    chunk.set(pngBytes());
    for (const item of items) zip.folder("drift-wall")!.file(`${item.id}.png`, chunk);
    const result = await parseFullBackup(await zip.generateAsync({ type: "blob" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("total-too-large");
  }, 30000);

  it("11. 非完整备份文件 / 损坏 ZIP / 错误 marker 一律拒绝", async () => {
    const data = workspaceWith([wallItem("w1")]);
    const badMarker = await parseFullBackup(
      await rawZip({ marker: "not-a-backup", workspace: data, driftWall: { "w1.png": "x" } }),
    );
    expect(badMarker.ok).toBe(false);
    if (!badMarker.ok) expect(badMarker.error).toBe("unsupported-data");

    const broken = await parseFullBackup(new Blob([new Uint8Array([1, 2, 3, 4, 5])]));
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.error).toBe("invalid-zip");

    const noManifest = await (async () => {
      const zip = new JSZip();
      zip.folder("drift-wall")!.file("w1.png", "x");
      return parseFullBackup(await zip.generateAsync({ type: "blob" }));
    })();
    expect(noManifest.ok).toBe(false);
    if (!noManifest.ok) expect(noManifest.error).toBe("unsupported-data");
  });

  it("12. 浮光墙图片数量超过 400 张时拒绝恢复（too-many-files）", async () => {
    const items = Array.from({ length: 401 }, (_, i) => wallItem(`w${i}`));
    const data = workspaceWith(items);
    const zip = new JSZip();
    zip.file("backup.json", JSON.stringify({ marker: "zynthel-full-backup", exportedAt: NOW, workspace: data }));
    for (const item of items) zip.folder("drift-wall")!.file(`${item.id}.png`, pngBytes());
    const result = await parseFullBackup(await zip.generateAsync({ type: "blob" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("too-many-files");
  });

  it("13. 超出 200MB 的 ZIP 在解包前即被拒绝（zip-too-large）", async () => {
    const oversized = { size: 200 * 1024 * 1024 + 1 } as unknown as Blob;
    const result = await parseFullBackup(oversized);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("zip-too-large");
  });
});

describe("完整备份 · 浮光墙图片内容真实性", () => {
  it("14. 合法 PNG 恢复成功", async () => {
    const data = workspaceWith([wallItem("w1")]);
    const result = await parseFullBackup(await rawZip({ workspace: data, driftWall: { "w1.png": pngBytes() } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.driftWallFiles).toHaveLength(1);
    expect(result.driftWallFiles[0].itemId).toBe("w1");
  });

  it("15. 合法 JPEG 恢复成功", async () => {
    const data = workspaceWith([wallItem("w1")]);
    const result = await parseFullBackup(await rawZip({ workspace: data, driftWall: { "w1.jpg": jpegBytes() } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.driftWallFiles).toHaveLength(1);
  });

  it("16. 合法 WebP 恢复成功", async () => {
    const data = workspaceWith([wallItem("w1")]);
    const result = await parseFullBackup(await rawZip({ workspace: data, driftWall: { "w1.webp": webpBytes() } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.driftWallFiles).toHaveLength(1);
  });

  it("17. 文本伪装成 .png 被拒绝", async () => {
    const data = workspaceWith([wallItem("w1")]);
    const result = await parseFullBackup(
      await rawZip({ workspace: data, driftWall: { "w1.png": "<script>alert(1)</script>" } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("unsupported-data");
  });

  it("18. 任意二进制伪装成 .jpg 被拒绝", async () => {
    const data = workspaceWith([wallItem("w1")]);
    const result = await parseFullBackup(
      await rawZip({ workspace: data, driftWall: { "w1.jpg": new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]) } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("unsupported-data");
  });

  it("19. MIME 为空的真图片仍被正确识别", async () => {
    // JSZip 对未知扩展名不会给 MIME，但内容是真的 PNG，不应因 MIME 为空被误拒
    const data = workspaceWith([wallItem("w1")]);
    const result = await parseFullBackup(await rawZip({ workspace: data, driftWall: { "w1.png": pngBytes() } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.driftWallFiles).toHaveLength(1);
  });

  it("20. MIME 为空的非法文件被拒绝", async () => {
    const data = workspaceWith([wallItem("w1")]);
    const result = await parseFullBackup(
      await rawZip({ workspace: data, driftWall: { "w1.png": "definitely not an image" } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("unsupported-data");
  });

  it("21. MIME / 扩展名 / 内容冲突被拒绝", async () => {
    // 内容是真的 PNG，但扩展名是 .jpg（MIME 会被 JSZip 推断为 image/jpeg）
    const data = workspaceWith([wallItem("w1")]);
    const result = await parseFullBackup(await rawZip({ workspace: data, driftWall: { "w1.jpg": pngBytes() } }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("unsupported-data");
  });
});
