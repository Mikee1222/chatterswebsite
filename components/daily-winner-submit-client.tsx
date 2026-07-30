"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trophy, Sparkles } from "lucide-react";
import { submitWinnerFromDailyAction } from "@/app/actions/winner-pipeline";

type Creator = { model_id: string; model_name: string };
const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20";

/** On the supervisor daily form: Evi uploads winners/super-winners → go to Manos' Winner Library. */
export function DailyWinnerSubmitClient({ creators }: { creators: Creator[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [link, setLink] = React.useState("");
  const [creator, setCreator] = React.useState(creators[0]?.model_id ?? "");
  const [elements, setElements] = React.useState("");
  const [tier, setTier] = React.useState<"winner" | "super_winner">("winner");

  async function submit() {
    const c = creators.find((x) => x.model_id === creator);
    if (!c) return;
    setPending(true);
    const res = await submitWinnerFromDailyAction({ video_link: link.trim(), creator_model_id: c.model_id, creator_name: c.model_name, elements: elements.trim(), tier });
    setPending(false);
    if (!res.success) return toast.error(res.error ?? "Απέτυχε");
    toast.success(res.message ?? "OK");
    setLink(""); setElements("");
    router.refresh();
  }

  return (
    <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-5">
      <h2 className="mb-1 inline-flex items-center gap-2 text-base font-semibold text-white"><Trophy className="h-4 w-4 text-amber-300" /> Submit Winners</h2>
      <p className="mb-4 text-xs text-white/50">Ανέβασε winner / super-winner videos μαζί με τον daily έλεγχο — πάνε αυτόματα στο Winner Library του Μάνου.</p>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-white/50">Link του winner video</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-white/50">Για creator</label>
            <select value={creator} onChange={(e) => setCreator(e.target.value)} className={inputCls}>
              {creators.map((c) => <option key={c.model_id} value={c.model_id} className="bg-[#1a1a1a]">{c.model_name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Tier</label>
            <div className="inline-flex overflow-hidden rounded-xl border border-white/10">
              {([["winner", "Winner"], ["super_winner", "Super"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setTier(v)} className={`inline-flex items-center gap-1 px-3 py-2 text-sm transition ${tier === v ? "bg-pink-500/20 text-pink-200" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>
                  {v === "super_winner" ? <Sparkles className="h-3.5 w-3.5" /> : <Trophy className="h-3.5 w-3.5" />} {l}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Elements που αλλάζουν (optional)</label>
          <textarea value={elements} onChange={(e) => setElements(e.target.value)} rows={2} placeholder="π.χ. hook, ρούχα, τοποθεσία…" className={inputCls} />
        </div>
        <div className="flex justify-end">
          <button disabled={pending || !link.trim() || !creator} onClick={submit} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
            <Trophy className="h-4 w-4" /> Submit
          </button>
        </div>
      </div>
    </div>
  );
}
