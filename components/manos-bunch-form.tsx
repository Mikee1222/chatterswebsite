"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createBunchAction } from "@/app/actions/research-bunches";

type Creator = { model_id: string; model_name: string };
const inputCls = "h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20";

export function ManosBunchForm({ creators }: { creators: Creator[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [creator, setCreator] = React.useState(creators[0]?.model_id ?? "");
  const [research, setResearch] = React.useState(3);
  const [winner, setWinner] = React.useState(0);
  const [deadline, setDeadline] = React.useState("");

  async function submit() {
    const c = creators.find((x) => x.model_id === creator);
    if (!c) return;
    setPending(true);
    const res = await createBunchAction({
      creator_model_id: c.model_id,
      creator_name: c.model_name,
      target_research: research,
      target_winner: winner,
      deadline: deadline || undefined,
    });
    setPending(false);
    if (!res.success) return toast.error(res.error ?? "Απέτυχε");
    toast.success(res.message ?? "Δημιουργήθηκε");
    router.refresh();
  }

  return (
    <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Νέο bunch</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="col-span-2 md:col-span-1">
          <label className="mb-1 block text-xs text-white/50">Creator</label>
          <select value={creator} onChange={(e) => setCreator(e.target.value)} className={inputCls}>
            {creators.map((c) => <option key={c.model_id} value={c.model_id} className="bg-[#1a1a1a]">{c.model_name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Research vids</label>
          <input type="number" min={0} value={research} onChange={(e) => setResearch(Math.max(0, +e.target.value || 0))} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Winner vids</label>
          <input type="number" min={0} value={winner} onChange={(e) => setWinner(Math.max(0, +e.target.value || 0))} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Deadline</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
        </div>
        <div className="flex items-end">
          <button disabled={pending || !creator} onClick={submit} className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
            <Plus className="h-4 w-4" /> Δημιουργία
          </button>
        </div>
      </div>
    </div>
  );
}
