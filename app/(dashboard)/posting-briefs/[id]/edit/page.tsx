"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PostingBriefForm, type AccountSuggestion } from "@/components/posting-brief-form";
import { ROUTES } from "@/lib/routes";
import type { PostingBrief, PostingBriefInput } from "@/services/posting-briefs";
import { VA_BTN_SECONDARY } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

export default function EditPostingBriefPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [brief, setBrief] = React.useState<PostingBrief | null>(null);
  const [models, setModels] = React.useState<{ id: string; model_name: string }[]>([]);
  const [suggestions, setSuggestions] = React.useState<Record<string, AccountSuggestion[]>>({});
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [briefRes, metaRes] = await Promise.all([
          fetch(`/api/posting-briefs/${encodeURIComponent(id)}`),
          fetch("/api/posting-briefs/meta"),
        ]);
        if (briefRes.status === 403 || metaRes.status === 403) {
          if (!cancelled) setError("Forbidden");
          return;
        }
        const briefData = (await briefRes.json()) as {
          brief?: PostingBrief;
          canManage?: boolean;
          error?: string;
        };
        const metaData = (await metaRes.json()) as {
          models?: { id: string; model_name: string }[];
          accountsByModel?: Record<string, AccountSuggestion[]>;
          canManage?: boolean;
        };
        if (!briefData.canManage || !metaData.canManage) {
          if (!cancelled) setError("Forbidden");
          return;
        }
        if (!briefRes.ok || !briefData.brief) {
          if (!cancelled) setError(briefData.error || "Not found");
          return;
        }
        if (!cancelled) {
          setBrief(briefData.brief);
          setModels(metaData.models ?? []);
          setSuggestions(metaData.accountsByModel ?? {});
        }
      } catch {
        if (!cancelled) setError("Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const onSubmit = async (input: PostingBriefInput) => {
    const res = await fetch(`/api/posting-briefs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as { brief?: PostingBrief; error?: string };
    if (!res.ok || !data.brief) throw new Error(data.error || "Failed to save");
    router.push(ROUTES.postingBrief(data.brief.id));
    router.refresh();
  };

  if (error) {
    return (
      <div className="px-4 py-10 text-center text-sm text-white/50">{error}</div>
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
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-white">Edit posting brief</h1>
      {brief ? (
        <PostingBriefForm
          models={models}
          accountSuggestionsByModel={suggestions}
          initial={brief}
          submitLabel="Save changes"
          onSubmit={onSubmit}
          onCancel={() => router.push(ROUTES.postingBrief(brief.id))}
        />
      ) : (
        <p className="text-sm text-white/40">Loading…</p>
      )}
    </div>
  );
}
