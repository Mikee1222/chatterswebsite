"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SopFormSection({
  title,
  description,
  children,
  defaultOpen = true,
  collapsibleOnMobile = true,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  collapsibleOnMobile?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const sectionId = React.useId();

  const header = (
    <>
      <h3 className="text-sm font-semibold text-white/90">{title}</h3>
      {description ? <p className="mt-0.5 text-xs text-white/45">{description}</p> : null}
    </>
  );

  return (
    <section
      className={cn("rounded-2xl border border-white/10 bg-white/[0.02]", className)}
    >
      {collapsibleOnMobile ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={sectionId}
          className="flex w-full min-h-[44px] items-center justify-between gap-3 px-4 py-3.5 text-left md:hidden"
        >
          <div className="min-w-0">{header}</div>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-white/40 transition-transform duration-200",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </button>
      ) : null}

      <div
        className={cn(
          "hidden px-5 pt-4 md:block",
          !collapsibleOnMobile && "block px-4 pt-4 md:px-5"
        )}
      >
        {header}
      </div>

      <div
        id={sectionId}
        className={cn(
          "space-y-4 overflow-hidden px-4 pb-4 transition-[max-height,opacity] duration-300 ease-out md:max-h-none md:opacity-100 md:px-5 md:pb-5 md:pt-3",
          collapsibleOnMobile
            ? open
              ? "max-h-[8000px] opacity-100 pt-2 md:block"
              : "max-h-0 opacity-0 md:max-h-none md:opacity-100 md:pt-3"
            : "pt-2 md:pt-3"
        )}
      >
        {children}
      </div>
    </section>
  );
}
