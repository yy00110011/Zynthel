"use client";

// 应用内阅读器：PDF（pdf.js canvas 渲染）/ EPUB（epub.js 分页）/ TXT·MD（自研分页）。
// 统一左右翻页交互（按钮 + 键盘 + 触摸滑动），进度按书 id 记忆（localStorage）。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { getBookFile, supportedFileType } from "@/lib/book-storage";

export type ReaderTarget = { bookId: string; title: string; fileName: string };

const PROGRESS_KEY = (bookId: string) => `reader.progress.${bookId}`;

function loadProgress(bookId: string): number {
  const raw = localStorage.getItem(PROGRESS_KEY(bookId));
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function saveProgress(bookId: string, value: number) {
  localStorage.setItem(PROGRESS_KEY(bookId), String(value));
}

type ReaderMode = "pdf" | "epub" | "txt";

export function BookReader({ target, onClose }: { target: ReaderTarget; onClose: () => void }) {
  const mode = useMemo(() => supportedFileType(target.fileName), [target.fileName]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [blobUrl, setBlobUrl] = useState("");
  // Portal 到 body：避免玻璃面板的 backdrop-filter 把 fixed 遮罩退化成局部定位
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [pdfPage, setPdfPage] = useState(() => loadProgress(target.bookId));
  const [pdfTotal, setPdfTotal] = useState(0);
  const [epubPercent, setEpubPercent] = useState(() => (loadProgress(target.bookId) || 0));
  const [txtIndex, setTxtIndex] = useState(() => loadProgress(target.bookId));
  const [txtTotal, setTxtTotal] = useState(0);

  useEffect(() => {
    let revoked = "";
    (async () => {
      try {
        const blob = await getBookFile(target.bookId);
        if (!blob) { setError("找不到文件内容，请重新选择文件添加。"); setLoading(false); return; }
        revoked = URL.createObjectURL(blob);
        setBlobUrl(revoked);
        setLoading(false);
      } catch {
        setError("读取本地文件失败。");
        setLoading(false);
      }
    })();
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [target.bookId]);

  const goNext = useCallback(() => {
    if (mode === "pdf" && pdfPage < pdfTotal) { const n = pdfPage + 1; setPdfPage(n); saveProgress(target.bookId, n); }
    if (mode === "txt" && txtIndex < txtTotal - 1) { const n = txtIndex + 1; setTxtIndex(n); saveProgress(target.bookId, n); }
  }, [mode, pdfPage, pdfTotal, txtIndex, txtTotal, target.bookId]);

  const goPrev = useCallback(() => {
    if (mode === "pdf" && pdfPage > 1) { const n = pdfPage - 1; setPdfPage(n); saveProgress(target.bookId, n); }
    if (mode === "txt" && txtIndex > 0) { const n = txtIndex - 1; setTxtIndex(n); saveProgress(target.bookId, n); }
  }, [mode, pdfPage, txtIndex, target.bookId]);

  // 键盘翻页 + 触摸滑动翻页
  const touchStartX = useRef(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -50) goNext();
    if (dx > 50) goPrev();
  };

  const progressLabel = mode === "pdf" && pdfTotal ? `${pdfPage} / ${pdfTotal}`
    : mode === "txt" && txtTotal ? `${Math.min(txtIndex + 1, txtTotal)} / ${txtTotal}`
    : mode === "epub" ? `${Math.min(epubPercent, 100)}%`
    : "";

  if (!mounted) return null;

  return createPortal(
    <div className="book-reader-backdrop" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="book-reader-head">
        <strong title={target.title}>{target.title}</strong>
        <span className="book-reader-progress">{progressLabel}</span>
        <button aria-label="关闭阅读器" onClick={onClose}><X /></button>
      </header>

      {loading && <div className="book-reader-status"><Loader2 className="spin" /> 正在打开文件…</div>}
      {!loading && error && <div className="book-reader-status">{error}</div>}

      {!loading && !error && mode === "pdf" && (
        <PdfEngine url={blobUrl} page={pdfPage} onPageCount={setPdfTotal} onError={setError} />
      )}
      {!loading && !error && mode === "epub" && (
        <EpubEngine url={blobUrl} onPercent={(p) => { setEpubPercent(p); saveProgress(target.bookId, p); }} onError={setError} />
      )}
      {!loading && !error && mode === "txt" && (
        <TxtEngine url={blobUrl} index={txtIndex} total={txtTotal} onReady={setTxtTotal} onNavigate={(i) => { setTxtIndex(i); saveProgress(target.bookId, i); }} />
      )}

      {!loading && !error && (mode === "pdf" || mode === "txt") && (
        <div className="book-reader-nav">
          <button aria-label="上一页" onClick={goPrev} disabled={mode === "pdf" ? pdfPage <= 1 : txtIndex <= 0}><ChevronLeft /> 上一页</button>
          <span>{progressLabel}</span>
          <button aria-label="下一页" onClick={goNext} disabled={mode === "pdf" ? pdfPage >= pdfTotal : txtIndex >= txtTotal - 1}>下一页 <ChevronRight /></button>
        </div>
      )}
    </div>,
    document.body,
  );
}

/* ===== PDF 引擎：pdf.js 渲染当前页到 canvas ===== */
function PdfEngine({ url, page, onPageCount, onError }: {
  url: string; page: number; onPageCount: (n: number) => void; onError: (msg: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<{ numPages: number; getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => Promise<void> }> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        pdfRef.current = doc as unknown as typeof pdfRef.current;
        onPageCount(doc.numPages);
      } catch {
        if (!cancelled) onError("PDF 解析失败，文件可能已损坏。");
      }
    })();
    return () => { cancelled = true; };
  }, [url, onPageCount, onError]);

  useEffect(() => {
    const doc = pdfRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || page < 1 || page > doc.numPages) return;
    let cancelled = false;
    (async () => {
      const pdfPage = await doc.getPage(page);
      const container = canvas.parentElement;
      const fit = Math.min(1.6, Math.max(0.5, (container?.clientWidth ?? 600) / pdfPage.getViewport({ scale: 1 }).width));
      const viewport = pdfPage.getViewport({ scale: fit * window.devicePixelRatio });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${Math.round(viewport.width / window.devicePixelRatio)}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx || cancelled) return;
      await pdfPage.render({ canvasContext: ctx, viewport });
    })();
    return () => { cancelled = true; };
  }, [page, url]);

  return <div className="book-reader-body pdf-body"><canvas ref={canvasRef} /></div>;
}

/* ===== EPUB 引擎：epub.js paginated 左右翻页 ===== */
function EpubEngine({ url, onPercent, onError }: {
  url: string; onPercent: (p: number) => void; onError: (msg: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<{ prev: () => void; next: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    (async () => {
      try {
        const ePub = (await import("epubjs")).default;
        const book = ePub(url);
        if (cancelled || !hostRef.current) return;
        const rendition = book.renderTo(hostRef.current, { width: "100%", height: "100%", spread: "none", flow: "paginated" });
        await rendition.display();
        (rendition as unknown as { on: (ev: string, cb: (location: { start: { percentage: number } }) => void) => void }).on("relocated", (location) => {
          const pct = Math.round((location?.start?.percentage ?? 0) * 100);
          onPercent(pct);
        });
        navRef.current = { prev: () => rendition.prev(), next: () => rendition.next() };
        // 键盘翻页（焦点在宿主页面时）；iframe 内的按键由 epub.js 自行处理
        const onKey = (e: KeyboardEvent) => {
          if (e.key === "ArrowRight") rendition.next();
          if (e.key === "ArrowLeft") rendition.prev();
        };
        window.addEventListener("keydown", onKey);
        cleanup = () => {
          window.removeEventListener("keydown", onKey);
          rendition.destroy();
          book.destroy();
        };
      } catch {
        if (!cancelled) onError("EPUB 解析失败，文件可能已损坏。");
      }
    })();
    return () => { cancelled = true; cleanup?.(); navRef.current = null; };
  }, [url, onPercent, onError]);

  const touchX = useRef(0);
  return (
    <div
      className="book-reader-body epub-body"
      ref={hostRef}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (dx < -50) navRef.current?.next();
        if (dx > 50) navRef.current?.prev();
      }}
    />
  );
}

/* ===== TXT/MD 引擎：按字符量分页，左右翻页 ===== */
const CHARS_PER_PAGE = 1600;

function TxtEngine({ url, index, total, onReady, onNavigate }: {
  url: string; index: number; total: number;
  onReady: (n: number) => void; onNavigate: (i: number) => void;
}) {
  const [pages, setPages] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const text = await (await fetch(url)).text();
      if (cancelled) return;
      const chunks: string[] = [];
      // 按段落边界优先切页，段落超长再硬切
      const paragraphs = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
      let current = "";
      for (const p of paragraphs) {
        if (p.length > CHARS_PER_PAGE) {
          if (current) { chunks.push(current); current = ""; }
          for (let i = 0; i < p.length; i += CHARS_PER_PAGE) chunks.push(p.slice(i, i + CHARS_PER_PAGE));
          continue;
        }
        if (current.length + p.length > CHARS_PER_PAGE) { chunks.push(current); current = p; }
        else current = current ? `${current}\n\n${p}` : p;
      }
      if (current) chunks.push(current);
      setPages(chunks);
      onReady(chunks.length);
    })();
    return () => { cancelled = true; };
  }, [url, onReady]);

  return (
    <div className="book-reader-body txt-body">
      <pre>{pages[Math.min(index, Math.max(pages.length - 1, 0))] ?? ""}</pre>
    </div>
  );
}
