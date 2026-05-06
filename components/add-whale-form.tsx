"use client";
import { devLog } from "@/lib/dev-log";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";
import { useToast } from "@/contexts/toast-context";
import { ROUTES } from "@/lib/routes";
import { createWhaleAction } from "@/app/actions/whales";
import type { AppNotification } from "@/types";
import type { RelationshipStatus } from "@/types";

/** Display order per spec (values must match Airtable single-select). */
const RELATIONSHIP_FORM_OPTIONS: RelationshipStatus[] = [
  "New",
  "Interested",
  "In Love",
  "Simp",
  "Angry",
];

const PLATFORM_OPTIONS = [{ value: "onlyfans", label: "OnlyFans" }] as const;

function localToast(id: string, title: string, body: string, priority: "normal" | "high"): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddWhaleForm({ open, onOpenChange }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [username, setUsername] = React.useState("");
  const [platform, setPlatform] = React.useState<string>("onlyfans");
  const [relationshipStatus, setRelationshipStatus] = React.useState<RelationshipStatus>("New");
  const [notes, setNotes] = React.useState("");
  const [hoursUsuallyActive, setHoursUsuallyActive] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setUsername("");
      setPlatform("onlyfans");
      setRelationshipStatus("New");
      setNotes("");
      setHoursUsuallyActive("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    devLog("[AddWhaleForm] submit fired", { username: username.trim() });
    setError(null);
    const u = username.trim();
    if (!u) {
      setError("Username is required.");
      addToast(localToast(`err-${Date.now()}`, "Could not add whale", "Username is required.", "high"));
      return;
    }
    setPending(true);
    try {
      const res = await createWhaleAction({
        username: u,
        platform,
        relationship_status: relationshipStatus,
        notes: notes.trim(),
        hours_usually_active: hoursUsuallyActive.trim(),
      });
      if (!res.success) {
        const msg = res.error || "Something went wrong.";
        console.error("[AddWhaleForm] action returned error", msg);
        setError(msg);
        addToast(localToast(`err-${Date.now()}`, "Could not add whale", msg, "high"));
        return;
      }
      addToast(
        localToast(`ok-${Date.now()}`, "Whale added", `${u} was added to your whales.`, "normal")
      );
      onOpenChange(false);
      router.push(ROUTES.chatter.myWhales);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[AddWhaleForm] submit threw", err);
      setError(msg);
      addToast(localToast(`err-${Date.now()}`, "Could not add whale", msg, "high"));
    } finally {
      setPending(false);
    }
  }

  /** Portal + high z-index: escapes `.dashboard-bg { overflow: hidden }` and sits above mobile nav (`z-index: 95 !important`). */
  const modal = (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => !pending && onOpenChange(false)}
      />
      <div
        className="relative z-[210] w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0c0e] p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-whale-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="add-whale-title" className="text-base font-semibold text-white">
              Add whale
            </h2>
            <p className="mt-1 text-xs text-white/50">You&apos;ll be assigned as chatter. Admins can assign a model later.</p>
          </div>
          <button
            type="button"
            onClick={() => !pending && onOpenChange(false)}
            className="shrink-0 rounded-xl px-3 py-1.5 text-sm text-white/60 hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </div>

        <form onSubmit={(e) => handleSubmit(e)} className="space-y-5" noValidate>
          <div>
            <p className="mb-2 border-b border-white/10 pb-1.5 text-[10px] font-medium uppercase tracking-widest text-white/40">
              Whale info
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/80">Username</label>
                <input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@username"
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-white/35 focus:border-white/25"
                />
              </div>
              <div className="relative z-[140] [&_button]:h-10 [&_button]:min-h-0">
                <label className="mb-1.5 block text-xs font-medium text-white/80">Platform</label>
                <CustomSelect
                  value={platform}
                  onChange={setPlatform}
                  options={PLATFORM_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
              </div>
              <div className="relative z-[140] [&_button]:h-10 [&_button]:min-h-0">
                <label className="mb-1.5 block text-xs font-medium text-white/80">Relationship status</label>
                <CustomSelect
                  value={relationshipStatus}
                  onChange={(v) => setRelationshipStatus(v as RelationshipStatus)}
                  options={RELATIONSHIP_FORM_OPTIONS.map((r) => ({ value: r, label: r }))}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 border-b border-white/10 pb-1.5 text-[10px] font-medium uppercase tracking-widest text-white/40">
              Notes
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/80">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes about this whale..."
                  rows={3}
                  className="min-h-[4.5rem] w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none ring-0 placeholder:text-white/35 focus:border-white/25"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/80">Hours usually active</label>
                <input
                  value={hoursUsuallyActive}
                  onChange={(e) => setHoursUsuallyActive(e.target.value)}
                  placeholder="e.g. 8pm - 12am"
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none ring-0 placeholder:text-white/35 focus:border-white/25"
                />
              </div>
            </div>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-pink-600 text-sm font-semibold text-white transition-colors hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Add whale"
            )}
          </button>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
