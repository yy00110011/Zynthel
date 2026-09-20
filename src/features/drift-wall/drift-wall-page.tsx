"use client";

import { Plus, ImagePlus, Trash2, Replace, Maximize2 } from "lucide-react";
import { useSyncExternalStore, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useWorkspace } from "@/features/data/use-workspace";
import { workspaceRepository } from "@/features/data/repository";
import type { DriftWallItem } from "@/features/data/schema";
import { DRIFT_WALL_SIZES, clamp, normalizedToPixels, pixelsToNormalized } from "./geometry";
import { createDriftMotion, driftStyleVars, prefersReducedMotion, shouldPauseDrift, subscribeReducedMotion } from "./motion";
import { addDriftWallItem, clearDriftWallItemImage, moveDriftWallItem, removeDriftWallItem, setDriftWallSize, updateDriftWallItem } from "./model";
import { ensureDriftWallSeeded } from "./model";
import { processImageFile, type ProcessImageError } from "./image";
import { deleteDriftWallImage, putDriftWallImage } from "@/lib/drift-wall-storage";

const ERROR_TEXT: Record<ProcessImageError, string> = {
  "unsupported-type": "只支持 PNG / JPG / JPEG / WEBP 图片。",
  "too-large": "图片过大（单张上限 10MB）。",
  "decode-failed": "图片无法解析，已忽略。",
};

type Menu = { id: string; x: number; y: number; hasImage: boolean };
type Pending = { kind: "replace"; id: string } | { kind: "new" };
type DragState = {
  id: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  size: number;
  moved: boolean;
  startX: number;
  startY: number;
  left: number;
  top: number;
};

export function DriftWallPage() {
  const data = useWorkspace();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [board, setBoard] = useState({ width: 0, height: 0 });
  const [drag, setDrag] = useState<{ id: string; left: number; top: number } | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [message, setMessage] = useState("");
  // 跟随系统「减弱动态效果」偏好：媒体查询属于外部系统，用订阅方式同步而非在 effect 里 setState。
  const systemReduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  const pending = useRef<Pending | null>(null);

  const items = data.driftWallItems;

  // 首次进入：还没有任何数据时生成 8 个空白占位圆。
  //
  // 基线必须用 `workspaceRepository.get()` 的真实当前值，不能用渲染快照 `data`：
  // useSyncExternalStore 在 hydration 阶段返回的是 getServerSnapshot()（一份空的默认工作区），
  // 若此时以 `data` 为基线写回，会把用户已保存在 localStorage 的数据**整体覆盖**成默认值
  // ——表现为「重启应用后浮光墙图片全部丢失」。
  useEffect(() => {
    const current = workspaceRepository.get();
    if (current.driftWallItems.length > 0) return;
    workspaceRepository.set(ensureDriftWallSeeded(current));
  }, [items.length]);

  // 测量画布尺寸（窗口缩放后重算像素位置，归一化坐标不变）。
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => setBoard({ width: el.clientWidth, height: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", close); };
  }, [menu]);

  const reducedMotion = data.settings.reducedMotion || systemReduced;

  const handleFile = async (file: File | undefined) => {
    const target = pending.current;
    pending.current = null;
    if (!file || !target) return;
    const result = await processImageFile(file);
    if (!result.ok) { setMessage(ERROR_TEXT[result.error]); return; }
    try {
      if (target.kind === "new") {
        const id = crypto.randomUUID();
        await putDriftWallImage(id, result.image.full);
        workspaceRepository.set(addDriftWallItem(data, { imageData: result.image.thumbnail, size: DRIFT_WALL_SIZES.medium, driftSeed: Math.random() * 1000 }, id));
        setMessage("图片已添加。");
      } else {
        await putDriftWallImage(target.id, result.image.full);
        workspaceRepository.set(updateDriftWallItem(data, target.id, { imageData: result.image.thumbnail }));
        setMessage("图片已更新。");
      }
    } catch {
      setMessage("图片保存失败，请重试。");
    }
  };

  const pickFor = (target: Pending) => {
    pending.current = target;
    const input = inputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  };

  // 「移除图片」：只清空照片，圆形退回空白占位（条目保留），并清理 IndexedDB 里的全图。
  // 存储清理失败只浪费一点空间、不影响界面，故忽略。
  const removeImage = async (id: string) => {
    workspaceRepository.set(clearDriftWallItemImage(data, id));
    try { await deleteDriftWallImage(id); } catch { /* 忽略清理失败 */ }
  };

  // 「移除占位」：空白圆才删除整个条目（有图圆形需先移除图片退回占位，再移除占位）。
  const removePlaceholder = (id: string) => {
    workspaceRepository.set(removeDriftWallItem(data, id));
  };

  const onPointerDown = (item: DriftWallItem) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const boardEl = boardRef.current;
    if (!boardEl) return;
    const boardRect = boardEl.getBoundingClientRect();
    const floatEl = event.currentTarget.firstElementChild as HTMLElement | null;
    // 用内层漂移元素的视觉位置作为拖拽基准（含当前漂浮位移），可避免拖拽起始跳动。
    const visual = (floatEl ?? event.currentTarget).getBoundingClientRect();
    const left = visual.left - boardRect.left;
    const top = visual.top - boardRect.top;
    dragRef.current = {
      id: item.id,
      pointerId: event.pointerId,
      offsetX: event.clientX - visual.left,
      offsetY: event.clientY - visual.top,
      size: item.size,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      left,
      top,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (!state.moved && Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 4) return;
    state.moved = true;
    const boardEl = boardRef.current;
    if (!boardEl) return;
    const rect = boardEl.getBoundingClientRect();
    state.left = clamp(event.clientX - rect.left - state.offsetX, 0, Math.max(0, rect.width - state.size));
    state.top = clamp(event.clientY - rect.top - state.offsetY, 0, Math.max(0, rect.height - state.size));
    setDrag({ id: state.id, left: state.left, top: state.top });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (state.moved) {
      const boardEl = boardRef.current;
      if (boardEl) {
        const rect = boardEl.getBoundingClientRect();
        const normalized = pixelsToNormalized(state.left, state.top, rect.width, rect.height);
        workspaceRepository.set(moveDriftWallItem(data, state.id, normalized.x, normalized.y));
      }
    }
    setDrag(null);
  };

  const positioned = useMemo(() => items.map((item) => {
    const motion = createDriftMotion(item.driftSeed);
    return { item, motion };
  }), [items]);

  return (
    <div className="page-stack drift-wall-page">
      <header className="drift-wall-head">
        <div>
          <h1>浮光墙</h1>
          <p>把喜欢的图片留在自己的空间里。点击空白圆添加，拖动摆放，它们会轻轻漂浮。</p>
        </div>
        <button className="drift-add-btn" onClick={() => pickFor({ kind: "new" })}>
          <Plus size={16} /> 添加图片
        </button>
      </header>

      {message && <div className="drift-message" role="status">{message}</div>}

      <div
        className={`drift-board${reducedMotion ? " reduced" : ""}`}
        ref={boardRef}
        onClick={() => setMenu(null)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {positioned.map(({ item, motion }) => {
          const dragging = drag?.id === item.id;
          const pixel = dragging
            ? { left: drag.left, top: drag.top }
            : normalizedToPixels(item.x, item.y, board.width, board.height);
          const paused = shouldPauseDrift(dragging, false, reducedMotion);
          const style: CSSProperties = {
            left: `${pixel.left}px`,
            top: `${pixel.top}px`,
            width: `${item.size}px`,
            height: `${item.size}px`,
            ...(driftStyleVars(motion) as CSSProperties),
            ...({ animationPlayState: paused ? "paused" : "running" } as CSSProperties),
          };
          // 只渲染真正的位图 dataURL（防止被篡改的 workspace 塞入非图片内容）。
          const safeSrc = item.imageData && item.imageData.startsWith("data:image/") ? item.imageData : null;
          const hasImage = safeSrc !== null;
          return (
            <div
              key={item.id}
              className={`drift-item${dragging ? " dragging" : ""}${hasImage ? " has-image" : " placeholder"}`}
              style={style}
              onPointerDown={onPointerDown(item)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onContextMenu={(event) => {
                event.preventDefault();
                const boardRect = boardRef.current?.getBoundingClientRect();
                setMenu({
                  id: item.id,
                  x: event.clientX - (boardRect?.left ?? 0),
                  y: event.clientY - (boardRect?.top ?? 0),
                  hasImage,
                });
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (!hasImage && !dragRef.current) pickFor({ kind: "replace", id: item.id });
              }}
              role={hasImage ? undefined : "button"}
              aria-label={hasImage ? undefined : "添加图片"}
              title={hasImage ? "拖动摆放；右键可更换/调整/移除" : "点击添加图片"}
            >
              <span className="drift-float">
                {hasImage
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={safeSrc} alt="" draggable={false} />
                  : <span className="drift-placeholder-plus" aria-hidden="true"><Plus size={Math.round(item.size * 0.26)} /></span>}
              </span>
            </div>
          );
        })}

        {menu && (
          <div className="drift-menu" style={{ left: `${menu.x}px`, top: `${menu.y}px` }} onPointerDown={(e) => e.stopPropagation()}>
            <button onClick={() => { pickFor({ kind: "replace", id: menu.id }); setMenu(null); }}>
              {menu.hasImage ? <><Replace size={14} /> 更换图片</> : <><ImagePlus size={14} /> 添加图片</>}
            </button>
            {menu.hasImage && (
              <>
                <div className="drift-menu-label"><Maximize2 size={14} /> 调整大小</div>
                <div className="drift-menu-sizes">
                  {(["small", "medium", "large"] as const).map((key) => (
                    <button key={key} onClick={() => { workspaceRepository.set(setDriftWallSize(data, menu.id, DRIFT_WALL_SIZES[key])); setMenu(null); }}>
                      {{ small: "小", medium: "中", large: "大" }[key]}
                    </button>
                  ))}
                </div>
              </>
            )}
            {menu.hasImage ? (
              <button className="danger" onClick={() => { void removeImage(menu.id); setMenu(null); }}>
                <Trash2 size={14} /> 移除图片
              </button>
            ) : (
              <button className="danger" onClick={() => { removePlaceholder(menu.id); setMenu(null); }}>
                <Trash2 size={14} /> 移除占位
              </button>
            )}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="drift-file-input"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </div>
  );
}
