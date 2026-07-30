"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Send, CheckCircle2, RotateCcw, AlertTriangle } from "lucide-react";
import {
  createResearchBunch,
  addResearchIdea,
  removeResearchIdea,
  submitResearchBunch,
  qaSetIdeaChecked,
  qaApproveBunch,
  qaRequestChanges,
} from "@/app/actions/research-bunches";

type Creator = { model_id: string; model_name: string };
type Idea = {
  id: string;
  platform: string;
  idea_text: string;
  reference_link: string;
  checked: boolean;
  spawned_item_id: string;
};
type Bunch = {
  id: string;
  creator_name: string;
  researcher_name: string;
  week: string;
  status: string;
};
type BunchWithIdeas = { bunch: Bunch; ideas: Idea[] };

type Props = {
  canQa: boolean;
  assignedCreators: Creator[];
  myBunches: BunchWithIdeas[];
  qaBunches: BunchWithIdeas[];
  week: string;
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-white/10 text-white/70",
  awaiting_qa: "bg-sky-400/15 text-sky-200",
  changes_requested: "bg-amber-400/15 text-amber-200",
  approved: "bg-emerald-400/15 text-emerald-200",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Πρόχειρο",
  awaiting_qa: "Σε QA",
  changes_requested: "Θέλει αλλαγές",
  approved: "Εγκρίθηκε",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status] ?? "bg-white/10 text-white/70"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const inputCls =
  "h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20";

export function ResearchStageClient({ canQa, assignedCreators, myBunches, qaBunches, week }: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [newCreator, setNewCreator] = React.useState(assignedCreators[0]?.model_id ?? "");

  async function run(fn: () => Promise<{ success: boolean; error?: string; message?: string }>) {
    setPending(true);
    const res = await fn();
    setPending(false);
    if (!res.success) {
      toast.error(res.error ?? "Απέτυχε");
      return false;
    }
    if (res.message) toast.success(res.message);
    router.refresh();
    return true;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-white">Content Pipeline · Research</h1>
        <p className="mt-1 text-sm text-white/55">Εβδομάδα {week}</p>
      </header>

      {/* ---- QA review (Manos) ---- */}
      {canQa && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Για QA ({qaBunches.length})</h2>
          {qaBunches.length === 0 && (
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/45">
              Κανένα bunch για έλεγχο αυτή τη στιγμή.
            </p>
          )}
          {qaBunches.map(({ bunch, ideas }) => {
            const allChecked = ideas.length > 0 && ideas.every((i) => i.checked);
            return (
              <div key={bunch.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{bunch.creator_name}</p>
                    <p className="text-xs text-white/45">από {bunch.researcher_name}</p>
                  </div>
                  <StatusBadge status={bunch.status} />
                </div>
                <ul className="space-y-2">
                  {ideas.map((idea) => (
                    <li key={idea.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                      <input
                        type="checkbox"
                        checked={idea.checked}
                        disabled={pending}
                        onChange={(e) => run(() => qaSetIdeaChecked(idea.id, e.target.checked))}
                        className="mt-0.5 h-4 w-4 accent-pink-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/90">{idea.idea_text}</p>
                        <p className="mt-0.5 text-[11px] text-white/40">
                          {idea.platform}
                          {idea.reference_link ? ` · ${idea.reference_link}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    disabled={pending}
                    onClick={() => run(() => qaRequestChanges(bunch.id))}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Αλλαγές
                  </button>
                  <button
                    disabled={pending || !allChecked}
                    onClick={() => run(() => qaApproveBunch(bunch.id))}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
                    title={allChecked ? "" : "Τσέκαρε όλες τις ιδέες πρώτα"}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Έγκριση → Creative
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ---- My research (researcher) ---- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Τα research bunches μου</h2>

        {assignedCreators.length === 0 ? (
          <div className="inline-flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            Δεν σου έχει ανατεθεί κανένας creator ως researcher ακόμα.
          </div>
        ) : (
          <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-white/50">Νέο bunch για creator</label>
              <select value={newCreator} onChange={(e) => setNewCreator(e.target.value)} className={inputCls}>
                {assignedCreators.map((c) => (
                  <option key={c.model_id} value={c.model_id} className="bg-[#1a1a1a]">
                    {c.model_name}
                  </option>
                ))}
              </select>
            </div>
            <button
              disabled={pending || !newCreator}
              onClick={() => {
                const c = assignedCreators.find((x) => x.model_id === newCreator);
                if (!c) return;
                run(() => createResearchBunch({ creator_model_id: c.model_id, creator_name: c.model_name, week }));
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 px-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Νέο
            </button>
          </div>
        )}

        {myBunches.length === 0 && assignedCreators.length > 0 && (
          <p className="text-sm text-white/45">Δεν έχεις bunches ακόμα — φτιάξε ένα.</p>
        )}

        {myBunches.map(({ bunch, ideas }) => (
          <ResearcherBunchCard key={bunch.id} bunch={bunch} ideas={ideas} pending={pending} run={run} />
        ))}
      </section>
    </div>
  );
}

function ResearcherBunchCard({
  bunch,
  ideas,
  pending,
  run,
}: {
  bunch: Bunch;
  ideas: Idea[];
  pending: boolean;
  run: (fn: () => Promise<{ success: boolean; error?: string; message?: string }>) => Promise<boolean>;
}) {
  const [text, setText] = React.useState("");
  const [platform, setPlatform] = React.useState<"IG" | "TT" | "both">("IG");
  const [link, setLink] = React.useState("");
  const editable = bunch.status === "draft" || bunch.status === "changes_requested";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-medium text-white">{bunch.creator_name}</p>
        <StatusBadge status={bunch.status} />
      </div>

      <ul className="space-y-2">
        {ideas.map((idea) => (
          <li key={idea.id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/90">{idea.idea_text}</p>
              <p className="mt-0.5 text-[11px] text-white/40">
                {idea.platform}
                {idea.checked ? " · ✓ QA" : ""}
                {idea.spawned_item_id ? " · → Creative" : ""}
              </p>
            </div>
            {editable && (
              <button
                disabled={pending}
                onClick={() => run(() => removeResearchIdea(idea.id))}
                className="text-white/35 transition hover:text-red-300 disabled:opacity-50"
                aria-label="Διαγραφή"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
        {ideas.length === 0 && <li className="text-sm text-white/40">Καμία ιδέα ακόμα.</li>}
      </ul>

      {editable && (
        <>
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Νέα ιδέα…"
                className={inputCls}
              />
            </div>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as "IG" | "TT" | "both")} className={`${inputCls} w-20`}>
              <option value="IG" className="bg-[#1a1a1a]">IG</option>
              <option value="TT" className="bg-[#1a1a1a]">TT</option>
              <option value="both" className="bg-[#1a1a1a]">both</option>
            </select>
            <button
              disabled={pending || !text.trim()}
              onClick={async () => {
                const ok = await run(() =>
                  addResearchIdea({ bunch_id: bunch.id, platform, idea_text: text.trim(), reference_link: link.trim() || undefined })
                );
                if (ok) {
                  setText("");
                  setLink("");
                }
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Ιδέα
            </button>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              disabled={pending || ideas.length === 0}
              onClick={() => run(() => submitResearchBunch(bunch.id))}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" /> Στείλε για QA
            </button>
          </div>
        </>
      )}
    </div>
  );
}
