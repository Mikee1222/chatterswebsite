"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trophy, Sparkles, Send } from "lucide-react";
import { saveWinnerElementsAction, generateWinnerRecreatesAction } from "@/app/actions/winner-pipeline";

type Entry = {
  id: string;
  reference: string;
  tier: "winner" | "super_winner";
  views: number | null;
  elements: string;
  recreate_count: number;
  spawned: number;
};

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20";

export function WinnerLibraryClient({ entries }: { entries: Entry[] }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<"winner" | "super_winner">("winner");
  const [pending, setPending] = React.useState(false);

  const shown = entries.filter((e) => e.tier === tab);

  async function run(fn: () => Promise<{ success: boolean; error?: string; message?: string }>) {
    setPending(true);
    const r = await fn();
    setPending(false);
    if (!r.success) {
      toast.error(r.error ?? "Απέτυχε");
      return;
    }
    if (r.message) toast.success(r.message);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-white">Winner Library</h1>
        <p className="mt-1 text-sm text-white/55">Γράψε τα elements & τράβα όσα recreates θες σε κάθε bunch. Τα υπόλοιπα μένουν εδώ.</p>
      </div>

      <div className="inline-flex overflow-hidden rounded-xl border border-white/10">
        {(["winner", "super_winner"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm transition ${tab === t ? "bg-pink-500/20 text-pink-200" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>
            {t === "winner" ? <Trophy className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {t === "winner" ? "Winners" : "Super"} ({entries.filter((e) => e.tier === t).length})
          </button>
        ))}
      </div>

      {shown.length === 0 && <p className="text-sm text-white/40">Κανένα εδώ ακόμα.</p>}

      {shown.map((e) => (
        <WinnerCard key={e.id} entry={e} pending={pending} run={run} />
      ))}
    </div>
  );
}

function WinnerCard({
  entry,
  pending,
  run,
}: {
  entry: Entry;
  pending: boolean;
  run: (fn: () => Promise<{ success: boolean; error?: string; message?: string }>) => Promise<void>;
}) {
  const [elements, setElements] = React.useState(entry.elements);
  const [count, setCount] = React.useState(entry.recreate_count);
  const [tier, setTier] = React.useState(entry.tier);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-medium text-white">{entry.reference}</p>
        <span className="text-xs text-white/45">
          {entry.views != null ? `${(entry.views / 1000).toFixed(0)}K views · ` : ""}
          {entry.spawned > 0 ? `${entry.spawned} spawned` : "στη βιβλιοθήκη"}
        </span>
      </div>

      <label className="mb-1 block text-xs text-white/50">Elements που αλλάζουν</label>
      <textarea value={elements} onChange={(e) => setElements(e.target.value)} rows={2} placeholder="π.χ. άλλαξε hook, ρούχα, τοποθεσία…" className={inputCls} />

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-white/50">Tier</label>
          <select value={tier} onChange={(e) => setTier(e.target.value as "winner" | "super_winner")} className={`${inputCls} w-32`}>
            <option value="winner" className="bg-[#1a1a1a]">winner</option>
            <option value="super_winner" className="bg-[#1a1a1a]">super_winner</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Recreates</label>
          <input type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} className={`${inputCls} w-24`} />
        </div>
        <button disabled={pending} onClick={() => run(() => saveWinnerElementsAction(entry.id, { tier, recreate_count: count, elements }))}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10 disabled:opacity-50">
          Αποθήκευση
        </button>
        <button disabled={pending} onClick={() => run(() => generateWinnerRecreatesAction(entry.id, count))}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40">
          <Send className="h-3.5 w-3.5" /> {count} → Creative
        </button>
      </div>
    </div>
  );
}
