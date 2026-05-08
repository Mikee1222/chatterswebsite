"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, Download, RotateCcw, ZoomIn, ZoomOut, Trash2 } from "lucide-react";

export interface BlurRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  blurAmount: number;
}

function applyBoxBlur(imageData: ImageData, radius: number): ImageData {
  const { data, width, height } = imageData;
  const rd = Math.max(1, Math.min(30, Math.floor(radius)));
  const result = new ImageData(new Uint8ClampedArray(data), width, height);
  const out = result.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;

      for (let ky = -rd; ky <= rd; ky++) {
        for (let kx = -rd; kx <= rd; kx++) {
          const nx = Math.min(Math.max(x + kx, 0), width - 1);
          const ny = Math.min(Math.max(y + ky, 0), height - 1);
          const idx = (ny * width + nx) * 4;
          r += data[idx]!;
          g += data[idx + 1]!;
          b += data[idx + 2]!;
          a += data[idx + 3]!;
          count++;
        }
      }

      const idx = (y * width + x) * 4;
      out[idx] = Math.round(r / count);
      out[idx + 1] = Math.round(g / count);
      out[idx + 2] = Math.round(b / count);
      out[idx + 3] = Math.round(a / count);
    }
  }
  return result;
}

export function VABlurToolClient() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [regions, setRegions] = useState<BlurRegion[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const drawStartRef = useRef({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<BlurRegion | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [blurAmount, setBlurAmount] = useState(10);
  const [scale, setScale] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const currentRectRef = useRef<BlurRegion | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const region of regions) {
      const x = region.x * canvas.width;
      const y = region.y * canvas.height;
      const w = region.width * canvas.width;
      const h = region.height * canvas.height;
      const xi = Math.max(0, Math.floor(x));
      const yi = Math.max(0, Math.floor(y));
      const wi = Math.max(1, Math.min(canvas.width - xi, Math.ceil(w)));
      const hi = Math.max(1, Math.min(canvas.height - yi, Math.ceil(h)));

      const imageData = ctx.getImageData(xi, yi, wi, hi);
      const blurred = applyBoxBlur(imageData, region.blurAmount);
      ctx.putImageData(blurred, xi, yi);
    }
  }, [image, regions]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    const img = new Image();
    img.onload = () => {
      setImage(img);
      setRegions([]);
      setSelectedRegion(null);
      setCurrentRect(null);

      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const container = containerRef.current;
      if (container) {
        const maxW = Math.max(200, container.clientWidth - 32);
        const maxH = typeof window !== "undefined" ? window.innerHeight * 0.58 : 480;
        const scaleX = maxW / img.naturalWidth;
        const scaleY = maxH / img.naturalHeight;
        setScale(Math.min(scaleX, scaleY, 1));
      } else {
        setScale(1);
      }
    };
    img.src = url;
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }

  function getRelativePos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return {
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!image) return;
    const pos = getRelativePos(e);
    setIsDrawing(true);
    drawStartRef.current = pos;
    const next: BlurRegion = {
      id: `${Date.now()}`,
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      blurAmount,
    };
    currentRectRef.current = next;
    setCurrentRect(next);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const pos = getRelativePos(e);
    const start = drawStartRef.current;
    setCurrentRect((prev) => {
      const next = !prev
        ? {
            id: `${Date.now()}`,
            x: start.x,
            y: start.y,
            width: pos.x - start.x,
            height: pos.y - start.y,
            blurAmount,
          }
        : { ...prev, width: pos.x - start.x, height: pos.y - start.y };
      currentRectRef.current = next;
      return next;
    });
  }

  function finishDraw() {
    const cr = currentRectRef.current;
    setIsDrawing(false);
    setCurrentRect(null);
    currentRectRef.current = null;
    if (!cr) return;
    const normalized = {
      ...cr,
      x: cr.width < 0 ? cr.x + cr.width : cr.x,
      y: cr.height < 0 ? cr.y + cr.height : cr.y,
      width: Math.abs(cr.width),
      height: Math.abs(cr.height),
    };
    if (normalized.width > 0.005 && normalized.height > 0.005) {
      setRegions((prev) => [...prev, normalized]);
    }
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas || !imageFile) return;
    const isJpeg = imageFile.type === "image/jpeg";
    const mimeType = isJpeg ? "image/jpeg" : "image/png";
    const quality = isJpeg ? 0.98 : undefined;

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `blurred_${imageFile.name}`;
        a.click();
        URL.revokeObjectURL(url);
      },
      mimeType,
      quality
    );
  }

  function removeRegion(id: string) {
    setRegions((prev) => prev.filter((r) => r.id !== id));
    setSelectedRegion(null);
  }

  function updateRegionBlur(id: string, amount: number) {
    setRegions((prev) => prev.map((r) => (r.id === id ? { ...r, blurAmount: amount } : r)));
  }

  const nw = image?.naturalWidth ?? 0;
  const nh = image?.naturalHeight ?? 0;
  const displayW = nw * scale;
  const displayH = nh * scale;

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Photo blur tool</h1>
        <p className="mt-1 text-sm text-white/50">Upload a photo, draw regions to blur, then download at full quality.</p>
      </div>

      {!image && (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="cursor-pointer rounded-2xl border-2 border-dashed border-white/20 p-12 text-center transition-all hover:border-pink-500/50 hover:bg-white/[0.03] md:p-16"
        >
          <Upload className="mx-auto mb-4 h-12 w-12 text-white/30" aria-hidden />
          <p className="font-medium text-white/60">Drop a photo here or click to upload</p>
          <p className="mt-1 text-sm text-white/30">PNG, JPG, WEBP — full resolution on export</p>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      {image && (
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
              >
                <Upload className="h-4 w-4" aria-hidden /> New photo
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <span className="text-xs text-white/40">Blur:</span>
                <input
                  type="range"
                  min={2}
                  max={30}
                  value={blurAmount}
                  onChange={(e) => setBlurAmount(Number(e.target.value))}
                  className="w-24 accent-pink-500"
                />
                <span className="w-6 text-sm text-white/70">{blurAmount}</span>
              </div>

              <button
                type="button"
                onClick={() => setScale((s) => Math.min(s + 0.1, 2))}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10"
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(s - 0.1, 0.2))}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10"
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" aria-hidden />
              </button>

              <button
                type="button"
                onClick={() => {
                  setRegions([]);
                  setSelectedRegion(null);
                }}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> Clear all
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="ml-auto flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                <Download className="h-4 w-4" aria-hidden /> Download
              </button>
            </div>

            <div
              ref={containerRef}
              className="relative max-h-[65vh] overflow-auto rounded-2xl border border-white/10 bg-[#0a0a14]"
            >
              {regions.length === 0 && (
                <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-xs text-white/60 backdrop-blur-sm">
                  Draw a rectangle on the photo to blur that area
                </div>
              )}

              <div className="relative inline-block" style={{ width: displayW, height: displayH }}>
                <canvas
                  ref={canvasRef}
                  width={nw}
                  height={nh}
                  style={{
                    width: displayW,
                    height: displayH,
                    display: "block",
                    cursor: "crosshair",
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={finishDraw}
                  onMouseLeave={finishDraw}
                />
                <svg
                  className="pointer-events-none absolute left-0 top-0"
                  width={displayW}
                  height={displayH}
                  viewBox={`0 0 ${nw} ${nh}`}
                  preserveAspectRatio="none"
                >
                  {regions.map((region) => (
                    <rect
                      key={region.id}
                      x={region.x * nw}
                      y={region.y * nh}
                      width={region.width * nw}
                      height={region.height * nh}
                      fill="transparent"
                      stroke={selectedRegion === region.id ? "#f472b6" : "#818cf8"}
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {currentRect && (
                    <rect
                      x={(currentRect.width < 0 ? currentRect.x + currentRect.width : currentRect.x) * nw}
                      y={(currentRect.height < 0 ? currentRect.y + currentRect.height : currentRect.y) * nh}
                      width={Math.abs(currentRect.width) * nw}
                      height={Math.abs(currentRect.height) * nh}
                      fill="rgba(244,114,182,0.15)"
                      stroke="#f472b6"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </svg>
              </div>
            </div>

            <p className="mt-2 text-xs text-white/30">
              {nw} × {nh}px · {regions.length} blur region{regions.length !== 1 ? "s" : ""}
            </p>
          </div>

          {regions.length > 0 && (
            <div className="w-full shrink-0 lg:w-64">
              <h3 className="mb-3 text-xs uppercase tracking-widest text-white/40">Blur regions</h3>
              <div className="space-y-2">
                {regions.map((region, i) => (
                  <div
                    key={region.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        setSelectedRegion(region.id === selectedRegion ? null : region.id);
                    }}
                    onClick={() => setSelectedRegion(region.id === selectedRegion ? null : region.id)}
                    className={`cursor-pointer rounded-xl border p-3 transition-all ${
                      selectedRegion === region.id ? "border-pink-500/40 bg-pink-500/5" : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-white">Region {i + 1}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRegion(region.id);
                        }}
                        className="text-white/30 hover:text-red-400"
                        title="Remove region"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40">Blur</span>
                      <input
                        type="range"
                        min={2}
                        max={30}
                        value={region.blurAmount}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateRegionBlur(region.id, Number(e.target.value));
                        }}
                        className="min-w-0 flex-1 accent-pink-500"
                      />
                      <span className="w-4 text-xs text-white/60">{region.blurAmount}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleDownload}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-3 text-sm font-semibold text-white hover:opacity-90"
              >
                <Download className="h-4 w-4" aria-hidden /> Download photo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
