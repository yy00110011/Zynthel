"use client";

import { Plus, Trash2, Library, Book, Star, FolderOpen, FileText, BookOpen } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { GlassPanel, SectionTitle } from "@/components/ui/glass-panel";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";
import { deleteBookFile, putBookFile, supportedFileType } from "@/lib/book-storage";
import { BookReader, type ReaderTarget } from "./book-reader";

const STATUS_LABELS: Record<string, string> = { want: "想读", reading: "在读", finished: "读完" };
// 本地阅读文件常见格式（不强制限制，accept 仅作为选择器默认过滤提示）
const FILE_ACCEPT = ".pdf,.epub,.mobi,.azw3,.txt,.md,.doc,.docx";

export function ReadingPage() {
  const data = useWorkspace();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState<"want" | "reading" | "finished">("want");
  const [note, setNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const books = data.books;

  const stats = useMemo(() => ({
    total: books.length,
    reading: books.filter((b) => b.status === "reading").length,
    finished: books.filter((b) => b.status === "finished").length,
  }), [books]);

  const addBook = () => {
    const t = title.trim();
    if (!t) return;
    const now = new Date().toISOString();
    workspaceRepository.update((d) => ({
      ...d,
      books: [{ id: crypto.randomUUID(), title: t, author: author.trim(), status, rating: 0, progress: 0, note: note.trim(), source: "manual" as const, fileName: "", createdAt: now, updatedAt: now }, ...d.books],
      updatedAt: now,
    }));
    setTitle(""); setAuthor(""); setNote("");
  };

  /** 从本地文件选择器选文件加入书单：书名 = 文件名去扩展名，记录原始文件名，内容存 IndexedDB 供应用内阅读 */
  const addBookFromFile = async (file: File) => {
    const dot = file.name.lastIndexOf(".");
    const name = dot > 0 ? file.name.slice(0, dot) : file.name;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await putBookFile(id, file);
    } catch {
      // 存储失败（如隐私模式/容量不足）时降级为仅记录文件名
    }
    workspaceRepository.update((d) => ({
      ...d,
      books: [{ id, title: name.trim() || file.name, author: "", status: "want" as const, rating: 0, progress: 0, note: "", source: "file" as const, fileName: file.name.slice(0, 200), createdAt: now, updatedAt: now }, ...d.books],
      updatedAt: now,
    }));
  };

  const [readerTarget, setReaderTarget] = useState<ReaderTarget | null>(null);

  const updateBook = (id: string, patch: Partial<typeof books[number]>) => {
    workspaceRepository.update((d) => ({
      ...d,
      books: d.books.map((b) => b.id === id ? { ...b, ...patch, updatedAt: new Date().toISOString() } : b),
    }));
  };

  const removeBook = (id: string) => {
    void deleteBookFile(id).catch(() => undefined);
    workspaceRepository.update((d) => ({ ...d, books: d.books.filter((b) => b.id !== id) }));
  };

  return (
    <div className="page-stack">
      <header className="page-heading"><p>阅读管理</p><h1>阅读清单</h1><span>管理你的书单与阅读进度。</span></header>

      <GlassPanel className="reading-summary">
        <div className="reading-stat"><Library /><span>总藏书</span><strong>{stats.total}</strong></div>
        <div className="reading-stat"><Book /><span>在读</span><strong>{stats.reading}</strong></div>
        <div className="reading-stat"><Star /><span>读完</span><strong>{stats.finished}</strong></div>
      </GlassPanel>

      <GlassPanel>
        <SectionTitle>添加书籍</SectionTitle>
        <div className="reading-form">
          <input aria-label="书名" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="书名" />
          <input aria-label="作者" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="作者" />
          <select aria-label="状态" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="want">想读</option>
            <option value="reading">在读</option>
            <option value="finished">读完</option>
          </select>
          <button className="primary-action" onClick={addBook}><Plus /> 添加</button>
          <button
            className="reading-file-btn"
            aria-label="从本地文件选择加入书单"
            title="从本地文件选择（PDF / EPUB / TXT 等），文件名将作为书名"
            onClick={() => fileInputRef.current?.click()}
          ><FolderOpen /> 本地文件</button>
          <input
            ref={fileInputRef}
            type="file"
            accept={FILE_ACCEPT}
            aria-hidden="true"
            tabIndex={-1}
            className="visually-hidden-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) addBookFromFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </GlassPanel>

      <GlassPanel>
        <SectionTitle>书单</SectionTitle>
        {books.length === 0 ? (
          <p className="ledger-empty">还没有书，添加第一本吧。</p>
        ) : (
          <div className="reading-list">
            {books.map((b) => (
              <div key={b.id} className="reading-item">
                <span className="reading-cover"><Book /></span>
                <div className="reading-main">
                  <strong>{b.title}{b.source === "file" && <em className="reading-file-tag"><FileText size={10} /> 本地文件</em>}</strong>
                  {b.author && <small>{b.author}</small>}
                  {b.source === "file" && b.fileName && <small className="reading-file-name">{b.fileName}</small>}
                  <div className="reading-progress-row">
                    <span className={`reading-status status-${b.status}`}>{STATUS_LABELS[b.status]}</span>
                    {b.status === "reading" && (
                      <>
                        <input type="range" min={0} max={100} value={b.progress} onChange={(e) => updateBook(b.id, { progress: parseInt(e.target.value, 10) })} />
                        <span>{b.progress}%</span>
                      </>
                    )}
                    {b.status === "finished" && (
                      <div className="reading-stars">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button key={s} className={s <= b.rating ? "active" : ""} onClick={() => updateBook(b.id, { rating: s })}><Star /></button>
                        ))}
                      </div>
                    )}
                  </div>
                  {b.note && <p className="reading-note">{b.note}</p>}
                </div>
                <div className="reading-actions">
                  {b.source === "file" && supportedFileType(b.fileName) && (
                    <button aria-label="开始阅读" className="reading-read-btn" onClick={() => setReaderTarget({ bookId: b.id, title: b.title, fileName: b.fileName })}>
                      <BookOpen /> 阅读
                    </button>
                  )}
                  <button aria-label="标记在读" onClick={() => updateBook(b.id, { status: b.status === "reading" ? "finished" : "reading" })}>
                    {b.status === "reading" ? "标记读完" : "开始阅读"}
                  </button>
                  <button aria-label="删除" onClick={() => removeBook(b.id)}><Trash2 /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      {readerTarget && <BookReader target={readerTarget} onClose={() => setReaderTarget(null)} />}
    </div>
  );
}
