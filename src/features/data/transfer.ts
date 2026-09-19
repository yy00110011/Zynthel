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

export type FullBackupParseResult =
  | { ok: true; data: WorkspaceData; files: FullBackupFile[] }
  | { ok: false; error: "invalid-zip" | "unsupported-data" };

/** 解析完整备份：返回工作区数据与书籍文件列表（供写入 IndexedDB） */
export async function parseFullBackup(file: Blob): Promise<FullBackupParseResult> {
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

  const entries: { bookId: string; fileName: string; entry: import("jszip").JSZipObject }[] = [];
  zip.folder("books")?.forEach((relativePath: string, entry: import("jszip").JSZipObject) => {
    if (entry.dir) return;
    const sep = relativePath.indexOf("__");
    const bookId = sep > 0 ? relativePath.slice(0, sep) : relativePath;
    const fileName = sep > 0 ? relativePath.slice(sep + 2) : relativePath;
    entries.push({ bookId, fileName, entry });
  });
  const files: FullBackupFile[] = [];
  for (const { bookId, fileName, entry } of entries) {
    files.push({ bookId, fileName, blob: await entry.async("blob") });
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
