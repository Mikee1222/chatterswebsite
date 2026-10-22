"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { RecordingBriefForm } from "@/components/recording-brief-form";
import type { RecordingBrief, RecordingBriefInput } from "@/services/recording-briefs";
import { ROUTES } from "@/lib/routes";
import { VA_BTN_SECONDARY } from "@/lib/va-tasks-tokens";

type ModelOption = { id: string; model_name: string };

export default function EditRecordingBriefPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [brief, setBrief] = React.useState<RecordingBrief | null>(null);
  const [models, setModels] = React.useState<ModelOption[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    void (async () => {
      const [briefRes, metaRes] = await Promise.all([
        fetch(`/api/recording-briefs/${encodeURIComponent(id)}`),
        fetch("/api/recording-briefs/meta"),
      ]);
      if (!briefRes.ok) {
        const data = (await briefRes.json()) as { error?: string };
        setError(data.error || "Not found");
        setReady(true);
        return;
      }
      const data = (await briefRes.json()) as {
        brief: RecordingBrief;
        canManage?: boolean;
      };
      if (!data.canManage) {
        setError("Forbidden");
        setReady(true);
        return;
      }
      setBrief(data.brief);
      if (metaRes.ok) {
        const meta = (await metaRes.json()) as { models?: ModelOption[] };
        setModels(meta.models ?? []);
      }
      setReady(true);
    })();
  }, [id]);

  const onSubmit = async (input: RecordingBriefInput) => {
    const res = await fetch(`/api/recording-briefs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as { brief?: RecordingBrief; error?: string };
    if (!res.ok || !data.brief) throw new Error(data.error || "Failed to save");
    router.push(ROUTES.recordingBrief(data.brief.id));
    router.refresh();
  };

  if (!ready) return <div className="px-4 py-8 text-sm text-white/50">Loading…</div>;
  if (error || !brief) {
    return (
      <div className="px-4 py-8">
        <p className="text-white/70">{error || "Not found"}</p>
        <Link href={ROUTES.recordingBriefs} className={VA_BTN_SECONDARY}>
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-white">Edit recording brief</h1>
      <RecordingBriefForm
        models={models}
        initial={brief}
        submitLabel={brief.status === "draft" ? "Save draft" : "Save changes"}
        onSubmit={onSubmit}
        onCancel={() => router.push(ROUTES.recordingBrief(brief.id))}
      />
    </div>
  );
}
