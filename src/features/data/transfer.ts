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

const BACKUP_MARKER = "zynthel-full-backup";

// 恢复备份的资源限制（Android 平板合理默认，防止超大备份一次性载入内存导致 OOM）
const MAX_BACKUP_ZIP_BYTES = 200 * 1024 * 1024; // ZIP 文件总大小上限 200MB
const MAX_BACKUP_FILES = 500; // 书籍文件数量上限
const MAX_BACKUP_FILE_BYTES = 40 * 1024 * 1024; // 单个书籍文件解压上限 40MB
const MAX_BACKUP_TOTAL_BYTES = 150 * 1024 * 1024; // 全部书籍文件解压总量上限 150MB

export type FullBackupParseError =
  | "invalid-zip"
  | "unsupported-data"
  | "zip-too-large"
  | "too-many-files"
  | "file-too-large"
  | "total-too-large";

export type FullBackupParseResult =
  | { ok: true; data: WorkspaceData; files: FullBackupFile[] }
  | { ok: false; error: FullBackupParseError };

/** 打包完整备份：工作区数据 JSON + 本地书籍文件（IndexedDB blob） */
export async function buildFullBackup(data: WorkspaceData, files: FullBackupFile[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file("backup.json", JSON.stringify({ marker: BACKUP_MARKER, exportedAt: new Date().toISOString(), workspace: workspaceSchema.parse(data) }, null, 2));
  if (files.length) {
    const folder = zip.folder("books")!;
    for (const f of files) folder.file(`${f.bookId}__${f.fileName.replace(/[/\\]/g, "_")}`, f.blob);
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

  // 2. 合法的 bookId 集合（仅恢复 workspace.books 中存在的书籍对应的文件）
  const validBookIds = new Set(parsed.data.books.map((b) => b.id));

  // 3. 遍历 books/ 目录：只收集合法 bookId、无重复、文件名安全的条目
  const entries: { bookId: string; fileName: string; entry: import("jszip").JSZipObject }[] = [];
  const seenBookIds = new Set<string>();
  zip.folder("books")?.forEach((relativePath: string, entry: import("jszip").JSZipObject) => {
    if (entry.dir) return;
    const sep = relativePath.indexOf("__");
    const bookId = sep > 0 ? relativePath.slice(0, sep) : relativePath;
    const fileName = sep > 0 ? relativePath.slice(sep + 2) : relativePath;
    // 忽略孤儿文件：bookId 不在 workspace.books 中
    if (!validBookIds.has(bookId)) return;
    // 防止重复 bookId：同一本书只取第一个文件
    if (seenBookIds.has(bookId)) return;
    // 异常文件名（含路径分隔符等）直接忽略
    if (!fileName || fileName.length > 200 || /[\\/]/.test(fileName)) return;
    seenBookIds.add(bookId);
    entries.push({ bookId, fileName, entry });
  });

  // 4. 文件数量限制
  if (entries.length > MAX_BACKUP_FILES) return { ok: false, error: "too-many-files" };

  // 5. 逐个解压，边解压边累计大小（不在内存中同时持有所有文件）
  const files: FullBackupFile[] = [];
  let totalBytes = 0;
  for (const { bookId, fileName, entry } of entries) {
    const blob: Blob = await entry.async("blob");
    if (blob.size > MAX_BACKUP_FILE_BYTES) return { ok: false, error: "file-too-large" };
    totalBytes += blob.size;
    if (totalBytes > MAX_BACKUP_TOTAL_BYTES) return { ok: false, error: "total-too-large" };
    files.push({ bookId, fileName, blob });
  }
  return { ok: true, data: parsed.data, files };
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
