import { cn } from "@/lib/utils";

export function SopGlowBadge({
  children,
  className,
  glowClassName,
}: {
  children: React.ReactNode;
  className?: string;
  glowClassName?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        className,
        glowClassName
      )}
    >
      {children}
    </span>
  );
}
