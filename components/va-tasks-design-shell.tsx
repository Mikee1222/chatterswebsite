import { displaySerifClassName } from "@/lib/fonts/display-serif";
import { cn } from "@/lib/utils";

/** Wraps VA Tasks pages with display serif variables + warm base surface. */
export function VaTasksDesignShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        displaySerifClassName,
        "va-tasks-surface min-h-full text-[#B8B4B8]",
        className,
      )}
    >
      {children}
    </div>
  );
}
