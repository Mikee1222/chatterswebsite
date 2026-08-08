"use client";

/**
 * Decorative layer: `fixed` so gradient orbs stay in the viewport on mobile while main content
 * scrolls; `z-0` + `pointer-events-none` so taps reach UI above.
 * Palette: Gunzo pink #FF1493 + champagne #D4AF8C (matches VA_CARD luxury language).
 */
export function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Soft base wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 100% 70% at 50% -10%, rgba(255,20,147,0.09) 0%, transparent 55%), radial-gradient(ellipse 80% 50% at 100% 100%, rgba(212,175,140,0.06) 0%, transparent 50%)",
        }}
      />

      {/* Gradient orbs — pink / champagne (no purple) */}
      <div
        className="absolute -left-1/3 -top-1/3 h-[560px] w-[560px] rounded-full blur-3xl motion-safe:animate-float-slow motion-reduce:animate-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,20,147,0.55) 0%, rgba(255,20,147,0.22) 42%, transparent 70%)",
          opacity: 0.72,
          animationDuration: "22s",
        }}
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 h-[520px] w-[520px] rounded-full blur-3xl motion-safe:animate-float-slow motion-reduce:animate-none"
        style={{
          background:
            "radial-gradient(circle, rgba(212,175,140,0.42) 0%, rgba(212,175,140,0.16) 40%, transparent 70%)",
          opacity: 0.7,
          animationDuration: "26s",
          animationDelay: "4s",
        }}
      />
      <div
        className="absolute right-1/5 top-1/4 h-[360px] w-[360px] rounded-full blur-3xl motion-safe:animate-pulse motion-reduce:animate-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,20,147,0.28) 0%, rgba(212,175,140,0.12) 45%, transparent 68%)",
          opacity: 0.55,
          animationDuration: "16s",
          animationDelay: "2s",
        }}
      />

      {/* Glow dots / floating particles */}
      {[...Array(10)].map((_, i) => {
        const hue = i % 2 === 0 ? "#FF1493" : "#D4AF8C";
        return (
          <div
            key={i}
            className="absolute rounded-full motion-safe:animate-float-particle motion-reduce:hidden"
            style={{
              width: `${3 + (i % 4) * 2}px`,
              height: `${3 + (i % 4) * 2}px`,
              left: `${6 + i * 9}%`,
              top: `${12 + ((i * 7) % 68)}%`,
              background: hue,
              color: hue,
              opacity: 0.55,
              animationDelay: `${i * 1.4}s`,
              animationDuration: `${11 + (i % 3) * 3}s`,
              boxShadow: "0 0 12px currentColor",
            }}
          />
        );
      })}

      {/* Fine grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,20,147,0.35) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,175,140,0.28) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}
