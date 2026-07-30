"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, AlertTriangle, Send, Trophy } from "lucide-react";
import {
  submitStageAction,
  qaApproveItemAction,
  qaRejectItemAction,
  setFilmTypeAction,
} from "@/app/actions/content-pipeline";
import { submitItemAsWinner } from "@/app/actions/winner-pipeline";

type Item = {
  id: string;
  title: string;
  creator_name: string;
  stage: string;
  status: string;
  film_type: string;
};

type Props = {
  myItems: Item[];
  qaItems: Item[];
  blockedItems: Item[];
  canManage: boolean;
};

const STAGE_LABEL: Record<string, string> = {
  creative: "Creative (script)",
  filming: "Filming",
  icloud_raw: "iCloud / RAW",
  editing: "Editing",
  icloud_edited: "iCloud (edited)",
  post: "Post",
  analytics: "Analytics",
  done: "Done",
};
function stageLabel(s: string) {
  return STAGE_LABEL[s] ?? s;
}

const SUBMIT_LABEL: Record<string, string> = {
  creative: "Script έτοιμο → QA",
  filming: "Ανέβηκε iCloud → QA",
  icloud_raw: "Στα RAW → Editing",
  editing: "Έτοιμο → QA",
  icloud_edited: "Στο ready-to-post → Post",
  post: "Postαρίστηκε",
};

export function ContentQueueClient({ myItems, qaItems, blockedItems, canManage }: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function run(fn: () => Promise<{ success: boolean; error?: string; message?: string }>) {
    setPending(true);
    const res = await fn();
    setPending(false);
    if (!res.success) {
      toast.error(res.error ?? "Απέτυχε");
      return;
    }
    if (res.message) toast.success(res.message);
    router.refresh();
  }

  const nothing = myItems.length === 0 && qaItems.length === 0 && (!canManage || blockedItems.length === 0);

  return (
    <div className="space-y-8">
      {qaItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Για QA ({qaItems.length})</h2>
          {qaItems.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{it.title}</p>
                <p className="text-xs text-white/45">{it.creator_name} · {stageLabel(it.stage)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  disabled={pending}
                  onClick={() => run(() => qaRejectItemAction(it.id))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Πίσω
                </button>
                <button
                  disabled={pending}
                  onClick={() => run(() => qaApproveItemAction(it.id))}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Έγκριση
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Η ουρά μου ({myItems.length})</h2>
        {myItems.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/45">
            Καμία δουλειά στην ουρά σου τώρα.
          </p>
        )}
        {myItems.map((it) => (
          <div key={it.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{it.title}</p>
              <p className="text-xs text-white/45">
                {it.creator_name} · {stageLabel(it.stage)}
                {it.status === "rejected" && <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-200">επιστράφηκε</span>}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {it.stage === "post" && (
                <button
                  disabled={pending}
                  onClick={() => run(() => submitItemAsWinner(it.id))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-sm text-amber-200 transition hover:bg-amber-400/20 disabled:opacity-50"
                  title="Πέρασε 100K → submit ως winner"
                >
                  <Trophy className="h-3.5 w-3.5" /> &gt;100K
                </button>
              )}
              {it.stage === "filming" && canManage && (
                <div className="inline-flex overflow-hidden rounded-xl border border-white/10">
                  {(["self_record", "filmer"] as const).map((ft) => (
                    <button
                      key={ft}
                      disabled={pending}
                      onClick={() => run(() => setFilmTypeAction(it.id, ft))}
                      className={`px-2.5 py-1.5 text-xs transition ${it.film_type === ft ? "bg-pink-500/20 text-pink-200" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
                    >
                      {ft === "self_record" ? "Self" : "Filmer"}
                    </button>
                  ))}
                </div>
              )}
              <button
                disabled={pending}
                onClick={() => run(() => submitStageAction(it.id))}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" /> {SUBMIT_LABEL[it.stage] ?? "Ready"}
              </button>
            </div>
          </div>
        ))}
      </section>

      {canManage && blockedItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-200/80">
            <AlertTriangle className="h-3.5 w-3.5" /> Μπλοκαρισμένα — χωρίς owner ({blockedItems.length})
          </h2>
          {blockedItems.map((it) => (
            <div key={it.id} className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
              <p className="font-medium text-white">{it.title}</p>
              <p className="text-xs text-white/45">
                {it.creator_name} · {stageLabel(it.stage)} — ανάθεσε άτομο στο Pipeline Assignments
              </p>
            </div>
          ))}
        </section>
      )}

      {nothing && (
        <p className="text-xs text-white/30">Το pipeline είναι ήσυχο — δεν υπάρχουν items σε αυτό το στάδιο.</p>
      )}
    </div>
  );
}
