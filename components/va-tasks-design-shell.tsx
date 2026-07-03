import { cn } from "@/lib/utils";

/** Wraps VA Tasks pages with warm boutique base surface (app default font stack). */
export function VaTasksDesignShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("va-tasks-surface min-h-full text-[#B8B4B8]", className)}>
      {children}
    </div>
  );
}
