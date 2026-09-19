"use client";

// 应用内阅读器：PDF（pdf.js canvas 渲染）/ EPUB（epub.js 分页）/ TXT·MD（自研分页）。
// 统一左右翻页交互（按钮 + 键盘 + 触摸滑动），进度按书 id 记忆（localStorage）。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import ePub from "epubjs";
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

/** 检查 PDF 文件头（%PDF-）：避免把非 PDF / 截断数据丢给 pdf.js 后只得到「文件损坏」 */
function hasPdfHeader(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, 1024);
  let text = "";
  for (let i = 0; i < head.length; i += 1) text += String.fromCharCode(head[i]);
  return text.includes("%PDF-");
}

/** pdf.js worker 在 public/ 下的路径（Next 静态导出会原样拷进 out/，随 Tauri 资产一起打包） */
const PDF_WORKER_PATH = "/pdf.worker.min.mjs";
/** worker 源码转成的 blob: URL（模块级缓存，整个会话只建一次） */
let pdfWorkerBlobUrl = "";

/**
 * 配置 pdf.js worker。
 *
 * pdf.js 6 用 `new Worker(workerSrc, { type: "module" })` 起 worker——**模块 worker 强制要求
 * JS MIME**。桌面/浏览器开发服务器会把 .mjs 正确声明成 text/javascript，但 Tauri Android 的
 * asset 响应对 .mjs 未必给出 JS MIME（未知扩展名会退回 octet-stream），模块 worker 会被
 * WebView 直接拒掉，pdf.js 随即退化到 fake worker 并抛
 * "Setting up fake worker failed"，表现就是「PDF 解析失败，文件可能已损坏」。
 *
 * 这里先把 worker 源码 fetch 成文本，再包成 `text/javascript` 的 blob: URL，
 * MIME 由我们自己保证；完全离线，不走 CDN。取不到源码时退回原始路径。
 * 注意：blob: URL 建好后不能 revoke——pdf.js 是延迟到 getDocument 才用它 new Worker。
 */
async function ensurePdfWorker(): Promise<void> {
  if (pdfWorkerBlobUrl) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerBlobUrl;
    return;
  }
  try {
    const res = await fetch(PDF_WORKER_PATH);
    const code = res.ok ? await res.text() : "";
    // 校验拿到的确实是 pdf.js worker 源码（防止拿到 404/兜底 HTML 还当 JS 用）
    if (!code || !code.includes("WorkerMessageHandler")) {
      throw new Error(`worker source invalid: HTTP ${res.status}, ${code.length} chars`);
    }
    pdfWorkerBlobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerBlobUrl;
  } catch (err) {
    console.error("[PDF Reader] worker fetch failed, fallback to path:", err);
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_PATH;
  }
}

/** 把 pdf.js 的真实错误映射成对用户有意义的提示，不再一律说「文件已损坏」 */
function pdfErrorMessage(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? "";
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (name === "MissingPDFException" || /missing pdf/i.test(message)) return "找不到本地 PDF，请重新添加文件。";
  if (name === "WorkerException" || /worker/i.test(message) || /fake worker/i.test(message)) return "PDF 阅读组件加载失败，请重新打开。";
  if (/password|encrypt/i.test(message)) return "此 PDF 已加密，暂不支持打开。";
  if (name === "InvalidPDFException" || /invalid pdf/i.test(message)) return "无法解析此 PDF，文件可能损坏或格式不受支持。";
  return "无法解析此 PDF，文件可能损坏或格式不受支持。";
}

export function BookReader({ target, onClose }: { target: ReaderTarget; onClose: () => void }) {
  const mode = useMemo(() => supportedFileType(target.fileName), [target.fileName]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [blobUrl, setBlobUrl] = useState("");
  // PDF 直接以字节交给 pdf.js，不再依赖 blob: URL（Android WebView 取 blob: 不稳定）
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  // 追踪当前活跃的 blob URL，保证切换书籍/关闭/unmount 时都能 revoke，避免内存泄漏
  const activeUrlRef = useRef<string>("");
  // Portal 到 body：避免玻璃面板的 backdrop-filter 把 fixed 遮罩退化成局部定位
  // 惰性初始化判断 document 可用性（客户端），避免 effect 内 setState
  const [mounted] = useState(() => typeof document !== "undefined");

  const [pdfPage, setPdfPage] = useState(() => loadProgress(target.bookId));
  const [pdfTotal, setPdfTotal] = useState(0);
  const [epubPercent, setEpubPercent] = useState(() => (loadProgress(target.bookId) || 0));
  const [txtIndex, setTxtIndex] = useState(() => loadProgress(target.bookId));
  const [txtTotal, setTxtTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const blob = await getBookFile(target.bookId);
        if (cancelled) return;
        if (!blob) { setError("找不到文件内容，请重新选择文件添加。"); setLoading(false); return; }
        if (blob.size === 0) {
          setError(mode === "pdf" ? "PDF 文件内容为空，请重新添加文件。" : "文件内容为空，请重新添加文件。");
          setLoading(false);
          return;
        }
        // PDF 直接读成字节交给 pdf.js：Android WebView 下 blob: URL 取 PDF 不稳定，
        // 而且这样能在进 pdf.js 之前就校验文件完整性（大小 + %PDF- 头）。
        if (mode === "pdf") {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          if (cancelled) return;
          if (bytes.byteLength === 0) { setError("PDF 文件内容为空，请重新添加文件。"); setLoading(false); return; }
          if (!hasPdfHeader(bytes)) { setError("无法解析此 PDF，文件可能损坏或格式不受支持。"); setLoading(false); return; }
          setPdfData(bytes);
          setLoading(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        // 若已有旧 URL（切换书籍），先 revoke
        if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = url;
        setBlobUrl(url);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error("[PDF Reader] read file failed:", err);
          setError("读取本地文件失败。");
          setLoading(false);
        }
      }
    })();
    // 卸载或 bookId 变化时 revoke 当前 URL
    return () => {
      cancelled = true;
      setPdfData(null);
      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = "";
      }
    };
  }, [target.bookId, mode]);

  // 页码合法化回调：首次打开进度为 0 → 回到第 1 页；旧进度超过总页数 → 收敛到最后一页。
  // 由 PdfEngine 在文档就绪后（异步）回调，避免解析成功却因页码非法而不渲染。
  const handlePdfPageResolved = useCallback((n: number) => {
    setPdfPage(n);
    saveProgress(target.bookId, n);
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

  const progressLabel = mode === "pdf" && pdfTotal ? `${Math.min(Math.max(pdfPage, 1), pdfTotal)} / ${pdfTotal}`
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

      {!loading && !error && mode === "pdf" && pdfData && (
        <PdfEngine
          data={pdfData}
          page={pdfPage}
          onPageCount={setPdfTotal}
          onPageResolved={handlePdfPageResolved}
          onError={setError}
        />
      )}
      {!loading && !error && mode === "epub" && (
        <EpubEngine url={blobUrl} onPercent={(p) => { setEpubPercent(p); saveProgress(target.bookId, p); }} onError={setError} />
      )}
      {!loading && !error && mode === "txt" && (
        <TxtEngine url={blobUrl} index={txtIndex} onReady={setTxtTotal} />
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
function PdfEngine({ data, page, onPageCount, onPageResolved, onError }: {
  data: Uint8Array;
  page: number;
  onPageCount: (n: number) => void;
  onPageResolved: (n: number) => void;
  onError: (msg: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // PDF document proxy（numPages/getPage）
  const pdfRef = useRef<{ numPages: number; getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<unknown>; cancel: () => void } }> } | null>(null);
  // loading task（destroy 释放 worker + 文档）
  const taskRef = useRef<{ destroy: () => Promise<void> } | null>(null);
  // 当前 renderTask（cancel 释放渲染）
  const renderTaskRef = useRef<{ promise: Promise<unknown>; cancel: () => void } | null>(null);
  // 文档就绪计数器：文档是异步加载的，必须让渲染 effect 在文档就绪后再跑一次，
  // 否则「页码没变、数据没变」时 effect 不会重跑，页面解析成功但 canvas 一片空白。
  const [docReady, setDocReady] = useState(0);
  // 打开时的页码快照：只用于文档就绪后做一次合法化，不能进加载 effect 的依赖
  // （否则每翻一页都会重新解析整份 PDF）。
  const initialPageRef = useRef(page);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // worker 必须先就绪（MIME 由 ensurePdfWorker 保证），再以字节形式交给 pdf.js，
        // 不再走 blob: URL —— Android WebView 取 blob: PDF 不稳定。
        await ensurePdfWorker();
        const task = pdfjs.getDocument({ data });
        taskRef.current = task as unknown as typeof taskRef.current;
        const doc = await task.promise;
        if (cancelled) return;
        pdfRef.current = doc as unknown as typeof pdfRef.current;
        onPageCount(doc.numPages);
        // 页码合法化：pdf.js 只接受 1..numPages。首次打开（进度 0）必须落到第 1 页，
        // 旧进度超出总页数则收敛到最后一页，否则解析成功也不会渲染。
        const initialPage = initialPageRef.current;
        const clamped = Math.min(Math.max(initialPage, 1), doc.numPages);
        if (clamped !== initialPage) onPageResolved(clamped);
        setDocReady((v) => v + 1);
      } catch (err) {
        if (cancelled) return;
        // 保留真实错误（name/message/stack），不再一律报「文件已损坏」
        console.error("[PDF Reader] load failed:", err, `bytes=${data.byteLength}`);
        onError(pdfErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
      pdfRef.current = null;
      // 卸载/切换时销毁 PDF loading task，释放 worker 与文档，避免资源泄漏
      const task = taskRef.current;
      if (task) {
        taskRef.current = null;
        void task.destroy().catch(() => { /* 忽略 destroy 失败 */ });
      }
    };
  }, [data, onPageCount, onPageResolved, onError]);

  useEffect(() => {
    const doc = pdfRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    // 渲染时同样夹到合法范围，保证父层页码还没同步过来时也能画出第一页
    const safePage = Math.min(Math.max(page, 1), doc.numPages);
    let cancelled = false;
    (async () => {
      try {
        const pdfPage = await doc.getPage(safePage);
        if (cancelled) return;
        const container = canvas.parentElement;
        const fit = Math.min(1.6, Math.max(0.5, (container?.clientWidth ?? 600) / pdfPage.getViewport({ scale: 1 }).width));
        const viewport = pdfPage.getViewport({ scale: fit * window.devicePixelRatio });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${Math.round(viewport.width / window.devicePixelRatio)}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx || cancelled) return;
        const renderTask = pdfPage.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch {
        // cancel 会抛 RenderingCancelledException，正常翻页/卸载场景下忽略
        // 真正的渲染失败已由 pdf.js 内部处理，这里不重复上报
      }
    })();
    return () => {
      cancelled = true;
      // 页面切换或卸载时取消进行中的渲染，避免并发渲染 + 资源泄漏
      const task = renderTaskRef.current;
      if (task) {
        renderTaskRef.current = null;
        try { task.cancel(); } catch { /* 忽略 cancel 异常 */ }
      }
    };
  }, [page, data, docReady]);

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

function TxtEngine({ url, index, onReady }: {
  url: string; index: number;
  onReady: (n: number) => void;
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
