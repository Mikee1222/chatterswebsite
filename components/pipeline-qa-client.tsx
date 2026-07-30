"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, RefreshCw } from "lucide-react";
import { qaSetIdeaChecked, qaApproveBunch, qaRequestChanges } from "@/app/actions/research-bunches";
import { qaApproveItemAction, qaRejectItemAction, setFilmTypeAction, retryBlockedItemAction } from "@/app/actions/content-pipeline";

export type QaBunch = {
  id: string;
  creator_name: string;
  researcher_name: string;
  ideas: { id: string; idea_text: string; platform: string; checked: boolean }[];
};
export type QaItem = {
  id: string;
  title: string;
  creator_name: string;
  stage: string;
  status: string;
  assignee_name: string;
  film_type: string;
};

const STAGES = ["creative", "filming", "icloud_raw", "editing", "icloud_edited", "post"];
const STAGE_LABEL: Record<string, string> = {
  creative: "Creative", filming: "Filming", icloud_raw: "iCloud/RAW", editing: "Editing", icloud_edited: "iCloud (edited)", post: "Post", done: "Done",
};
function progressPct(stage: string): number {
  if (stage === "done") return 100;
  const i = STAGES.indexOf(stage);
  return i < 0 ? 0 : Math.round(((i + 1) / STAGES.length) * 100);
}

type Res = { success: boolean; error?: string; message?: string };

export function PipelineQaClient({ bunches, items }: { bunches: QaBunch[]; items: QaItem[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  async function run(fn: () => Promise<Res>) {
    setPending(true);
    const r = await fn();
    setPending(false);
    if (!r.success) return toast.error(r.error ?? "Απέτυχε");
    if (r.message) toast.success(r.message);
    router.refresh();
  }

  const awaitingItems = items.filter((i) => i.status === "awaiting_qa");
  const inProgress = items.filter((i) => i.status !== "awaiting_qa");
  const waitingCount = bunches.length + awaitingItems.length;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-[26px] font-semibold tracking-tight text-white">Pipeline QA</h1>
        <p className="mt-1 text-sm text-white/55">
          {waitingCount > 0 ? `⏳ ${waitingCount} περιμένουν εσένα` : "✓ Τίποτα δεν περιμένει QA"}
        </p>
      </header>

      {/* WAITING FOR QA */}
      {(bunches.length > 0 || awaitingItems.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pink-300/80">Περιμένουν εσένα</h2>

          {bunches.map((b) => {
            const allChecked = b.ideas.length > 0 && b.ideas.every((i) => i.checked);
            return (
              <div key={b.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium text-white">🔬 Research · {b.creator_name}</p>
                  <span className="text-xs text-white/45">{b.researcher_name}</span>
                </div>
                <ul className="space-y-1.5">
                  {b.ideas.map((idea) => (
                    <li key={idea.id} className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-2 text-sm">
                      <input type="checkbox" checked={idea.checked} disabled={pending}
                        onChange={(e) => run(() => qaSetIdeaChecked(idea.id, e.target.checked))}
                        className="mt-0.5 h-4 w-4 accent-pink-500" />
                      <span className="text-white/85">{idea.idea_text} <span className="text-white/35">· {idea.platform}</span></span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-end gap-2">
                  <button disabled={pending} onClick={() => run(() => qaRequestChanges(b.id))}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50">
                    <RotateCcw className="h-3.5 w-3.5" /> Αλλαγές
                  </button>
                  <button disabled={pending || !allChecked} onClick={() => run(() => qaApproveBunch(b.id))}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Έγκριση → Creative
                  </button>
                </div>
              </div>
            );
          })}

          {awaitingItems.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{it.title}</p>
                <p className="text-xs text-white/45">{it.creator_name} · {STAGE_LABEL[it.stage] ?? it.stage}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button disabled={pending} onClick={() => run(() => qaRejectItemAction(it.id))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50">
                  <RotateCcw className="h-3.5 w-3.5" /> Πίσω
                </button>
                <button disabled={pending} onClick={() => run(() => qaApproveItemAction(it.id))}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Έγκριση
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* IN PROGRESS — every band's live position */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Σε εξέλιξη ({inProgress.length})</h2>
        {inProgress.length === 0 && <p className="text-sm text-white/40">Κανένα band σε εξέλιξη.</p>}
        {inProgress.map((it) => {
          const pct = progressPct(it.stage);
          return (
            <div key={it.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{it.title}</p>
                  <p className="text-xs text-white/45">
                    {it.creator_name} · {STAGE_LABEL[it.stage] ?? it.stage} · {it.assignee_name || "⚠️ unassigned"}
                    {it.status === "blocked_unassigned" && <span className="ml-1 text-amber-300">blocked</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {it.status === "blocked_unassigned" && (
                    <button disabled={pending} onClick={() => run(() => retryBlockedItemAction(it.id))}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-400/20 disabled:opacity-50">
                      <RefreshCw className="h-3.5 w-3.5" /> Retry
                    </button>
                  )}
                  {/* Manos picks self/filmer per band (early) */}
                  <div className="inline-flex overflow-hidden rounded-xl border border-white/10">
                    {(["self_record", "filmer"] as const).map((ft) => (
                      <button key={ft} disabled={pending} onClick={() => run(() => setFilmTypeAction(it.id, ft))}
                        className={`px-2.5 py-1 text-xs transition ${it.film_type === ft ? "bg-pink-500/20 text-pink-200" : "bg-white/5 text-white/45 hover:bg-white/10"}`}>
                        {ft === "self_record" ? "Self" : "Filmer"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
