"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type BeautifulDetailModalStat = {
  label: string;
  value: React.ReactNode;
  accent?: "pink" | "purple" | "blue" | "emerald" | "amber" | "slate";
  /** Optional leading icon (e.g. Lucide) inside a tinted tile. */
  icon?: React.ReactNode;
};

export type BeautifulDetailTimelineItem = {
  id: string;
  label: string;
  value?: string;
  status?: "done" | "active" | "pending";
};

const ACCENT_CLASS: Record<NonNullable<BeautifulDetailModalStat["accent"]>, string> = {
  pink: "border-pink-400/35 bg-pink-500/12 text-pink-100",
  purple: "border-purple-400/35 bg-purple-500/12 text-purple-100",
  blue: "border-blue-400/35 bg-blue-500/12 text-blue-100",
  emerald: "border-emerald-400/35 bg-emerald-500/12 text-emerald-100",
  amber: "border-amber-400/35 bg-amber-500/12 text-amber-100",
  slate: "border-white/15 bg-white/[0.06] text-white/85",
};

function statusDotClass(status: BeautifulDetailTimelineItem["status"]): string {
  if (status === "done") return "bg-emerald-400";
  if (status === "active") return "bg-pink-400";
  return "bg-white/35";
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  badge?: string;
  stats?: BeautifulDetailModalStat[];
  timeline?: BeautifulDetailTimelineItem[];
  description?: React.ReactNode;
  shootWindow?: React.ReactNode;
  uploadInfo?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** When set, replaces the soft header wash with `bg-gradient-to-r` + these classes (Tailwind color stops). */
  headerGradientClass?: string;
};

export function BeautifulDetailModal({
  open,
  onOpenChange,
  title,
  subtitle,
  badge,
  stats = [],
  timeline = [],
  description,
  shootWindow,
  uploadInfo,
  children,
  footer,
  className,
  headerGradientClass,
}: Props) {
  const richHeader = Boolean(headerGradientClass?.trim());
  return (
    <AnimatePresence>
      {open ? (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.97 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "fixed left-1/2 top-1/2 z-[201] w-[min(calc(100vw-2rem),740px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/12 bg-zinc-950 shadow-2xl",
                  className
                )}
              >
                <div
                  className={cn(
                    "px-6 pb-5 pt-6",
                    richHeader
                      ? cn("bg-gradient-to-r text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]", headerGradientClass)
                      : "bg-gradient-to-r from-pink-600/30 via-fuchsia-600/20 to-purple-700/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {badge ? (
                        <p
                          className={cn(
                            "mb-2 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                            richHeader
                              ? "border-white/25 bg-white/15 text-white backdrop-blur-sm"
                              : "border-pink-300/35 bg-pink-500/15 text-pink-100"
                          )}
                        >
                          {badge}
                        </p>
                      ) : null}
                      <Dialog.Title
                        className={cn("text-white", richHeader ? "text-2xl font-bold tracking-tight md:text-3xl" : "text-xl font-semibold")}
                      >
                        {title}
                      </Dialog.Title>
                      {subtitle ? (
                        <Dialog.Description
                          className={cn("mt-1 text-sm", richHeader ? "text-white/85" : "text-white/70")}
                        >
                          {subtitle}
                        </Dialog.Description>
                      ) : null}
                    </div>
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-white/90 transition-colors hover:text-white",
                          richHeader
                            ? "border-white/20 bg-black/30 hover:bg-black/45"
                            : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                        )}
                        aria-label="Close"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </Dialog.Close>
                  </div>
                </div>

                <div className="max-h-[72vh] space-y-5 overflow-y-auto px-6 py-5">
                  {stats.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {stats.map((s) => (
                        <div
                          key={`${s.label}-${String(s.value)}`}
                          className={cn(
                            "rounded-xl border px-3.5 py-3",
                            ACCENT_CLASS[s.accent ?? "slate"]
                          )}
                        >
                          {s.icon ? (
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/25 text-white">
                                {s.icon}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] uppercase tracking-wide text-white/55">{s.label}</p>
                                <div className="mt-1 text-sm font-semibold leading-snug">{s.value}</div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-[11px] uppercase tracking-wide text-white/55">{s.label}</p>
                              <p className="mt-1 text-sm font-medium">{s.value}</p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {timeline.length > 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Status timeline</p>
                      <ol className="mt-4">
                        {timeline.map((item, index) => {
                          const isLast = index === timeline.length - 1;
                          return (
                            <li key={item.id} className="flex gap-3">
                              <div className="flex flex-col items-center pt-1">
                                <span
                                  className={cn(
                                    "h-3 w-3 shrink-0 rounded-full ring-2 ring-black/40",
                                    statusDotClass(item.status)
                                  )}
                                />
                                {!isLast ? (
                                  <span
                                    className="mt-1 min-h-[1.25rem] w-px flex-1 bg-gradient-to-b from-white/30 to-white/[0.06]"
                                    aria-hidden
                                  />
                                ) : null}
                              </div>
                              <div className={cn("min-w-0 flex-1", !isLast && "pb-4")}>
                                <p className="text-sm font-medium text-white/90">{item.label}</p>
                                {item.value ? (
                                  <p className="mt-0.5 text-xs leading-relaxed text-white/50">{item.value}</p>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ) : null}

                  {description ? (
                    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Description</p>
                      <div className="mt-2 text-sm text-white/80">{description}</div>
                    </section>
                  ) : null}

                  {shootWindow ? (
                    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Shoot window</p>
                      <div className="mt-2 text-sm text-white/80">{shootWindow}</div>
                    </section>
                  ) : null}

                  {uploadInfo ? (
                    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Upload info</p>
                      <div className="mt-2 text-sm text-white/80">{uploadInfo}</div>
                    </section>
                  ) : null}

                  {children}
                </div>

                {footer ? <div className="border-t border-white/10 px-6 py-4">{footer}</div> : null}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null}
    </AnimatePresence>
  );
}
