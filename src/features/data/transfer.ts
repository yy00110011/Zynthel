import { validateImageContent } from "./image-content";
import { type WorkspaceData, workspaceSchema } from "./schema";

export type ImportResult =
  | { ok: true; data: WorkspaceData }
  | { ok: false; error: "invalid-json" | "unsupported-data" };

export function exportWorkspace(data: WorkspaceData): string {
  return JSON.stringify(workspaceSchema.parse(data), null, 2);
}

export function importWorkspace(value: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { ok: false, error: "invalid-json" };
  }
  const result = workspaceSchema.safeParse(parsed);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, error: "unsupported-data" };
}

/* ===== 完整备份（ZIP：workspace.json + 书籍文件） ===== */

export type FullBackupFile = { bookId: string; fileName: string; blob: Blob };
/** 浮光墙图片：以 item id 为键，存 drift-wall/ 目录。 */
export type FullBackupDriftWallFile = { itemId: string; blob: Blob };

const BACKUP_MARKER = "zynthel-full-backup";

// 恢复备份的资源限制（Android 平板合理默认，防止超大备份一次性载入内存导致 OOM）
const MAX_BACKUP_ZIP_BYTES = 200 * 1024 * 1024; // ZIP 文件总大小上限 200MB
const MAX_BACKUP_FILES = 500; // 书籍文件数量上限
const MAX_BACKUP_FILE_BYTES = 40 * 1024 * 1024; // 单个书籍文件解压上限 40MB
const MAX_BACKUP_TOTAL_BYTES = 150 * 1024 * 1024; // 全部书籍文件解压总量上限 150MB

// 浮光墙图片的独立限制（处理后的缩略图很小，但仍设上限防止异常备份）
const MAX_DRIFT_WALL_FILES = 400;
const MAX_DRIFT_WALL_FILE_BYTES = 8 * 1024 * 1024;
const MAX_DRIFT_WALL_TOTAL_BYTES = 80 * 1024 * 1024;
const DRIFT_WALL_IMAGE_EXTENSIONS = new Set(["webp", "png", "jpg", "jpeg"]);

function driftWallExtension(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  return "webp";
}

export type FullBackupParseError =
  | "invalid-zip"
  | "unsupported-data"
  | "zip-too-large"
  | "too-many-files"
  | "file-too-large"
  | "total-too-large";

export type FullBackupParseResult =
  | { ok: true; data: WorkspaceData; files: FullBackupFile[]; driftWallFiles: FullBackupDriftWallFile[] }
  | { ok: false; error: FullBackupParseError };

/** 打包完整备份：工作区数据 JSON + 本地书籍文件 + 浮光墙图片（均为 IndexedDB blob） */
export async function buildFullBackup(
  data: WorkspaceData,
  files: FullBackupFile[],
  driftWallFiles: FullBackupDriftWallFile[] = [],
): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file("backup.json", JSON.stringify({ marker: BACKUP_MARKER, exportedAt: new Date().toISOString(), workspace: workspaceSchema.parse(data) }, null, 2));
  if (files.length) {
    const folder = zip.folder("books")!;
    for (const f of files) folder.file(`${f.bookId}__${f.fileName.replace(/[/\\]/g, "_")}`, f.blob);
  }
  if (driftWallFiles.length) {
    const folder = zip.folder("drift-wall")!;
    for (const f of driftWallFiles) folder.file(`${f.itemId}.${driftWallExtension(f.blob.type)}`, f.blob);
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

/** 解析完整备份：返回工作区数据与书籍文件列表（供写入 IndexedDB）。带资源限制 + bookId 校验。 */
export async function parseFullBackup(file: Blob): Promise<FullBackupParseResult> {
  // 1. ZIP 文件大小限制（避免超大备份整体载入内存）
  if (file.size > MAX_BACKUP_ZIP_BYTES) return { ok: false, error: "zip-too-large" };

  let zip: InstanceType<typeof import("jszip")>;
  try {
    const JSZip = (await import("jszip")).default;
    zip = await JSZip.loadAsync(file);
  } catch {
    return { ok: false, error: "invalid-zip" };
  }
  const manifestEntry = zip.file("backup.json");
  if (!manifestEntry) return { ok: false, error: "unsupported-data" };
  let manifest: { marker?: string; workspace?: unknown };
  try {
    manifest = JSON.parse(await manifestEntry.async("string"));
  } catch {
    return { ok: false, error: "unsupported-data" };
  }
  if (manifest.marker !== BACKUP_MARKER) return { ok: false, error: "unsupported-data" };
  const parsed = workspaceSchema.safeParse(manifest.workspace);
  if (!parsed.success) return { ok: false, error: "unsupported-data" };

  // 2. 合法书籍映射：只恢复 workspace.books 中 source==="file" 且 fileName 非空的书籍。
  //    source==="manual"（手动录入）没有本地文件；fileName 为空说明元数据与文件不一致。
  const bookFileNames = new Map<string, string>();
  for (const book of parsed.data.books) {
    if (book.source === "file" && book.fileName) bookFileNames.set(book.id, book.fileName);
  }

  // 3. 遍历 books/ 目录：bookId 合法 + source 为 file + 文件名与元数据一致 + 无重复 + 文件名安全
  const entries: { bookId: string; fileName: string; entry: import("jszip").JSZipObject }[] = [];
  const seenBookIds = new Set<string>();
  zip.folder("books")?.forEach((relativePath: string, entry: import("jszip").JSZipObject) => {
    if (entry.dir) return;
    const sep = relativePath.indexOf("__");
    const bookId = sep > 0 ? relativePath.slice(0, sep) : relativePath;
    const fileName = sep > 0 ? relativePath.slice(sep + 2) : relativePath;
    // 忽略孤儿文件 / source!=="file" / fileName 为空的书籍
    const rawFileName = bookFileNames.get(bookId);
    if (rawFileName === undefined) return;
    // 异常文件名（含路径分隔符等）直接忽略
    if (!fileName || fileName.length > 200 || /[\\/]/.test(fileName)) return;
    // ZIP 条目文件名必须与元数据中的 fileName 一致（用打包时同样的清洗规则，保证旧备份可恢复），
    // 避免元数据与 Blob 不一致
    if (fileName !== rawFileName.replace(/[/\\]/g, "_")) return;
    // 防止重复 bookId：同一本书只取第一个合法文件
    if (seenBookIds.has(bookId)) return;
    seenBookIds.add(bookId);
    entries.push({ bookId, fileName, entry });
  });

  // 4. 文件数量限制
  if (entries.length > MAX_BACKUP_FILES) return { ok: false, error: "too-many-files" };

  // 5. 逐个解压，边解压边累计大小（不在内存中同时持有所有文件）
  const files: FullBackupFile[] = [];
  let totalBytes = 0;
  for (const { bookId, fileName, entry } of entries) {
    let blob: Blob;
    try {
      blob = await entry.async("blob");
    } catch {
      // ZIP 条目损坏、解压失败：不要冒到 UI，统一按损坏备份处理。
      return { ok: false, error: "invalid-zip" };
    }
    if (blob.size > MAX_BACKUP_FILE_BYTES) return { ok: false, error: "file-too-large" };
    totalBytes += blob.size;
    if (totalBytes > MAX_BACKUP_TOTAL_BYTES) return { ok: false, error: "total-too-large" };
    files.push({ bookId, fileName, blob });
  }

  // 6. 浮光墙图片：只恢复 workspace.driftWallItems 中「有图片」的项；id 必须匹配、去重、
  //    扩展名白名单、类型必须为 image/*、限制单张与总量（沿用同一套错误码，不削弱 ZIP 防护）。
  const driftWallIds = new Set(
    parsed.data.driftWallItems.filter((item) => item.imageData !== null).map((item) => item.id),
  );
  const wallEntries: { itemId: string; extension: string; entry: import("jszip").JSZipObject }[] = [];
  const seenWallIds = new Set<string>();
  zip.folder("drift-wall")?.forEach((relativePath: string, entry: import("jszip").JSZipObject) => {
    if (entry.dir) return;
    const dot = relativePath.lastIndexOf(".");
    if (dot <= 0) return;
    const itemId = relativePath.slice(0, dot);
    const extension = relativePath.slice(dot + 1).toLowerCase();
    if (itemId.length > 200) return;
    if (!driftWallIds.has(itemId)) return; // 孤儿文件 / 非图片项
    if (seenWallIds.has(itemId)) return; // 重复 id 只取第一个
    if (!DRIFT_WALL_IMAGE_EXTENSIONS.has(extension)) return; // 只接受位图扩展名
    seenWallIds.add(itemId);
    wallEntries.push({ itemId, extension, entry });
  });
  if (wallEntries.length > MAX_DRIFT_WALL_FILES) return { ok: false, error: "too-many-files" };

  const driftWallFiles: FullBackupDriftWallFile[] = [];
  let wallBytes = 0;
  for (const { itemId, extension, entry } of wallEntries) {
    let blob: Blob;
    try {
      blob = await entry.async("blob");
    } catch {
      return { ok: false, error: "invalid-zip" };
    }
    // 内容真实性校验：扩展名与 JSZip 推断的 MIME 都可以伪造，只有文件头是事实。
    // 真正是 PNG/JPEG/WebP 才放行；MIME 为空时只看内容；MIME/扩展名与内容冲突则拒绝。
    const content = await validateImageContent(blob, { expectedExtension: extension });
    if (!content.ok) return { ok: false, error: "unsupported-data" };
    if (blob.size > MAX_DRIFT_WALL_FILE_BYTES) return { ok: false, error: "file-too-large" };
    wallBytes += blob.size;
    if (wallBytes > MAX_DRIFT_WALL_TOTAL_BYTES) return { ok: false, error: "total-too-large" };
    driftWallFiles.push({ itemId, blob });
  }
  return { ok: true, data: parsed.data, files, driftWallFiles };
}

/** 触发浏览器下载备份文件（Tauri WebView 落到系统下载目录） */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4_000);
}
