"use client";

/**
 * Decorative layer: `fixed` so gradient orbs stay in the viewport on mobile while main content
 * scrolls; `z-0` + `pointer-events-none` so taps reach UI above.
 */
export function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Gradient orbs — boosted for visibility while debugging */}
      <div
        className="animate-float-slow absolute -left-1/3 -top-1/3 h-[600px] w-[600px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(236,72,153,0.8) 0%, rgba(236,72,153,0.45) 40%, transparent 70%)",
          opacity: 0.8,
          animationDuration: "20s",
        }}
      />
      <div
        className="animate-float-slow absolute -bottom-1/3 -right-1/3 h-[600px] w-[600px] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(168,85,247,0.8) 0%, rgba(168,85,247,0.45) 40%, transparent 70%)",
          opacity: 0.8,
          animationDuration: "25s",
          animationDelay: "5s",
        }}
      />
      <div
        className="animate-pulse absolute right-1/4 top-1/4 h-[400px] w-[400px] rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(251,191,36,0.55) 0%, transparent 60%)",
          opacity: 0.65,
          animationDuration: "15s",
          animationDelay: "3s",
        }}
      />

      {/* Floating particles */}
      {[...Array(12)].map((_, i) => {
        const hue = i % 3 === 0 ? "#ec4899" : i % 3 === 1 ? "#a855f7" : "#fbbf24";
        return (
          <div
            key={i}
            className="animate-float-particle absolute rounded-full"
            style={{
              width: `${4 + (i % 4) * 2}px`,
              height: `${4 + (i % 4) * 2}px`,
              left: `${5 + i * 8}%`,
              top: `${10 + ((i * 6) % 70)}%`,
              background: hue,
              color: hue,
              opacity: 0.7,
              animationDelay: `${i * 1.5}s`,
              animationDuration: `${10 + (i % 3) * 3}s`,
              boxShadow: "0 0 10px currentColor",
            }}
          />
        );
      })}

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(236,72,153,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(236,72,153,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />
    </div>
  );
}
