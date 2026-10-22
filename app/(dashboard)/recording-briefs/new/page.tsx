"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RecordingBriefForm } from "@/components/recording-brief-form";
import type { RecordingBriefInput } from "@/services/recording-briefs";
import { ROUTES } from "@/lib/routes";
import { VA_BTN_SECONDARY } from "@/lib/va-tasks-tokens";

type ModelOption = { id: string; model_name: string };

export default function NewRecordingBriefPage() {
  const router = useRouter();
  const [models, setModels] = React.useState<ModelOption[]>([]);
  const [forbidden, setForbidden] = React.useState(false);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    void (async () => {
      const meta = await fetch("/api/recording-briefs/meta");
      if (!meta.ok) {
        setForbidden(true);
        setReady(true);
        return;
      }
      const data = (await meta.json()) as { models?: ModelOption[]; canManage?: boolean };
      if (!data.canManage) {
        setForbidden(true);
        setReady(true);
        return;
      }
      setModels(data.models ?? []);
      setReady(true);
    })();
  }, []);

  const onSubmit = async (input: RecordingBriefInput) => {
    const res = await fetch("/api/recording-briefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as { brief?: { id: string }; error?: string };
    if (!res.ok || !data.brief) throw new Error(data.error || "Failed to create");
    router.push(ROUTES.recordingBrief(data.brief.id));
    router.refresh();
  };

  if (!ready) {
    return <div className="px-4 py-8 text-sm text-white/50">Loading…</div>;
  }

  if (forbidden) {
    return (
      <div className="px-4 py-8">
        <p className="text-white/70">You do not have permission to create recording briefs.</p>
        <Link href={ROUTES.recordingBriefs} className={VA_BTN_SECONDARY}>
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-white">New recording brief</h1>
      <RecordingBriefForm
        models={models}
        onSubmit={onSubmit}
        onCancel={() => router.push(ROUTES.recordingBriefs)}
      />
    </div>
  );
}
