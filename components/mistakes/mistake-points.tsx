"use client";

export function MistakePoints({
  points,
  className = "",
}: {
  points: number;
  className?: string;
}) {
  const n = Number.isFinite(points) ? Math.abs(Math.round(points)) : 0;
  return (
    <span className={`font-semibold tabular-nums text-red-400 ${className}`} title={`${n} points`}>
      −{n} pts
    </span>
  );
}
