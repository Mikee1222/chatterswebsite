"use client";

import * as React from "react";
import { Check, Copy, MessageSquare, X } from "lucide-react";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_FILTER_INPUT,
} from "@/components/manager-review-ui";
import {
  buildFlagMessageParts,
  collectFlaggedItemsForVa,
  readStoredFlagMessageLanguage,
  writeStoredFlagMessageLanguage,
  type FlagMessageLanguage,
  type FlagMessagePart,
} from "@/lib/daily-review-flag-message";
import { cn } from "@/lib/utils";
import type {
  DailyReviewChecklistVa,
  DailyReviewChecklistVaShared,
  DailyReviewVaInformed,
} from "@/services/daily-review-checklist";

type VaLike = DailyReviewChecklistVa | DailyReviewChecklistVaShared;

type MessageDraftProps = {
  va: VaLike;
  reviewDate: string;
  senderFullName: string;
  informed: DailyReviewVaInformed | null;
  marking?: boolean;
  onMarkInformed?: () => void;
  className?: string;
};

function formatInformedTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function DailyReviewFlagMessageDraft({
  va,
  reviewDate,
  senderFullName,
  informed,
  marking,
  onMarkInformed,
  className,
}: MessageDraftProps) {
  const items = React.useMemo(() => collectFlaggedItemsForVa(va), [va]);
  const [language, setLanguage] = React.useState<FlagMessageLanguage>(() => {
    return readStoredFlagMessageLanguage(va.va_id) ?? "el";
  });
  const [drafts, setDrafts] = React.useState<string[]>([]);
  const [copiedPart, setCopiedPart] = React.useState<number | null>(null);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const regenerate = React.useCallback(
    (lang: FlagMessageLanguage) => {
      const parts = buildFlagMessageParts({
        language: lang,
        recipientFullName: va.va_name,
        senderFullName,
        reviewDate,
        items,
      });
      setDrafts(parts.map((p: FlagMessagePart) => p.text));
    },
    [items, reviewDate, senderFullName, va.va_name],
  );

  React.useEffect(() => {
    regenerate(language);
  }, [language, regenerate]);

  function switchLanguage(lang: FlagMessageLanguage) {
    setLanguage(lang);
    writeStoredFlagMessageLanguage(va.va_id, lang);
  }

  async function handleCopy(index: number, text: string) {
    const ok = await copyText(text);
    if (!ok) return;
    setCopiedPart(index);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedPart(null), 1600);
  }

  if (!items.length) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-xl border border-white/12 bg-white/[0.03] p-0.5"
          role="group"
          aria-label="Message language"
        >
          <button
            type="button"
            onClick={() => switchLanguage("el")}
            className={cn(
              "min-h-9 rounded-[0.65rem] px-3 text-xs font-semibold transition-colors",
              language === "el"
                ? "bg-[#FF1493]/20 text-white"
                : "text-[#B8B4B8]/60 hover:text-white/80",
            )}
          >
            Ελληνικά
          </button>
          <button
            type="button"
            onClick={() => switchLanguage("en")}
            className={cn(
              "min-h-9 rounded-[0.65rem] px-3 text-xs font-semibold transition-colors",
              language === "en"
                ? "bg-[#FF1493]/20 text-white"
                : "text-[#B8B4B8]/60 hover:text-white/80",
            )}
          >
            English
          </button>
        </div>
        {informed ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/35 bg-sky-500/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-sky-200">
            Informed · {formatInformedTime(informed.informed_at)}
            {informed.informed_by_name ? ` · ${informed.informed_by_name}` : ""}
          </span>
        ) : null}
      </div>
      <p className="text-[11px] text-[#B8B4B8]/45">
        Notes stay in the original language — only the greeting and closing switch.
      </p>

      <div className="space-y-3">
        {drafts.map((text, index) => (
          <div key={`part-${index}`} className="space-y-2">
            {drafts.length > 1 ? (
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#B8B4B8]/45">
                Part {index + 1}/{drafts.length}
              </p>
            ) : null}
            <textarea
              value={text}
              onChange={(e) => {
                const next = [...drafts];
                next[index] = e.target.value;
                setDrafts(next);
              }}
              rows={Math.min(18, Math.max(8, text.split("\n").length + 1))}
              className={cn(
                VA_FILTER_INPUT,
                "min-h-[10rem] w-full resize-y px-3 py-2.5 font-mono text-[13px] leading-relaxed text-white/90",
              )}
              spellCheck={false}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] tabular-nums text-[#B8B4B8]/40">
                {text.length} characters
              </span>
              <button
                type="button"
                onClick={() => void handleCopy(index, text)}
                className={cn(
                  VA_BTN_SECONDARY,
                  "inline-flex min-h-10 items-center gap-1.5 px-3 text-xs",
                  copiedPart === index && "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
                )}
              >
                {copiedPart === index ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {onMarkInformed ? (
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={marking || Boolean(informed)}
            onClick={onMarkInformed}
            className={cn(VA_BTN_PRIMARY, "min-h-10 px-4 text-xs")}
          >
            {informed ? "Marked informed" : marking ? "Saving…" : "Mark as informed"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

export function DailyReviewMessageSheet({ open, onClose, title, children }: SheetProps) {
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/65"
        aria-label="Close message panel"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          VA_CARD,
          "relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border-white/12 sm:rounded-2xl",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 text-white/70 hover:bg-white/5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

type AllMessagesProps = {
  open: boolean;
  onClose: () => void;
  vas: VaLike[];
  reviewDate: string;
  senderFullName: string;
  markingVaId?: string | null;
  onMarkInformed: (va: VaLike) => void;
};

export function DailyReviewMessagesForAllPanel({
  open,
  onClose,
  vas,
  reviewDate,
  senderFullName,
  markingVaId,
  onMarkInformed,
}: AllMessagesProps) {
  const flaggedVas = React.useMemo(
    () => vas.filter((v) => v.stats.flagged > 0),
    [vas],
  );

  return (
    <DailyReviewMessageSheet
      open={open}
      onClose={onClose}
      title={`Messages for all (${flaggedVas.length})`}
    >
      {flaggedVas.length === 0 ? (
        <p className="text-sm text-[#B8B4B8]/55">
          No flagged people in the current filtered set.
        </p>
      ) : (
        <div className="space-y-6">
          {flaggedVas.map((va) => (
            <section key={va.va_id} className="space-y-3 border-b border-white/[0.06] pb-6 last:border-0">
              <div>
                <h4 className="text-base font-semibold text-white">{va.va_name}</h4>
                <p className="text-xs text-[#B8B4B8]/45">
                  {va.stats.flagged} flagged item{va.stats.flagged === 1 ? "" : "s"}
                </p>
              </div>
              <DailyReviewFlagMessageDraft
                va={va}
                reviewDate={reviewDate}
                senderFullName={senderFullName}
                informed={va.informed ?? null}
                marking={markingVaId === va.va_id}
                onMarkInformed={() => onMarkInformed(va)}
              />
            </section>
          ))}
        </div>
      )}
    </DailyReviewMessageSheet>
  );
}

export function DailyReviewMessageButton({
  flaggedCount,
  onClick,
  className,
}: {
  flaggedCount: number;
  onClick: () => void;
  className?: string;
}) {
  if (flaggedCount < 1) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        VA_BTN_SECONDARY,
        "inline-flex min-h-9 items-center gap-1.5 px-2.5 py-1.5 text-xs",
        className,
      )}
    >
      <MessageSquare className="h-3.5 w-3.5" aria-hidden />
      Message
    </button>
  );
}
