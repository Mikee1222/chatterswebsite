"use client";

import * as React from "react";
import { Input, Select, btnSecondaryClass } from "@/components/ui/form";
import { formatDateTimeEuropean } from "@/lib/format";
import type { ActivityLog, UserRole } from "@/types";

type Entry = ActivityLog & { actor_role: UserRole | "unknown" };

const PAGE_SIZE = 50;

const ROLE_OPTIONS: Array<{ value: "all" | UserRole; label: string }> = [
  { value: "all", label: "All roles" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "chatter", label: "Chatter" },
  { value: "virtual_assistant", label: "VA" },
  { value: "model", label: "Model" },
];

const ACTION_OPTIONS = [
  { value: "all", label: "All actions" },
  { value: "shift", label: "Shift" },
  { value: "whale", label: "Whale" },
  { value: "custom", label: "Custom" },
  { value: "content", label: "Content" },
  { value: "period", label: "Period" },
  { value: "rewards", label: "Rewards" },
  { value: "account", label: "Account" },
] as const;
type ActionCategory = (typeof ACTION_OPTIONS)[number]["value"];

function asTimeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Unknown time";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function getActionCategory(log: ActivityLog): Exclude<ActionCategory, "all"> {
  const blob = `${log.action_type} ${log.summary} ${log.details} ${log.entity_type}`.toLowerCase();
  if (blob.includes("whale") || blob.includes("transaction")) return "whale";
  if (blob.includes("custom")) return "custom";
  if (blob.includes("content") || blob.includes("assignment")) return "content";
  if (blob.includes("period")) return "period";
  if (blob.includes("reward") || blob.includes("spin") || blob.includes("challenge") || blob.includes("point")) {
    return "rewards";
  }
  if (blob.includes("account") || blob.includes("user") || blob.includes("role") || blob.includes("login")) {
    return "account";
  }
  return "shift";
}

function categoryDotClass(category: Exclude<ActionCategory, "all">): string {
  if (category === "shift") return "bg-sky-400";
  if (category === "whale") return "bg-amber-400";
  if (category === "custom") return "bg-violet-400";
  if (category === "content") return "bg-pink-400";
  if (category === "period") return "bg-emerald-400";
  if (category === "rewards") return "bg-fuchsia-400";
  return "bg-white/50";
}

function roleLabel(role: Entry["actor_role"]): string {
  if (role === "virtual_assistant") return "VA";
  if (role === "unknown") return "Unknown";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function exportCsv(rows: Entry[]) {
  const csvEscape = (v: string) => `"${v.replace(/"/g, "\"\"")}"`; const lines = [ ["timestamp", "user", "role", "action", "details"].join(","), ...rows.map((r) => [ csvEscape(r.created_at ?? ""), csvEscape(r.actor_name ?? ""), csvEscape(r.actor_role ?? "unknown"), csvEscape(r.action_type ?? ""), csvEscape([r.summary, r.details].filter(Boolean).join(" · ")), ].join(","), ), ]; const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
} export function ActivityLogsAdminClient({ entries }: { entries: Entry[] }) { const [query, setQuery] = React.useState(""); const [role, setRole] = React.useState<"all"| UserRole>("all"); const [action, setAction] = React.useState<ActionCategory>("all"); const [fromDate, setFromDate] = React.useState(""); const [toDate, setToDate] = React.useState(""); const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE); const filtered = React.useMemo(() => { const q = query.trim().toLowerCase(); return entries.filter((e) => { if (role !== "all"&& e.actor_role !== role) return false; const category = getActionCategory(e); if (action !== "all"&& category !== action) return false; if (fromDate) { const d = (e.created_at || "").slice(0, 10); if (!d || d < fromDate) return false; } if (toDate) { const d = (e.created_at || "").slice(0, 10); if (!d || d > toDate) return false; } if (!q) return true; return `${e.actor_name} ${e.action_type} ${e.summary} ${e.details}`.toLowerCase().includes(q); }); }, [entries, query, role, action, fromDate, toDate]); React.useEffect(() => { setVisibleCount(PAGE_SIZE); }, [query, role, action, fromDate, toDate]); const visible = filtered.slice(0, visibleCount); return ( <div className="space-y-5"> <div className="rounded-2xl border border-white/10 bg-white/5 p-5"> <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Administration</p> <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Activity logs</h1> <p className="mt-1 text-sm text-white/60">Full audit trail of all actions in the system.</p> </div> <div className="rounded-2xl border border-white/10 bg-white/5 p-4"> <div className="grid gap-3 md:grid-cols-3"> <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search action/user..."className="min-h-[44px]"/> <Select value={role} onChange={(e) => setRole(e.target.value as "all"| UserRole)} className="min-h-[44px]"> {ROLE_OPTIONS.map((opt) => ( <option key={opt.value} value={opt.value}> {opt.label} </option> ))} </Select> <Select value={action} onChange={(e) => setAction(e.target.value as ActionCategory)} className="min-h-[44px]"> {ACTION_OPTIONS.map((opt) => ( <option key={opt.value} value={opt.value}> {opt.label} </option> ))} </Select> <Input type="date"value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="min-h-[44px]"/> <Input type="date"value={toDate} onChange={(e) => setToDate(e.target.value)} className="min-h-[44px]"/> <button type="button"onClick={() => { setQuery(""); setRole("all"); setAction("all"); setFromDate(""); setToDate(""); }} className={btnSecondaryClass} > Clear filters </button> </div> <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3"> <button type="button"onClick={() => exportCsv(filtered)} className="rounded-xl border border-pink-500/40 bg-pink-500/15 px-3 py-2 text-sm font-medium text-pink-200 hover:bg-pink-500/25"> Export CSV </button> <p className="text-xs text-white/55"> Showing {visible.length} of {filtered.length} entries ({entries.length} total fetched) </p> </div> </div> <div className="space-y-3"> {visible.length === 0 ? ( <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/55"> No activity log entries match the selected filters. </div> ) : ( visible.map((log) => { const category = getActionCategory(log); return ( <article key={log.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/[0.08]"> <div className="flex flex-wrap items-center gap-2 text-xs text-white/40"> <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${categoryDotClass(category)}`} aria-hidden /> <span> {asTimeAgo(log.created_at)}</span> <span className="text-white/25">•</span> <span>{formatDateTimeEuropean(log.created_at)}</span> </div> <p className="mt-2 text-sm text-white"> <span className="font-semibold text-white/95">{log.actor_name || "Unknown user"}</span>{" "} <span className="text-white/65">({roleLabel(log.actor_role)})</span>{" "} <span className="text-white/70">— {log.summary || log.action_type || "updated record"}</span> </p> <p className="mt-1 text-sm text-white/50">{log.details || log.action_type || "No extra metadata."}</p> <p className="mt-2 text-xs uppercase tracking-wide text-white/30">{log.action_type || "unknown_action"}</p> </article> ); }) )} </div> {visibleCount < filtered.length ? ( <div className="flex justify-center pt-1"> <button type="button"onClick={() => setVisibleCount((n) => n + PAGE_SIZE)} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Load more
          </button>
        </div>
      ) : null}
    </div>
  );
}

