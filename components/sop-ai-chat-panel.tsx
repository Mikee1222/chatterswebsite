"use client";

import * as React from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ChatMsg = { role: "user" | "assistant"; content: string };

export function SopAiChatPanel() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, loading]);

  async function send() {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    setError(null);
    const nextHistory = [...messages, { role: "user" as const, content: question }];
    setMessages(nextHistory);
    setLoading(true);
    try {
      const res = await fetch("/api/sops/ai-chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: messages }),
      });
      const data = (await res.json().catch(() => ({}))) as { answer?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Chat failed");
      setMessages([...nextHistory, { role: "assistant", content: data.answer ?? "" }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border border-pink-500/25 bg-pink-500/10 px-3 py-2 text-xs font-semibold text-pink-100 transition hover:bg-pink-500/15",
        )}
        aria-expanded={open}
      >
        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        Ask SOP AI
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
            <p className="text-xs font-semibold text-white/80">SOP Library assistant</p>
            <button
              type="button"
              className="rounded-lg p-1 text-white/45 hover:bg-white/10 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div ref={listRef} className="max-h-72 space-y-2 overflow-y-auto px-3 py-3">
            {messages.length === 0 ? (
              <p className="text-xs text-white/45">
                Ask about policies or steps covered in your published SOPs. Answers stay grounded in library content.
              </p>
            ) : null}
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-6 bg-pink-500/15 text-pink-50"
                    : "mr-4 bg-white/5 text-white/80",
                )}
              >
                {m.content}
              </div>
            ))}
            {loading ? (
              <p className="flex items-center gap-2 text-xs text-white/45">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </p>
            ) : null}
            {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          </div>
          <form
            className="flex gap-2 border-t border-white/10 p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a SOP question…"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-pink-500/40"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/80 text-white disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
