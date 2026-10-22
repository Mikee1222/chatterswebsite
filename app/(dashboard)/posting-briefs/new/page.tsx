"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PostingBriefForm, type AccountSuggestion } from "@/components/posting-brief-form";
import { ROUTES } from "@/lib/routes";
import type { PostingBrief, PostingBriefInput } from "@/services/posting-briefs";
import type { ModelRecord } from "@/types";
import { VA_BTN_SECONDARY } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

export default function NewPostingBriefPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromEditing = searchParams.get("from_editing");
  const [models, setModels] = React.useState<{ id: string; model_name: string }[]>([]);
  const [suggestions, setSuggestions] = React.useState<Record<string, AccountSuggestion[]>>({});
  const [initial, setInitial] = React.useState<PostingBrief | null>(null);
  const [ready, setReady] = React.useState(false);
  const [forbidden, setForbidden] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/posting-briefs/meta");
        if (res.status === 403 || res.status === 401) {
          if (!cancelled) setForbidden(true);
          return;
        }
        const data = (await res.json()) as {
          models?: ModelRecord[];
          accountsByModel?: Record<string, AccountSuggestion[]>;
          canManage?: boolean;
          error?: string;
        };
        if (!data.canManage) {
          if (!cancelled) setForbidden(true);
          return;
        }
        if (fromEditing) {
          const pre = await fetch(
            `/api/posting-briefs/prefill-from-editing?id=${encodeURIComponent(fromEditing)}`,
          );
          if (pre.ok) {
            const pref = (await pre.json()) as { brief?: PostingBrief };
            if (!cancelled && pref.brief) setInitial(pref.brief);
          }
        }
        if (!cancelled) {
          setModels((data.models ?? []).map((m) => ({ id: m.id, model_name: m.model_name })));
          setSuggestions(data.accountsByModel ?? {});
          setReady(true);
        }
      } catch {
        if (!cancelled) setForbidden(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromEditing]);

  const onSubmit = async (input: PostingBriefInput) => {
    const res = await fetch("/api/posting-briefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as { brief?: { id: string }; error?: string };
    if (!res.ok || !data.brief) throw new Error(data.error || "Failed to create");
    router.push(ROUTES.postingBrief(data.brief.id));
    router.refresh();
  };

  if (forbidden) {
    return (
      <div className="px-4 py-10 text-center text-sm text-white/50">
        You do not have permission to create posting briefs.
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl px-4 py-6 md:px-6">
      <Link
        href={ROUTES.postingBriefs}
        className={cn(VA_BTN_SECONDARY, "mb-6 inline-flex min-h-10 items-center gap-2 px-3 text-sm")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-white">New posting brief</h1>
      {ready ? (
        <PostingBriefForm
          models={models}
          accountSuggestionsByModel={suggestions}
          initial={initial}
          onSubmit={onSubmit}
          onCancel={() => router.push(ROUTES.postingBriefs)}
        />
      ) : (
        <p className="text-sm text-white/40">Loading…</p>
      )}
    </div>
  );
}
