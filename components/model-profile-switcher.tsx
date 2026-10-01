"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, UserRound } from "lucide-react";
import { switchActiveModelProfile } from "@/app/actions/model-profile-switch";
import { cn } from "@/lib/utils";

export type ModelProfileOption = {
  id: string;
  name: string;
};

type Props = {
  profiles: ModelProfileOption[];
  activeProfileId: string | null;
  compact?: boolean;
  className?: string;
};

/** Shown when a model login has 2+ linked profiles. */
export function ModelProfileSwitcher({
  profiles,
  activeProfileId,
  compact = false,
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const active =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null;

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (profiles.length < 2 || !active) return null;

  async function onSelect(id: string) {
    if (id === active?.id || pending) return;
    setPending(true);
    setOpen(false);
    try {
      const res = await switchActiveModelProfile(id);
      if (res.success) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] text-left transition hover:bg-white/[0.07] disabled:opacity-60",
          compact ? "px-2 py-1.5" : "px-3 py-2"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch model profile"
      >
        <UserRound className="h-3.5 w-3.5 shrink-0 text-pink-300/80" aria-hidden />
        <span className={cn("min-w-0 truncate font-medium text-white/90", compact ? "text-xs" : "text-sm")}>
          {active.name}
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 text-white/45 transition", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 min-w-[11rem] overflow-hidden rounded-lg border border-white/15 bg-[#141218] py-1 shadow-xl"
        >
          {profiles.map((p) => {
            const isActive = p.id === active.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => void onSelect(p.id)}
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-left text-sm transition",
                    isActive
                      ? "bg-pink-500/15 text-pink-200"
                      : "text-white/80 hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  {p.name}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
