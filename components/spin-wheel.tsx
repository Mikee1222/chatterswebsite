"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { spinWheelAction } from "@/app/actions/spin-wheel";
import { cn } from "@/lib/utils";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";

export type SpinPrizeClient = {
  id: string;
  label: string;
  color: string;
  prize_type: string;
  prize_value: string;
  probability: number;
};

export type SpinRecentWin = {
  id: string;
  prize_label: string;
  created_at: string;
};

/** Default when parent does not pass config (rewards page only sends prizes). */
const DEFAULT_POINTS_PER_SPIN = 500;

const CONFETTI_COLORS = ["#ec4899", "#D4AF37", "#8b5cf6", "#3b82f6", "#10b981"] as const;

function mulberry32(seed: number) {
  return () => {
    let a = seed;
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** CSS cubic-bezier(0.17, 0.67, 0.12, 0.99) as progress 0→1 for time 0→1. */
function cubicBezierEase(x1: number, y1: number, x2: number, y2: number) {
  function sampleX(t: number): number {
    const o = 1 - t;
    return 3 * o * o * t * x1 + 3 * o * t * t * x2 + t * t * t;
  }
  function sampleY(t: number): number {
    const o = 1 - t;
    return 3 * o * o * t * y1 + 3 * o * t * t * y2 + t * t * t;
  }
  return function ease(linearT: number): number {
    if (linearT <= 0) return 0;
    if (linearT >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) * 0.5;
      if (sampleX(mid) < linearT) lo = mid;
      else hi = mid;
    }
    const t = (lo + hi) * 0.5;
    return sampleY(t);
  };
}

const easeSpinStop = cubicBezierEase(0.17, 0.67, 0.12, 0.99);

let audioCtxSingleton: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (typeof window === "undefined") throw new Error("Audio only in browser");
  if (!audioCtxSingleton) audioCtxSingleton = new AudioContext();
  return audioCtxSingleton;
}

function playSpinSound() {
  try {
    const ctx = getAudioContext();
    void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    /* ignore */
  }
}

function playWinSound() {
  try {
    const ctx = getAudioContext();
    void ctx.resume();
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.3);
    });
  } catch {
    /* ignore */
  }
}

function ConfettiBurst({ seed, fading }: { seed: number; fading: boolean }) {
  const particles = React.useMemo(() => {
    const rnd = mulberry32(seed);
    return Array.from({ length: 20 }, () => ({
      left: rnd() * 100,
      top: rnd() * 100,
      delay: rnd() * 0.6,
      duration: 0.55 + rnd() * 0.45,
      color: CONFETTI_COLORS[Math.floor(rnd() * CONFETTI_COLORS.length)] ?? CONFETTI_COLORS[0],
    }));
  }, [seed]);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-[250] transition-opacity duration-500",
        fading ? "opacity-0" : "opacity-100"
      )}
      aria-hidden
    >
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute h-2 w-2 rounded-full animate-bounce"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function prizeEmoji(prizeType: string): string {
  const t = prizeType.toLowerCase();
  if (t === "cash" || t === "bonus") return "💰";
  if (t === "extra_break" || t === "break") return "⏰";
  if (t === "double_points") return "2️⃣";
  if (t === "custom" || t === "mystery") return "🎁";
  if (t === "points") return "⭐";
  return "🎁";
}

function formatTimeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

const SPIN_DURATION_MS = 4000;

function localToast(
  id: string,
  title: string,
  body: string,
  priority: "normal" | "high" = "normal"
): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local-user",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

function shortLabel(raw: string, max = 10): string {
  const s = raw.trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wheelSlicePath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number
) {
  const sOuter = polarToCartesian(cx, cy, outerR, startDeg);
  const eOuter = polarToCartesian(cx, cy, outerR, endDeg);
  const sInner = polarToCartesian(cx, cy, innerR, endDeg);
  const eInner = polarToCartesian(cx, cy, innerR, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${sOuter.x} ${sOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${eOuter.x} ${eOuter.y}`,
    `L ${sInner.x} ${sInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${eInner.x} ${eInner.y}`,
    "Z",
  ].join(" ");
}

export function SpinWheel({
  prizes,
  initialSpinsAvailable,
  recentWins,
  onAfterSpin,
}: {
  prizes: SpinPrizeClient[];
  initialSpinsAvailable: number;
  recentWins: SpinRecentWin[];
  onAfterSpin?: (remaining: number) => void;
}) {
  const { addToast } = useToast();
  const [spinsAvailable, setSpinsAvailable] = React.useState(initialSpinsAvailable);
  React.useEffect(() => {
    setSpinsAvailable(initialSpinsAvailable);
  }, [initialSpinsAvailable]);

  const [rotation, setRotation] = React.useState(0);
  const rotationRef = React.useRef(0);
  React.useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  const [spinning, setSpinning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [modalPrize, setModalPrize] = React.useState<{
    label: string;
    prize_type: string;
    prize_value: string;
    color: string;
  } | null>(null);
  const [confettiSeed, setConfettiSeed] = React.useState(0);
  const [showConfetti, setShowConfetti] = React.useState(false);
  const [confettiFading, setConfettiFading] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [logoFailed, setLogoFailed] = React.useState(false);
  const [hasSpunOnce, setHasSpunOnce] = React.useState(false);
  const [showPrizeReveal, setShowPrizeReveal] = React.useState(false);

  const wheelRef = React.useRef<SVGGElement>(null);
  const spinRafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setMounted(true);
    return () => {
      if (spinRafRef.current != null) cancelAnimationFrame(spinRafRef.current);
    };
  }, []);

  const n = prizes.length;
  const arc = 360 / Math.max(1, n);

  function applyWheelTransform(deg: number) {
    const el = wheelRef.current;
    if (!el) return;
    /** ViewBox center (200,200) — fill-box on <g> can be off-center for donut slices; keep spin axis on hub. */
    el.style.transformBox = "fill-box";
    el.style.transformOrigin = "200px 200px";
    el.style.transform = `rotate(${deg}deg)`;
  }

  React.useEffect(() => {
    if (!spinning) applyWheelTransform(rotation);
  }, [rotation, spinning]);

  const wheelTransformStyle: React.CSSProperties = spinning
    ? {
        willChange: "transform",
        transformBox: "fill-box",
        transformOrigin: "200px 200px",
      }
    : {
        transform: `rotate(${rotation}deg)`,
        transformBox: "fill-box",
        transformOrigin: "200px 200px",
        willChange: "transform",
      };

  function runSpinAnimation(fromDeg: number, toDeg: number, onDone: () => void) {
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / SPIN_DURATION_MS);
      const eased = easeSpinStop(t);
      const ang = fromDeg + (toDeg - fromDeg) * eased;
      applyWheelTransform(ang);
      if (t < 1) {
        spinRafRef.current = requestAnimationFrame(tick);
      } else {
        spinRafRef.current = null;
        onDone();
      }
    };
    spinRafRef.current = requestAnimationFrame(tick);
  }

  async function handleSpin() {
    if (spinning || spinsAvailable < 1 || n === 0) return;
    setError(null);
    setSpinning(true);
    playSpinSound();
    try {
      const res = await spinWheelAction();
      if (!res.success) {
        setError(res.error);
        addToast(localToast(`spin-err-${Date.now()}`, "Spin failed", res.error, "high"));
        setSpinning(false);
        return;
      }
      const from = rotationRef.current;
      const to = from + res.rotationDelta;
      const prize = res.prize;
      setSpinsAvailable(res.newSpinsAvailable);
      onAfterSpin?.(res.newSpinsAvailable);

      runSpinAnimation(from, to, () => {
        setRotation(to);
        rotationRef.current = to;
        setSpinning(false);
        setHasSpunOnce(true);
        setShowPrizeReveal(true);
        playWinSound();
        setConfettiFading(false);
        setConfettiSeed((s) => s + 1);
        setShowConfetti(true);
        setModalPrize({
          label: prize.label,
          prize_type: prize.prize_type,
          prize_value: prize.prize_value,
          color: prize.color,
        });
        addToast(
          localToast(
            `spin-win-${Date.now()}`,
            "You won a prize!",
            `${prizeEmoji(prize.prize_type)} ${prize.label}`,
            "normal"
          )
        );
        window.setTimeout(() => setConfettiFading(true), 3000);
        window.setTimeout(() => {
          setShowConfetti(false);
          setConfettiFading(false);
        }, 3600);
        window.setTimeout(() => setShowPrizeReveal(false), 900);
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Spin failed.";
      setError(msg);
      addToast(localToast(`spin-err-${Date.now()}`, "Spin failed", msg, "high"));
      setSpinning(false);
    }
  }

  function closeModal() {
    setModalPrize(null);
  }

  function claimAndClose() {
    setConfettiFading(false);
    setConfettiSeed((s) => s + 1);
    setShowConfetti(true);
    window.setTimeout(() => setConfettiFading(true), 2800);
    window.setTimeout(() => {
      setShowConfetti(false);
      setConfettiFading(false);
      closeModal();
    }, 3300);
  }

  const modal =
    mounted && modalPrize
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-md"
            style={{ backgroundColor: "rgba(13,13,13,0.88)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="spin-prize-title"
            onClick={closeModal}
          >
            <div
              className={cn(
                "max-w-sm rounded-2xl border p-8 text-center shadow-2xl",
                showPrizeReveal ? "prize-reveal" : ""
              )}
              style={{
                borderColor: "rgba(212,175,55,0.35)",
                background: "linear-gradient(180deg, #1a1015 0%, #0d0d0d 100%)",
                boxShadow: `0 0 40px rgba(236,72,153,0.15), 0 0 80px ${modalPrize.color}22`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-5xl" aria-hidden>
                {prizeEmoji(modalPrize.prize_type)}
              </div>
              <h2 id="spin-prize-title" className="mt-4 text-2xl font-bold text-white">
                {modalPrize.label}
              </h2>
              <p className="mt-2 text-sm text-white/55">
                {modalPrize.prize_type === "points"
                  ? "Points have been added to your balance."
                  : modalPrize.prize_type === "cash" ||
                      modalPrize.prize_type === "bonus" ||
                      modalPrize.prize_type === "extra_break" ||
                      modalPrize.prize_type === "break"
                    ? "Our team will confirm this reward. You can track it under recent wins."
                    : modalPrize.prize_type === "custom" || modalPrize.prize_type === "mystery"
                      ? "Admin will be in touch to fulfill this special prize."
                      : "Enjoy your reward!"}
              </p>
              <button
                type="button"
                onClick={claimAndClose}
                className="mt-8 w-full rounded-xl py-3 text-sm font-semibold text-white"
                style={{
                  background: "linear-gradient(135deg, #ec4899 0%, #c026a0 50%, #ec4899 100%)",
                  boxShadow: "0 4px 20px rgba(236,72,153,0.35)",
                }}
              >
                Claim
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  if (n === 0) return null;

  const spinButtonLabel = spinning ? "SPINNING..." : hasSpunOnce ? "SPIN AGAIN" : "SPIN NOW";

  return (
    <section
      className="spin-wheel overflow-hidden rounded-2xl border p-6 sm:p-8"
      style={{
        background:
          "radial-gradient(1200px 450px at 5% -10%, rgba(236,72,153,0.28), transparent 55%), radial-gradient(900px 380px at 100% 0%, rgba(147,51,234,0.22), transparent 50%), linear-gradient(180deg, #110f14 0%, #0d0d0d 100%)",
        borderColor: "rgba(236,72,153,0.12)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 24px 48px rgba(0,0,0,0.55)",
      }}
    >
      {mounted && showConfetti ? createPortal(<ConfettiBurst seed={confettiSeed} fading={confettiFading} />, document.body) : null}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.45)" }}>
          Spin wheel
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: "rgba(236,72,153,0.15)",
              border: "1px solid rgba(236,72,153,0.45)",
              color: "#fbcfe8",
            }}
          >
            {spinsAvailable} spin{spinsAvailable === 1 ? "" : "s"} available
          </span>
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "rgba(255,255,255,0.78)",
            }}
          >
            Remaining spins: {spinsAvailable}
          </span>
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold tabular-nums"
            style={{
              backgroundColor: "rgba(212,175,55,0.1)",
              border: "1px solid rgba(212,175,55,0.45)",
              color: "#fde68a",
            }}
          >
            {DEFAULT_POINTS_PER_SPIN} pts / spin
          </span>
        </div>
      </div>

      <div className="relative mx-auto flex max-w-[360px] flex-col items-center">
        <div className="relative mx-auto w-full max-w-[320px] sm:max-w-sm">
          <div
            className="animate-wheel-glow absolute inset-0 rounded-full bg-gradient-to-br from-pink-500/20 via-purple-500/15 to-amber-500/20 blur-3xl"
            style={{ animationDuration: "4s" }}
          />
          <div className="animate-wheel-float relative" style={{ animationDuration: "4s" }}>
            <svg viewBox="0 0 400 400" className="w-full drop-shadow-2xl">
              <defs>
                <radialGradient id="outerRing" cx="50%" cy="45%" r="70%">
                  <stop offset="0%" stopColor="#2a2a2a" />
                  <stop offset="100%" stopColor="#1a1a1a" />
                </radialGradient>
                <radialGradient id="centerGradient" cx="50%" cy="45%" r="70%">
                  <stop offset="0%" stopColor="#3a3a3a" />
                  <stop offset="100%" stopColor="#1a1a1a" />
                </radialGradient>
              </defs>

              <circle cx="200" cy="200" r="195" fill="url(#outerRing)" stroke="#d97706" strokeWidth="3" />
              <circle cx="200" cy="200" r="190" fill="#1a1a1a" />

              <g ref={wheelRef} style={wheelTransformStyle}>
                {prizes.map((p, i) => {
                  const startDeg = -90 + i * arc;
                  const endDeg = startDeg + arc;
                  const labelDeg = startDeg + arc / 2;
                  const textPos = polarToCartesian(200, 200, 138, labelDeg);
                  const t = p.prize_type.toLowerCase();
                  const segmentStyle =
                    t === "points"
                      ? { fill: "#065f46", stroke: "#10b981" }
                      : t === "extra_break" || t === "break"
                        ? { fill: "#0c4a6e", stroke: "#38bdf8" }
                        : t === "cash" || t === "bonus"
                          ? { fill: "#713f12", stroke: "#f59e0b" }
                          : t === "double_points"
                            ? { fill: "#4c1d95", stroke: "#a78bfa" }
                            : t === "custom" || t === "mystery"
                              ? { fill: "#831843", stroke: "#f472b6" }
                              : { fill: "#064e3b", stroke: "#34d399" };
                  return (
                    <g key={p.id}>
                      <path
                        d={wheelSlicePath(200, 200, 65, 182, startDeg, endDeg)}
                        fill={segmentStyle.fill}
                        stroke={segmentStyle.stroke}
                        strokeWidth="2"
                        className="transition-all duration-300 hover:brightness-125"
                      />
                      <text
                        x={textPos.x}
                        y={textPos.y}
                        fill="#fff"
                        fontSize="13"
                        fontWeight="600"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="pointer-events-none"
                        style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}
                      >
                        {prizeEmoji(p.prize_type)} {shortLabel(p.label, 14)}
                      </text>
                    </g>
                  );
                })}
                <foreignObject x="0" y="0" width="400" height="400" pointerEvents="none">
                  {/* XHTML body in foreignObject requires xmlns; not in React's div typings. */}
                  <div
                    {...({
                      xmlns: "http://www.w3.org/1999/xhtml",
                      className: "wheel-gleam-fo",
                      "aria-hidden": true,
                    } as React.HTMLAttributes<HTMLDivElement>)}
                  />
                </foreignObject>
              </g>

              <circle cx="200" cy="200" r="60" fill="url(#centerGradient)" />
              <circle cx="200" cy="200" r="60" fill="#0a0a0a" stroke="#d97706" strokeWidth="2" />
            </svg>

            <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-[60px] w-[60px] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full">
              {!logoFailed ? (
                <img
                  src="/apple-touch-icon.png"
                  width={60}
                  height={60}
                  alt=""
                  className="h-[60px] w-[60px] rounded-full object-cover"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span className="font-serif text-2xl font-semibold leading-none text-pink-400">G</span>
              )}
            </div>

            <div className="absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-3" aria-hidden>
              <div className="h-0 w-0 border-l-[18px] border-r-[18px] border-t-[35px] border-l-transparent border-r-transparent border-t-amber-500 drop-shadow-lg" />
              <div className="absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-l-[14px] border-r-[14px] border-t-[28px] border-l-transparent border-r-transparent border-t-amber-400" />
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={spinning || spinsAvailable < 1}
          onClick={handleSpin}
          className="mt-8 min-h-14 w-full max-w-[260px] rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 px-10 py-4 text-lg font-bold text-white shadow-xl shadow-pink-500/30 transition-all duration-200 hover:-translate-y-1 hover:shadow-pink-500/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {spinButtonLabel}
        </button>
        {spinning ? (
          <p className="mt-2 text-xs font-medium text-white/70 animate-pulse">
            Spinning... calculating your prize
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {prizes.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/60"
            >
              <span aria-hidden>{prizeEmoji(p.prize_type)} </span>
              {shortLabel(p.label, 16)}
            </div>
          ))}
        </div>

        {error ? <p className="mt-3 text-center text-sm text-red-400">{error}</p> : null}
      </div>

      {recentWins.length > 0 ? (
        <div className="mt-8 border-t pt-5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
            Recent wins
          </h3>
          <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
            {recentWins.map((w) => (
              <li key={w.id} className="flex justify-between gap-3" style={{ color: "rgba(255,255,255,0.72)" }}>
                <span className="min-w-0 truncate">{w.prize_label}</span>
                <span className="shrink-0 text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>
                  {formatTimeAgo(w.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {modal}
      <style jsx>{`
        .wheel-gleam-fo {
          width: 400px;
          height: 400px;
          border-radius: 50%;
          pointer-events: none;
          background: linear-gradient(120deg, transparent 35%, rgba(255, 255, 255, 0.18) 50%, transparent 65%);
          animation: wheel-gleam 4s ease-in-out infinite;
          mix-blend-mode: screen;
        }
        .prize-reveal {
          animation: prize-pop 450ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .animate-wheel-glow {
          animation: wheel-glow ease-in-out infinite;
        }
        .animate-wheel-float {
          animation: wheel-float ease-in-out infinite;
        }
        @keyframes wheel-glow {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.8;
          }
        }
        /* Vertical bob only — any rotate here desyncs the fixed pointer from segment geometry. */
        @keyframes wheel-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        @keyframes wheel-gleam {
          0%,
          100% {
            transform: translateX(-28%) rotate(-12deg);
            opacity: 0.45;
          }
          50% {
            transform: translateX(28%) rotate(-12deg);
            opacity: 0.8;
          }
        }
        @keyframes prize-pop {
          0% {
            transform: translateY(8px) scale(0.94);
            opacity: 0;
          }
          70% {
            transform: translateY(-3px) scale(1.02);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </section>
  );
}
