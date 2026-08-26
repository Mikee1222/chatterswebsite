"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { History, MessageSquare, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
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

export function GunzoAgentDrawer({ canUse }: GunzoAgentDrawerProps) {
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
      content:
        "I'm Gunzo Agent. Ask about performance, revenue, Instagram, VA stats, spot checks, applications, or the weekly program. Writes always need your Confirm.",
    },
  ]);
  const [pending, setPending] = React.useState<PendingAction[]>([]);
  const [history, setHistory] = React.useState<HistoryLog[]>([]);
  const [historyLoaded, setHistoryLoaded] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, open, tab]);

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

  async function sendMessage() {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    setInput("");

    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
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
        { id: uid(), role: "assistant", content: data.assistantText || "…" },
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
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: note }]);
      setHistoryLoaded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setConfirmBusyId(null);
    }
  }

  const fabStyle = {
    bottom: "calc(var(--mobile-bottom-nav-height, 76px) + env(safe-area-inset-bottom, 0px) + 12px)",
    right: "max(calc(1rem + 3.75rem + 0.65rem), calc(env(safe-area-inset-right, 0px) + 3.75rem + 0.65rem))",
  } as const;

  const desktopFabStyle = {
    bottom: "1.5rem",
    right: "calc(1.5rem + 3.75rem + 0.65rem)",
  } as const;

  return (
    <>
      {/* Mobile FAB — left of admin quick-actions FAB */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed z-[106] flex h-14 w-14 items-center justify-center rounded-2xl md:hidden",
          "bg-gradient-to-br from-[#e8d5a3] via-[#c9a227] to-[#8a6d1f]",
          "border border-[#f0e2b8]/40 text-[#1a1408]",
          "shadow-[0_10px_28px_-6px_rgba(201,162,39,0.55),0_0_0_1px_rgba(255,255,255,0.08)_inset]",
          "hover:scale-[1.04] active:scale-[0.96] touch-manipulation",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e8d5a3]/70",
        )}
        style={fabStyle}
        aria-label="Open Gunzo Agent"
      >
        <Sparkles className="h-6 w-6" strokeWidth={2.2} />
      </button>

      {/* Desktop FAB */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "pointer-events-auto fixed z-[50] hidden h-14 w-14 items-center justify-center rounded-2xl md:flex",
          "bg-gradient-to-br from-[#e8d5a3] via-[#c9a227] to-[#8a6d1f]",
          "border border-[#f0e2b8]/40 text-[#1a1408]",
          "shadow-[0_10px_28px_-6px_rgba(201,162,39,0.55)]",
          "hover:scale-[1.04] active:scale-[0.96]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e8d5a3]/70",
        )}
        style={desktopFabStyle}
        aria-label="Open Gunzo Agent"
      >
        <Sparkles className="h-6 w-6" strokeWidth={2.2} />
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Close Gunzo Agent backdrop"
              className="fixed inset-0 z-[120] cursor-default bg-black/55 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Gunzo Agent"
              className={cn(
                "fixed inset-y-0 right-0 z-[121] flex w-full max-w-[420px] flex-col",
                "border-l border-[#c9a227]/25 bg-[#0c0b09]",
                "shadow-[-24px_0_64px_rgba(0,0,0,0.55)]",
              )}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
            >
              <header className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#e8d5a3] to-[#8a6d1f] text-[#1a1408]">
                  <Sparkles className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold tracking-wide text-[#f3e6c4]">
                    Gunzo Agent
                  </p>
                  <p className="truncate text-[11px] text-white/45">Confirm before any write</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-white/55 hover:bg-white/5 hover:text-white"
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
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium",
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
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium",
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
                  <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                          m.role === "user"
                            ? "ml-auto bg-[#c9a227]/25 text-[#f8efd4]"
                            : "mr-auto border border-white/[0.06] bg-white/[0.04] text-white/85",
                        )}
                      >
                        {m.content}
                      </div>
                    ))}

                    {pending.map((p) => (
                      <div
                        key={p.log_id}
                        className="rounded-2xl border border-[#c9a227]/35 bg-[#1a160c] p-3.5 shadow-[0_0_0_1px_rgba(201,162,39,0.08)]"
                      >
                        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#e8d5a3]">
                          Confirm action
                        </p>
                        <p className="mt-1 text-[13px] text-white/90">{p.tool_name}</p>
                        <p className="mt-0.5 text-[11px] text-white/45">{p.description}</p>
                        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/40 p-2 text-[10px] leading-snug text-[#e8d5a3]/85">
                          {formatParams(p.parameters)}
                        </pre>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={confirmBusyId === p.log_id}
                            onClick={() => void resolvePending(p.log_id, true)}
                            className="flex-1 rounded-xl bg-gradient-to-r from-[#e8d5a3] to-[#c9a227] px-3 py-2 text-[12px] font-semibold text-[#1a1408] disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            disabled={confirmBusyId === p.log_id}
                            onClick={() => void resolvePending(p.log_id, false)}
                            className="flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-white/75 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}

                    {busy ? (
                      <p className="text-[12px] text-[#c9a227]/80">Thinking…</p>
                    ) : null}
                    {error ? <p className="text-[12px] text-red-300/90">{error}</p> : null}
                  </div>

                  <form
                    className="border-t border-white/[0.07] p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void sendMessage();
                    }}
                  >
                    <div className="flex gap-2">
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask Gunzo Agent…"
                        disabled={busy}
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13px] text-white placeholder:text-white/30 focus:border-[#c9a227]/50 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={busy || !input.trim()}
                        className="rounded-xl bg-[#c9a227] px-3.5 py-2.5 text-[12px] font-semibold text-[#1a1408] disabled:opacity-40"
                      >
                        Send
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
                  {!historyLoaded ? (
                    <p className="text-[12px] text-white/45">Loading history…</p>
                  ) : history.length === 0 ? (
                    <p className="text-[12px] text-white/45">No actions yet.</p>
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
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/40">
                            {h.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-white/35">
                          {h.proposed_at ? new Date(h.proposed_at).toLocaleString() : ""}
                        </p>
                        {h.error_message ? (
                          <p className="mt-1 text-[11px] text-red-300/80">{h.error_message}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                  {error && tab === "history" ? (
                    <p className="text-[12px] text-red-300/90">{error}</p>
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
