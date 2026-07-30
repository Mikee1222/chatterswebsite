"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LineChart, CheckCircle2, UserCheck, Trophy } from "lucide-react";

const TABS = [
  { key: "kpis", label: "KPIs", icon: LineChart },
  { key: "qa", label: "QA", icon: CheckCircle2 },
  { key: "assignments", label: "Assignments", icon: UserCheck },
  { key: "winners", label: "Winner Library", icon: Trophy },
];

export function PipelineAdminTabs({ current }: { current: string }) {
  const router = useRouter();
  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-3">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = current === t.key;
        return (
          <button
            key={t.key}
            onClick={() => router.push(`/admin/pipeline?tab=${t.key}`)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm transition ${active ? "bg-pink-500/20 text-pink-200" : "bg-white/5 text-white/55 hover:bg-white/10"}`}
          >
            <Icon className="h-4 w-4" /> {t.label}
          </button>
        );
      })}
    </div>
  );
}
