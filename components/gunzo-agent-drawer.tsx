"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  History,
  Loader2,
  MessageSquare,
  Send,
  ShieldAlert,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt?: number;
};

type PendingAction = {
  log_id: string;
  tool_name: string;
  parameters: Record<string, unknown>;
  description: string;
  proposed_at: string;
};

type HistoryLog = {
  id: string;
  tool_name: string;
  parameters: Record<string, unknown>;
  status: string;
  proposed_at: string;
  confirmed_at: string | null;
  error_message: string | null;
  result: unknown;
};

export type GunzoAgentDrawerProps = {
  canUse: boolean;
};

type SectionKind = "analytics" | "actions" | "restrictions" | "generic";

type ParsedSection = {
  kind: SectionKind;
  title: string;
  body: string;
};

const LOGO_SRC = "/apple-touch-icon-v2.png";
const LOGO_SRC_COMPACT = "/icon-192-v2.png";

const WELCOME_CONTENT = `Hey — I'm **Gunzo**, your strategic partner across the agency.

**I can pull**
- Revenue & chatter/VA performance
- Instagram + Marketing Control Room (accounts, phones, shadowban)
- Bunch pipeline (filming → editing → iCloud)
- Applications (funnel + candidate scores/flags)
- Weekly program, task timers, SOP completion
- Password Library *metadata* (what exists — never secrets)
- Client Gunzo Partnership stats

**I can propose** curated writes — you always **Confirm** before anything changes.

Ask anything. Strategy questions welcome.`;

const SUGGESTIONS = [
  "What's off across IG and revenue this month?",
  "How's the bunch pipeline looking?",
  "Any spot checks or shadowbans pending?",
];

const SECTION_META: Record<
  Exclude<SectionKind, "generic">,
  { icon: React.ElementType; accent: string; border: string; bg: string; label: string }
> = {
  analytics: {
    icon: BarChart3,
    accent: "text-[#e8d5a3]",
    border: "border-[#c9a227]/30",
    bg: "bg-[#c9a227]/[0.07]",
    label: "Analytics",
  },
  actions: {
    icon: Zap,
    accent: "text-amber-200",
    border: "border-amber-400/35",
    bg: "bg-amber-500/[0.08]",
    label: "Actions",
  },
  restrictions: {
    icon: ShieldAlert,
    accent: "text-rose-200",
    border: "border-rose-400/30",
    bg: "bg-rose-500/[0.07]",
    label: "Restrictions",
  },
};

function uid(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatParams(params: Record<string, unknown>): string {
  try {
    return JSON.stringify(params, null, 2);
  } catch {
    return String(params);
  }
}

function formatTime(ts?: number): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function classifySectionTitle(raw: string): { kind: SectionKind; title: string } {
  const cleaned = raw
    .replace(/^#+\s*/, "")
    .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\s]+/u, "")
    .trim();
  const lower = cleaned.toLowerCase();
  if (/^analytics\b/.test(lower) || /^insights?\b/.test(lower) || /^numbers?\b/.test(lower)) {
    return { kind: "analytics", title: cleaned || "Analytics" };
  }
  if (/^actions?\b/.test(lower) || /^proposed\b/.test(lower) || /^next steps?\b/.test(lower)) {
    return { kind: "actions", title: cleaned || "Actions" };
  }
  if (
    /^restrictions?\b/.test(lower) ||
    /^refusals?\b/.test(lower) ||
    /^limitations?\b/.test(lower) ||
    /^cannot\b/.test(lower)
  ) {
    return { kind: "restrictions", title: cleaned || "Restrictions" };
  }
  return { kind: "generic", title: cleaned };
}

/** Split assistant markdown into Analytics / Actions / Restrictions cards when present. */
function parseAgentSections(content: string): ParsedSection[] {
  const text = (content ?? "").trim();
  if (!text) return [];

  const headingRe = /^#{1,3}\s+(.+)$/gm;
  const matches = [...text.matchAll(headingRe)];
  if (matches.length === 0) {
    return [{ kind: "generic", title: "", body: text }];
  }

  const sections: ParsedSection[] = [];
  const firstIdx = matches[0]!.index ?? 0;
  if (firstIdx > 0) {
    const preface = text.slice(0, firstIdx).trim();
    if (preface) sections.push({ kind: "generic", title: "", body: preface });
  }

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const start = m.index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? text.length) : text.length;
    const block = text.slice(start, end).trim();
    const firstLineEnd = block.indexOf("\n");
    const headingLine = firstLineEnd === -1 ? block : block.slice(0, firstLineEnd);
    const body = firstLineEnd === -1 ? "" : block.slice(firstLineEnd + 1).trim();
    const { kind, title } = classifySectionTitle(headingLine);
    sections.push({ kind, title, body: body || "" });
  }

  const hasNamed = sections.some((s) => s.kind !== "generic");
  if (!hasNamed) {
    return [{ kind: "generic", title: "", body: text }];
  }
  return sections;
}

function GunzoLogo({
  size = 36,
  className,
  compact = false,
}: {
  size?: number;
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl",
        "bg-gradient-to-br from-[#e8d5a3] via-[#c9a227] to-[#8a6d1f] p-[1.5px]",
        "shadow-[0_0_20px_-6px_rgba(201,162,39,0.55)]",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-[10px] bg-[#0c0b09]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={compact ? LOGO_SRC_COMPACT : LOGO_SRC}
          alt="Gunzo"
          width={size}
          height={size}
          className="h-full w-full object-cover"
          draggable={false}
        />
      </span>
    </span>
  );
}

const chatMarkdownClass = cn(
  "text-[13px] leading-relaxed text-white/80",
  "[&_h1]:text-[15px] [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-[#f3e6c4]",
  "[&_h2]:text-[14px] [&_h2]:font-semibold [&_h2]:text-[#f3e6c4]",
  "[&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-[#e8d5a3]",
  "[&_p]:text-white/78 [&_p]:leading-relaxed",
  "[&_strong]:font-semibold [&_strong]:text-[#f8efd4]",
  "[&_ul]:my-1.5 [&_ol]:my-1.5",
  "[&_li]:text-white/75 [&_li]:leading-relaxed",
  "[&_hr]:my-3 [&_hr]:border-[#c9a227]/20",
  "[&_a]:text-[#e8d5a3] hover:[&_a]:text-[#f3e6c4]",
  "[&_code]:border-[#c9a227]/20 [&_code]:bg-black/35 [&_code]:text-[#e8d5a3]",
  /* Keep emoji readable without crowding line height */
  "[&_p]:[font-variant-emoji:emoji] [&_li]:[font-variant-emoji:emoji]",
);

function AssistantMessageBody({ content }: { content: string }) {
  const sections = React.useMemo(() => parseAgentSections(content), [content]);

  return (
    <div className="space-y-2.5">
      {sections.map((section, idx) => {
        if (section.kind === "generic") {
          if (!section.body && !section.title) return null;
          return (
            <div key={`g-${idx}`} className="min-w-0">
              {section.title ? (
                <p className="mb-1 text-[12px] font-semibold tracking-wide text-[#e8d5a3]">
                  {section.title}
                </p>
              ) : null}
              {section.body ? (
                <Markdown className={chatMarkdownClass}>{section.body}</Markdown>
              ) : null}
            </div>
          );
        }

        const meta = SECTION_META[section.kind];
        const Icon = meta.icon;
        return (
          <div
            key={`s-${idx}`}
            className={cn(
              "overflow-hidden rounded-xl border px-3 py-2.5",
              meta.border,
              meta.bg,
            )}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-lg bg-black/25",
                  meta.accent,
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
              </span>
              <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", meta.accent)}>
                {section.title || meta.label}
              </p>
            </div>
            {section.body ? (
              <Markdown className={chatMarkdownClass}>{section.body}</Markdown>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="mr-auto flex max-w-[92%] items-start gap-2.5">
      <GunzoLogo size={28} compact className="mt-0.5 rounded-lg" />
      <div className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.04] px-3.5 py-3">
        <div className="flex items-center gap-2 text-[12px] text-[#c9a227]/90">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          <span>Thinking</span>
          <span className="inline-flex gap-0.5" aria-hidden>
            <span className="h-1 w-1 animate-pulse rounded-full bg-[#c9a227]/80 [animation-delay:0ms]" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-[#c9a227]/80 [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-[#c9a227]/80 [animation-delay:300ms]" />
          </span>
        </div>
      </div>
    </div>
  );
}

export function GunzoAgentDrawer({ canUse }: GunzoAgentDrawerProps) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"chat" | "history">("chat");
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [confirmBusyId, setConfirmBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: WELCOME_CONTENT,
      createdAt: Date.now(),
    },
  ]);
  const [pending, setPending] = React.useState<PendingAction[]>([]);
  const [history, setHistory] = React.useState<HistoryLog[]>([]);
  const [historyLoaded, setHistoryLoaded] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [messages, pending, open, tab, busy, reduceMotion]);

  React.useEffect(() => {
    if (!open || tab !== "chat") return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => window.clearTimeout(t);
  }, [open, tab]);

  const loadHistory = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/gunzo-agent/history?limit=40");
      const data = (await res.json().catch(() => ({}))) as { logs?: HistoryLog[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load history");
      setHistory(data.logs ?? []);
      setHistoryLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "History failed");
    }
  }, []);

  React.useEffect(() => {
    if (open && tab === "history" && !historyLoaded) {
      void loadHistory();
    }
  }, [open, tab, historyLoaded, loadHistory]);

  if (!canUse) return null;

  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || busy) return;
    setError(null);
    setInput("");

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };
    const prior =
      messages.length === 1 && messages[0]?.id === "welcome" ? [] : messages;
    const payloadMessages = [...prior, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages([...prior, userMsg]);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/gunzo-agent/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        assistantText?: string;
        pendingActions?: PendingAction[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Chat failed");
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: data.assistantText || "…",
          createdAt: Date.now(),
        },
      ]);
      if (data.pendingActions?.length) {
        setPending((prev) => [...prev, ...data.pendingActions!]);
      }
      setHistoryLoaded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  }

  async function resolvePending(logId: string, confirm: boolean) {
    setConfirmBusyId(logId);
    setError(null);
    try {
      const res = await fetch("/api/admin/gunzo-agent/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ log_id: logId, confirm }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        result?: { summary?: string };
        cancelled?: boolean;
      };
      if (!res.ok) throw new Error(data.error || "Confirm failed");
      setPending((prev) => prev.filter((p) => p.log_id !== logId));
      const note = confirm
        ? data.result?.summary || "Action executed."
        : "Action cancelled.";
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: note, createdAt: Date.now() },
      ]);
      setHistoryLoaded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setConfirmBusyId(null);
    }
  }

  const fabStyle = {
    bottom:
      "calc(var(--mobile-bottom-nav-height, 76px) + env(safe-area-inset-bottom, 0px) + 12px)",
    right:
      "max(calc(1rem + 3.75rem + 0.65rem), calc(env(safe-area-inset-right, 0px) + 3.75rem + 0.65rem))",
  } as const;

  const desktopFabStyle = {
    bottom: "1.5rem",
    right: "calc(1.5rem + 3.75rem + 0.65rem)",
  } as const;

  const panelTransition = reduceMotion
    ? { duration: 0.01 }
    : { type: "spring" as const, damping: 28, stiffness: 320 };

  const panelInitial = isMobile
    ? { y: "100%", opacity: reduceMotion ? 1 : 0.96 }
    : { x: "100%" };
  const panelAnimate = isMobile ? { y: 0, opacity: 1 } : { x: 0 };
  const panelExit = isMobile
    ? { y: "100%", opacity: reduceMotion ? 1 : 0.96 }
    : { x: "100%" };

  const fabMotion = reduceMotion
    ? {}
    : {
        whileHover: { scale: 1.06, rotate: -4 },
        whileTap: { scale: 0.94 },
        transition: { type: "spring" as const, stiffness: 420, damping: 22 },
      };

  const showWelcomeHints =
    messages.length === 1 && messages[0]?.id === "welcome" && !busy && pending.length === 0;

  function FabButton({
    style,
    className,
  }: {
    style: React.CSSProperties;
    className: string;
  }) {
    return (
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed z-[106] flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl",
          "bg-gradient-to-br from-[#e8d5a3] via-[#c9a227] to-[#8a6d1f]",
          "border border-[#f0e2b8]/40",
          "shadow-[0_10px_28px_-6px_rgba(201,162,39,0.55),0_0_0_1px_rgba(255,255,255,0.08)_inset]",
          "touch-manipulation",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e8d5a3]/70",
          className,
        )}
        style={style}
        aria-label="Open Gunzo Agent"
        {...fabMotion}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_SRC_COMPACT}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 rounded-xl object-cover shadow-inner"
          draggable={false}
        />
        {!reduceMotion ? (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/25 via-transparent to-transparent"
            animate={{ opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />
        ) : null}
      </motion.button>
    );
  }

  return (
    <>
      {!open ? (
        <>
          <FabButton style={fabStyle} className="md:hidden" />
          <FabButton
            style={desktopFabStyle}
            className="pointer-events-auto z-[50] hidden md:flex"
          />
        </>
      ) : null}

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Close Gunzo Agent backdrop"
              className="fixed inset-0 z-[120] cursor-default bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0.01 } : { duration: 0.2 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Gunzo Agent"
              className={cn(
                "fixed z-[121] flex flex-col overflow-hidden",
                /* Mobile: full-screen sheet */
                "inset-0 w-full",
                /* Desktop: glass side panel */
                "md:inset-y-0 md:right-0 md:left-auto md:w-full md:max-w-[440px]",
                "border-white/[0.08] bg-[#0c0b09]/92 backdrop-blur-2xl",
                "md:border-l",
                "shadow-[-24px_0_64px_rgba(0,0,0,0.55)]",
                "pt-[env(safe-area-inset-top,0px)]",
              )}
              initial={panelInitial}
              animate={panelAnimate}
              exit={panelExit}
              transition={panelTransition}
            >
              <header className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
                <GunzoLogo size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold tracking-wide text-[#f3e6c4]">
                    Gunzo Agent
                  </p>
                  <p className="truncate text-[11px] text-white/45">
                    Strategic partner · Confirm before any write
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-white/55 transition hover:bg-white/5 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="flex gap-1 border-b border-white/[0.06] px-3 py-2">
                <button
                  type="button"
                  onClick={() => setTab("chat")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition",
                    tab === "chat"
                      ? "bg-[#c9a227]/20 text-[#e8d5a3]"
                      : "text-white/45 hover:bg-white/[0.04] hover:text-white/70",
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab("history");
                    setHistoryLoaded(false);
                  }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition",
                    tab === "history"
                      ? "bg-[#c9a227]/20 text-[#e8d5a3]"
                      : "text-white/45 hover:bg-white/[0.04] hover:text-white/70",
                  )}
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </button>
              </div>

              {tab === "chat" ? (
                <>
                  <div
                    ref={listRef}
                    className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
                  >
                    {messages.map((m) => {
                      const isUser = m.role === "user";
                      const time = formatTime(m.createdAt);
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "flex gap-2.5",
                            isUser ? "flex-row-reverse" : "flex-row",
                          )}
                        >
                          {isUser ? (
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-white/70">
                              <User className="h-3.5 w-3.5" aria-hidden />
                            </span>
                          ) : (
                            <GunzoLogo size={28} compact className="mt-0.5 rounded-lg" />
                          )}
                          <div
                            className={cn(
                              "min-w-0 max-w-[min(92%,22rem)]",
                              isUser ? "items-end" : "items-start",
                            )}
                          >
                            <div
                              className={cn(
                                "rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                                isUser
                                  ? "rounded-tr-md bg-gradient-to-br from-[#c9a227]/35 to-[#8a6d1f]/25 text-[#f8efd4]"
                                  : "rounded-tl-md border border-white/[0.07] bg-white/[0.045] text-white/85",
                              )}
                            >
                              {isUser ? (
                                <p className="whitespace-pre-wrap">{m.content}</p>
                              ) : (
                                <AssistantMessageBody content={m.content} />
                              )}
                            </div>
                            {time ? (
                              <p
                                className={cn(
                                  "mt-1 px-1 text-[10px] tabular-nums text-white/30",
                                  isUser ? "text-right" : "text-left",
                                )}
                              >
                                {time}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}

                    {showWelcomeHints ? (
                      <div className="space-y-2 pl-9">
                        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/35">
                          Try asking
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {SUGGESTIONS.map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={busy}
                              onClick={() => void sendMessage(s)}
                              className="rounded-xl border border-[#c9a227]/25 bg-[#c9a227]/[0.08] px-3 py-2 text-left text-[12px] text-[#e8d5a3]/95 transition hover:border-[#c9a227]/45 hover:bg-[#c9a227]/15 disabled:opacity-40"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {pending.map((p) => (
                      <div
                        key={p.log_id}
                        className={cn(
                          "ml-9 overflow-hidden rounded-2xl border border-amber-400/40",
                          "bg-gradient-to-br from-amber-500/[0.12] via-[#1a160c] to-[#12100a]",
                          "p-3.5 shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_12px_32px_-12px_rgba(251,191,36,0.25)]",
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-200">
                            <AlertTriangle className="h-4 w-4" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/90">
                              Confirm action
                            </p>
                            <p className="mt-1 text-[13px] font-medium text-white/95">
                              {p.tool_name}
                            </p>
                            <p className="mt-0.5 text-[12px] leading-relaxed text-white/50">
                              {p.description}
                            </p>
                          </div>
                        </div>
                        <pre className="mt-3 max-h-36 overflow-auto rounded-xl border border-white/[0.06] bg-black/45 p-2.5 font-mono text-[10px] leading-snug text-[#e8d5a3]/85">
                          {formatParams(p.parameters)}
                        </pre>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={confirmBusyId === p.log_id}
                            onClick={() => void resolvePending(p.log_id, true)}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#e8d5a3] to-[#c9a227] px-3 py-2.5 text-[12px] font-semibold text-[#1a1408] transition hover:brightness-105 disabled:opacity-50"
                          >
                            {confirmBusyId === p.log_id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            Confirm
                          </button>
                          <button
                            type="button"
                            disabled={confirmBusyId === p.log_id}
                            onClick={() => void resolvePending(p.log_id, false)}
                            className="flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-[12px] font-medium text-white/75 transition hover:bg-white/[0.07] disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}

                    {busy ? <ThinkingIndicator /> : null}
                    {error ? (
                      <p className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
                        {error}
                      </p>
                    ) : null}
                  </div>

                  <form
                    className="border-t border-white/[0.07] bg-black/20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void sendMessage();
                    }}
                  >
                    <div className="flex items-end gap-2">
                      <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask Gunzo anything…"
                        disabled={busy}
                        className={cn(
                          "min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.05]",
                          "px-3.5 py-3 text-[13px] text-white placeholder:text-white/30",
                          "transition focus:border-[#c9a227]/50 focus:bg-white/[0.07] focus:outline-none",
                          "disabled:opacity-60",
                        )}
                      />
                      <button
                        type="submit"
                        disabled={busy || !input.trim()}
                        className={cn(
                          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                          "bg-gradient-to-br from-[#e8d5a3] to-[#c9a227] text-[#1a1408]",
                          "shadow-[0_8px_20px_-8px_rgba(201,162,39,0.65)]",
                          "transition hover:brightness-105 disabled:opacity-40",
                        )}
                        aria-label="Send"
                      >
                        <Send className="h-4 w-4" strokeWidth={2.4} />
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
                  {!historyLoaded ? (
                    <p className="flex items-center gap-2 text-[12px] text-white/45">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading history…
                    </p>
                  ) : history.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                        <Sparkles className="h-5 w-5 text-[#c9a227]/80" />
                      </span>
                      <p className="text-[13px] text-white/55">No actions yet.</p>
                      <p className="max-w-xs text-[12px] text-white/35">
                        Confirmed and cancelled writes will appear here for audit.
                      </p>
                    </div>
                  ) : (
                    history.map((h) => (
                      <div
                        key={h.id}
                        className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[12px] font-medium text-[#e8d5a3]">
                            {h.tool_name}
                          </p>
                          <span className="shrink-0 rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/40">
                            {h.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-white/35">
                          {h.proposed_at ? new Date(h.proposed_at).toLocaleString() : ""}
                        </p>
                        {h.error_message ? (
                          <p className="mt-1 text-[11px] text-rose-300/80">{h.error_message}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                  {error && tab === "history" ? (
                    <p className="text-[12px] text-rose-300/90">{error}</p>
                  ) : null}
                </div>
              )}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
