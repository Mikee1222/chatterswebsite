"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

// Labels describe the ACTIVITY/stage, not the role name (creators who self-film see "Filming").
const ROLES: { slug: string; label: string }[] = [
  { slug: "researcher", label: "Research" },
  { slug: "creative", label: "Scripting" },
  { slug: "filmer", label: "Filming" },
  { slug: "editor", label: "Editing" },
  { slug: "icloud-manager", label: "iCloud" },
  { slug: "marketing-executive", label: "Posting" },
  { slug: "head-of-marketing", label: "QA" },
];

/** Admin-only: preview how the pipeline page looks for each role. */
export function PipelineRolePreviewBar({ current }: { current: string }) {
  const router = useRouter();
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/50">
        <Eye className="h-3.5 w-3.5" /> Preview ως:
      </span>
      <button
        onClick={() => router.push("/pipeline")}
        className={`rounded-lg px-2.5 py-1 text-xs transition ${!current ? "bg-pink-500/20 text-pink-200" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
      >
        Εγώ (admin)
      </button>
      {ROLES.map((r) => (
        <button
          key={r.slug}
          onClick={() => router.push(`/pipeline?as=${r.slug}`)}
          className={`rounded-lg px-2.5 py-1 text-xs transition ${current === r.slug ? "bg-pink-500/20 text-pink-200" : "bg-white/5 text-white/50 hover:bg-white/10"}`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
