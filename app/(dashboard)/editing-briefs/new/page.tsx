"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  EditingBriefForm,
  type EditorOption,
  type RecordingBriefOption,
} from "@/components/editing-brief-form";
import type { EditingBrief, EditingBriefInput } from "@/services/editing-briefs";
import { ROUTES } from "@/lib/routes";
import { VA_BTN_SECONDARY } from "@/lib/va-tasks-tokens";

type ModelOption = { id: string; model_name: string };

export default function NewEditingBriefPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromRecording = searchParams.get("from_recording");

  const [models, setModels] = React.useState<ModelOption[]>([]);
  const [editors, setEditors] = React.useState<EditorOption[]>([]);
  const [recordingBriefs, setRecordingBriefs] = React.useState<RecordingBriefOption[]>([]);
  const [initial, setInitial] = React.useState<EditingBrief | null>(null);
  const [forbidden, setForbidden] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      const meta = await fetch("/api/editing-briefs/meta");
      if (!meta.ok) {
        setForbidden(true);
        setReady(true);
        return;
      }
      const data = (await meta.json()) as {
        canManage?: boolean;
        models?: ModelOption[];
        editors?: EditorOption[];
        recordingBriefs?: RecordingBriefOption[];
      };
      if (!data.canManage) {
        setForbidden(true);
        setReady(true);
        return;
      }
      setModels(data.models ?? []);
      setEditors(data.editors ?? []);
      setRecordingBriefs(data.recordingBriefs ?? []);

      if (fromRecording) {
        const pre = await fetch(
          `/api/editing-briefs/prefill-from-recording?id=${encodeURIComponent(fromRecording)}`,
        );
        if (pre.ok) {
          const pref = (await pre.json()) as { brief?: EditingBrief };
          if (pref.brief) setInitial(pref.brief);
        }
      }
      setReady(true);
    })();
  }, [fromRecording]);

  const onSubmit = async (input: EditingBriefInput) => {
    const res = await fetch("/api/editing-briefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as { brief?: { id: string }; error?: string };
    if (!res.ok || !data.brief) throw new Error(data.error || "Failed to create");
    router.push(ROUTES.editingBrief(data.brief.id));
    router.refresh();
  };

  if (!ready) return <div className="px-4 py-8 text-sm text-white/50">Loading…</div>;
  if (forbidden) {
    return (
      <div className="px-4 py-8">
        <p className="text-white/70">You do not have permission to create editing briefs.</p>
        <Link href={ROUTES.editingBriefs} className={VA_BTN_SECONDARY}>
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-white">New editing brief</h1>
      <EditingBriefForm
        models={models}
        editors={editors}
        recordingBriefOptions={recordingBriefs}
        initial={initial}
        onSubmit={onSubmit}
        onCancel={() => router.push(ROUTES.editingBriefs)}
      />
    </div>
  );
}
