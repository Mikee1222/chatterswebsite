"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  Circle,
  Eraser,
  Highlighter,
  Minus,
  Pencil,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type Tool =
  | "pen"
  | "arrow"
  | "rect"
  | "ellipse"
  | "highlighter"
  | "text"
  | "number"
  | "eraser"
  | "blur";

type Point = { x: number; y: number };

type ShapeBase = {
  id: string;
  color: string;
  strokeWidth: number;
};

type PenShape = ShapeBase & { kind: "pen" | "highlighter"; points: Point[] };
type ArrowShape = ShapeBase & { kind: "arrow"; from: Point; to: Point };
type RectShape = ShapeBase & { kind: "rect" | "ellipse" | "blur"; from: Point; to: Point };
type TextShape = ShapeBase & { kind: "text"; at: Point; text: string; fontSize: number };
type NumberShape = ShapeBase & { kind: "number"; at: Point; n: number };
type Shape = PenShape | ArrowShape | RectShape | TextShape | NumberShape;

const COLORS = ["#ef4444", "#eab308", "#22c55e", "#3b82f6", "#ffffff", "#000000"] as const;
const MAX_LONG_SIDE = 2400;

export type ScreenshotAnnotatorProps = {
  mistakeId: string;
  index: number;
  hasAnnotated: boolean;
  annotatedUrl?: string;
  onClose: () => void;
  onSaved: (annotatedUrl: string) => void;
  onRemoved: () => void;
};

function uid(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function normRect(a: Point, b: Point) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  return { x, y, w, h };
}

function hitShape(shape: Shape, p: Point): boolean {
  if (shape.kind === "pen" || shape.kind === "highlighter") {
    return shape.points.some((pt) => Math.hypot(pt.x - p.x, pt.y - p.y) < Math.max(10, shape.strokeWidth * 2));
  }
  if (shape.kind === "arrow") {
    const mid = { x: (shape.from.x + shape.to.x) / 2, y: (shape.from.y + shape.to.y) / 2 };
    return (
      Math.hypot(shape.from.x - p.x, shape.from.y - p.y) < 12 ||
      Math.hypot(shape.to.x - p.x, shape.to.y - p.y) < 12 ||
      Math.hypot(mid.x - p.x, mid.y - p.y) < 14
    );
  }
  if (shape.kind === "number") {
    return Math.hypot(shape.at.x - p.x, shape.at.y - p.y) < 18;
  }
  if (shape.kind === "text") {
    return Math.abs(shape.at.x - p.x) < 80 && Math.abs(shape.at.y - p.y) < shape.fontSize;
  }
  if (shape.kind === "rect" || shape.kind === "ellipse" || shape.kind === "blur") {
    const r = normRect(shape.from, shape.to);
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }
  return false;
}

function pixelateRegion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  block = 12
) {
  const xi = Math.max(0, Math.floor(x));
  const yi = Math.max(0, Math.floor(y));
  const wi = Math.max(1, Math.floor(w));
  const hi = Math.max(1, Math.floor(h));
  if (wi < 2 || hi < 2) return;
  const tmp = document.createElement("canvas");
  tmp.width = Math.max(1, Math.ceil(wi / block));
  tmp.height = Math.max(1, Math.ceil(hi / block));
  const tctx = tmp.getContext("2d");
  if (!tctx) return;
  tctx.imageSmoothingEnabled = false;
  tctx.drawImage(ctx.canvas, xi, yi, wi, hi, 0, 0, tmp.width, tmp.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, xi, yi, wi, hi);
  ctx.imageSmoothingEnabled = true;
}

function drawArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, color: string, width: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.max(10, width * 3);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - ux * head - uy * head * 0.5, to.y - uy * head + ux * head * 0.5);
  ctx.lineTo(to.x - ux * head + uy * head * 0.5, to.y - uy * head - ux * head * 0.5);
  ctx.closePath();
  ctx.fill();
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  if (shape.kind === "blur") {
    const r = normRect(shape.from, shape.to);
    if (r.w > 2 && r.h > 2) pixelateRegion(ctx, r.x, r.y, r.w, r.h, 14);
    return;
  }
  if (shape.kind === "pen" || shape.kind === "highlighter") {
    if (shape.points.length < 2) return;
    ctx.save();
    if (shape.kind === "highlighter") ctx.globalAlpha = 0.35;
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.kind === "highlighter" ? shape.strokeWidth * 3 : shape.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(shape.points[0]!.x, shape.points[0]!.y);
    for (let i = 1; i < shape.points.length; i++) {
      ctx.lineTo(shape.points[i]!.x, shape.points[i]!.y);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (shape.kind === "arrow") {
    drawArrow(ctx, shape.from, shape.to, shape.color, shape.strokeWidth);
    return;
  }
  if (shape.kind === "rect" || shape.kind === "ellipse") {
    const r = normRect(shape.from, shape.to);
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.strokeWidth;
    if (shape.kind === "rect") {
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    } else {
      ctx.beginPath();
      ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, Math.max(1, r.w / 2), Math.max(1, r.h / 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  if (shape.kind === "text") {
    ctx.fillStyle = shape.color;
    ctx.font = `bold ${shape.fontSize}px system-ui, sans-serif`;
    ctx.fillText(shape.text, shape.at.x, shape.at.y);
    return;
  }
  if (shape.kind === "number") {
    const r = 14 + shape.strokeWidth;
    ctx.fillStyle = shape.color;
    ctx.beginPath();
    ctx.arc(shape.at.x, shape.at.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shape.color === "#ffffff" || shape.color === "#eab308" ? "#111" : "#fff";
    ctx.font = `bold ${Math.round(r * 1.1)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(shape.n), shape.at.x, shape.at.y + 1);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }
}

export function ScreenshotAnnotator({
  mistakeId,
  index,
  hasAnnotated,
  annotatedUrl,
  onClose,
  onSaved,
  onRemoved,
}: ScreenshotAnnotatorProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const baseRef = React.useRef<HTMLImageElement | null>(null);
  const draftRef = React.useRef<Shape | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tool, setTool] = React.useState<Tool>("pen");
  const [color, setColor] = React.useState<string>(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = React.useState(3);
  const [fontSize, setFontSize] = React.useState(28);
  const [shapes, setShapes] = React.useState<Shape[]>([]);
  const [undoStack, setUndoStack] = React.useState<Shape[][]>([]);
  const [redoStack, setRedoStack] = React.useState<Shape[][]>([]);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [zoomMode, setZoomMode] = React.useState<"fit" | "100">("fit");
  const [canvasSize, setCanvasSize] = React.useState({ w: 0, h: 0 });
  const [hint, setHint] = React.useState(
    hasAnnotated
      ? "Editing from original. Use “Edit on top of current annotated version” to start from the annotated PNG."
      : null
  );
  const [textDraft, setTextDraft] = React.useState<{ at: Point; value: string } | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [drawing, setDrawing] = React.useState(false);

  const pushHistory = React.useCallback((next: Shape[]) => {
    setUndoStack((u) => [...u, shapes]);
    setRedoStack([]);
    setShapes(next);
    setDirty(true);
  }, [shapes]);

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    if (!canvas || !base) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
    for (const s of shapes) drawShape(ctx, s);
    if (draftRef.current) drawShape(ctx, draftRef.current);
    if (selectedId) {
      const sel = shapes.find((s) => s.id === selectedId);
      if (sel && (sel.kind === "rect" || sel.kind === "ellipse" || sel.kind === "blur")) {
        const r = normRect(sel.from, sel.to);
        ctx.save();
        ctx.strokeStyle = "#38bdf8";
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
        ctx.restore();
      }
    }
  }, [shapes, selectedId]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    redraw();
  }, [redraw, canvasSize]);

  async function bootFrom(src: string, fromAnnotated: boolean) {
    setLoading(true);
    setError(null);
    try {
      const img = await loadImage(src);
      const long = Math.max(img.naturalWidth, img.naturalHeight);
      const scale = Math.min(1, MAX_LONG_SIDE / long);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      baseRef.current = img;
      setCanvasSize({ w, h });
      setShapes([]);
      setUndoStack([]);
      setRedoStack([]);
      setDirty(false);
      setSelectedId(null);
      setHint(
        fromAnnotated
          ? "Editing on top of the current annotated version."
          : hasAnnotated
            ? "Editing from original. Use “Edit on top of current annotated version” to start from the annotated PNG."
            : null
      );
      requestAnimationFrame(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = w;
          canvas.height = h;
        }
        redraw();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void bootFrom(`/api/admin/mistakes/${mistakeId}/screenshots/${index}/original`, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once on mount
  }, [mistakeId, index]);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((n) => !n.hasAttribute("disabled") && n.tabIndex !== -1);

    const nodes = focusables();
    nodes[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, dirty]);

  function requestClose() {
    if (dirty && !window.confirm("Discard unsaved annotations?")) return;
    onClose();
  }

  function undo() {
    setUndoStack((u) => {
      if (!u.length) return u;
      const prev = u[u.length - 1]!;
      setRedoStack((r) => [...r, shapes]);
      setShapes(prev);
      setDirty(true);
      return u.slice(0, -1);
    });
  }

  function redo() {
    setRedoStack((r) => {
      if (!r.length) return r;
      const next = r[r.length - 1]!;
      setUndoStack((u) => [...u, shapes]);
      setShapes(next);
      setDirty(true);
      return r.slice(0, -1);
    });
  }

  function pointerToCanvas(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (loading || saving) return;
    const p = pointerToCanvas(e);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (tool === "eraser") {
      const hit = [...shapes].reverse().find((s) => hitShape(s, p));
      if (hit) {
        pushHistory(shapes.filter((s) => s.id !== hit.id));
        setSelectedId(null);
      } else {
        setSelectedId(null);
      }
      return;
    }

    if (tool === "text") {
      setTextDraft({ at: p, value: "" });
      return;
    }

    if (tool === "number") {
      const n = shapes.filter((s) => s.kind === "number").length + 1;
      pushHistory([
        ...shapes,
        { id: uid(), kind: "number", at: p, n, color, strokeWidth },
      ]);
      return;
    }

    setDrawing(true);
    const id = uid();
    if (tool === "pen" || tool === "highlighter") {
      draftRef.current = {
        id,
        kind: tool,
        points: [p],
        color,
        strokeWidth,
      };
    } else {
      draftRef.current = {
        id,
        kind: tool === "blur" ? "blur" : tool === "arrow" ? "arrow" : tool === "ellipse" ? "ellipse" : "rect",
        from: p,
        to: p,
        color,
        strokeWidth,
      } as Shape;
    }
    redraw();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing || !draftRef.current) return;
    const p = pointerToCanvas(e);
    const d = draftRef.current;
    if (d.kind === "pen" || d.kind === "highlighter") {
      d.points = [...d.points, p];
    } else if (d.kind === "arrow" || d.kind === "rect" || d.kind === "ellipse" || d.kind === "blur") {
      d.to = p;
    }
    draftRef.current = { ...d } as Shape;
    redraw();
  }

  function onPointerUp() {
    if (!drawing || !draftRef.current) {
      setDrawing(false);
      return;
    }
    const d = draftRef.current;
    draftRef.current = null;
    setDrawing(false);
    if (d.kind === "pen" || d.kind === "highlighter") {
      if (d.points.length >= 2) pushHistory([...shapes, d]);
    } else if (d.kind === "arrow" || d.kind === "rect" || d.kind === "ellipse" || d.kind === "blur") {
      const r = normRect(d.from, d.to);
      if (r.w > 2 || r.h > 2 || d.kind === "arrow") pushHistory([...shapes, d]);
    }
    redraw();
  }

  function confirmText() {
    if (!textDraft) return;
    const text = textDraft.value.trim();
    if (text) {
      pushHistory([
        ...shapes,
        {
          id: uid(),
          kind: "text",
          at: textDraft.at,
          text,
          fontSize,
          color,
          strokeWidth,
        },
      ]);
    }
    setTextDraft(null);
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    if (!canvas || !base) return;
    setSaving(true);
    setError(null);
    try {
      const out = document.createElement("canvas");
      out.width = canvas.width;
      out.height = canvas.height;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("No canvas context");
      ctx.drawImage(base, 0, 0, out.width, out.height);
      for (const s of shapes) drawShape(ctx, s);
      const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Failed to encode PNG");
      const fd = new FormData();
      fd.set("file", blob, `annotated_${index}.png`);
      const res = await fetch(`/api/admin/mistakes/${mistakeId}/screenshots/${index}/annotated`, {
        method: "PUT",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      const url = String(data.annotated_url ?? "");
      if (!url) throw new Error("Missing annotated_url");
      setDirty(false);
      onSaved(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!hasAnnotated) return;
    if (!window.confirm("Remove annotations for this screenshot?")) return;
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/mistakes/${mistakeId}/screenshots/${index}/annotated`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Remove failed");
      setDirty(false);
      onRemoved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setRemoving(false);
    }
  }

  const tools: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: "pen", label: "Pen", icon: <Pencil className="h-4 w-4" /> },
    { id: "arrow", label: "Arrow", icon: <ArrowRight className="h-4 w-4" /> },
    { id: "rect", label: "Box", icon: <Square className="h-4 w-4" /> },
    { id: "ellipse", label: "Ellipse", icon: <Circle className="h-4 w-4" /> },
    { id: "highlighter", label: "Highlight", icon: <Highlighter className="h-4 w-4" /> },
    { id: "text", label: "Text", icon: <Type className="h-4 w-4" /> },
    { id: "number", label: "Marker", icon: <span className="text-xs font-bold">1</span> },
    { id: "blur", label: "Blur", icon: <Minus className="h-4 w-4" /> },
    { id: "eraser", label: "Eraser", icon: <Eraser className="h-4 w-4" /> },
  ];

  if (!mounted) return null;

  const displayStyle =
    zoomMode === "100"
      ? { width: canvasSize.w, height: canvasSize.h, maxWidth: "none" as const }
      : { width: "100%", height: "auto", maxWidth: "100%" as const };

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[400] flex flex-col bg-zinc-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="screenshot-annotator-title"
      data-mobile-chrome-hide
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2">
        <h2 id="screenshot-annotator-title" className="mr-auto text-sm font-semibold">
          Annotate screenshot
        </h2>
        {hasAnnotated && annotatedUrl ? (
          <button
            type="button"
            className="rounded-lg border border-white/15 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
            onClick={() => void bootFrom(annotatedUrl, true)}
          >
            Edit on top of current annotated version
          </button>
        ) : null}
        <button
          type="button"
          onClick={requestClose}
          className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Close annotator"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-white/10 px-2 py-2">
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            aria-label={t.label}
            aria-pressed={tool === t.id}
            onClick={() => setTool(t.id)}
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs ${
              tool === t.id
                ? "border-pink-500/40 bg-pink-500/20 text-pink-200"
                : "border-white/10 text-white/60 hover:bg-white/5"
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
        <div className="mx-1 h-6 w-px shrink-0 bg-white/10" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            onClick={() => setColor(c)}
            className={`h-6 w-6 shrink-0 rounded-full border-2 ${
              color === c ? "border-white" : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <label className="ml-2 flex shrink-0 items-center gap-1 text-xs text-white/50">
          Width
          <input
            type="range"
            min={1}
            max={16}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-20"
          />
        </label>
        {tool === "text" ? (
          <label className="flex shrink-0 items-center gap-1 text-xs text-white/50">
            Font
            <input
              type="range"
              min={14}
              max={64}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-20"
            />
          </label>
        ) : null}
        <button type="button" onClick={undo} className="rounded-lg border border-white/10 p-1.5 text-white/60 hover:bg-white/5" aria-label="Undo">
          <Undo2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={redo} className="rounded-lg border border-white/10 p-1.5 text-white/60 hover:bg-white/5" aria-label="Redo">
          <Redo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!shapes.length) return;
            pushHistory([]);
          }}
          className="rounded-lg border border-white/10 p-1.5 text-white/60 hover:bg-white/5"
          aria-label="Clear all"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoomMode((z) => (z === "fit" ? "100" : "fit"))}
          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/60 hover:bg-white/5"
          aria-label={zoomMode === "fit" ? "Zoom 100%" : "Zoom fit"}
        >
          {zoomMode === "fit" ? <ZoomIn className="inline h-4 w-4" /> : <ZoomOut className="inline h-4 w-4" />}{" "}
          {zoomMode === "fit" ? "100%" : "Fit"}
        </button>
      </div>

      {hint ? <p className="shrink-0 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200/90">{hint}</p> : null}
      {error ? <p className="shrink-0 bg-red-500/15 px-3 py-1.5 text-xs text-red-300">{error}</p> : null}

      <div className="relative min-h-0 flex-1 overflow-auto bg-black/60 p-3">
        {loading ? (
          <p className="text-sm text-white/50">Loading original…</p>
        ) : (
          <div className="relative inline-block max-w-full">
            <canvas
              ref={canvasRef}
              width={canvasSize.w || 1}
              height={canvasSize.h || 1}
              style={displayStyle}
              className="touch-none rounded-lg border border-white/10 bg-black"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            {textDraft ? (
              <div
                className="absolute z-10"
                style={{
                  left: `${(textDraft.at.x / (canvasSize.w || 1)) * 100}%`,
                  top: `${(textDraft.at.y / (canvasSize.h || 1)) * 100}%`,
                }}
              >
                <input
                  autoFocus
                  value={textDraft.value}
                  onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmText();
                    }
                    if (e.key === "Escape") setTextDraft(null);
                  }}
                  onBlur={confirmText}
                  className="rounded border border-pink-400/50 bg-black/80 px-2 py-1 text-sm text-white outline-none"
                  placeholder="Type, Enter to place"
                  style={{ fontSize }}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
        <div className="flex gap-2">
          {hasAnnotated ? (
            <button
              type="button"
              disabled={removing || saving}
              onClick={() => void handleRemove()}
              className="rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-sm text-red-300 hover:bg-red-500/25 disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove annotations"}
            </button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={requestClose}
            className="rounded-xl border border-white/15 px-3 py-2 text-sm text-white/70 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading || shapes.length === 0}
            onClick={() => void handleSave()}
            className="rounded-xl border border-pink-500/40 bg-pink-500/25 px-4 py-2 text-sm font-semibold text-pink-100 hover:bg-pink-500/35 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save annotations"}
          </button>
        </div>
      </footer>
    </div>,
    document.body
  );
}
