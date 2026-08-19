"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, Timer } from "lucide-react";
import { AdminTaskTemplatesClient } from "@/components/admin-task-templates-client";
import { AdminTaskTimerConfigClient } from "@/components/admin-task-timer-config-client";
import { cn } from "@/lib/utils";
import type { TimerConfig } from "@/services/task-category-timer";
import type { TaskTemplateRecord } from "@/services/task-templates";

type Tab = "templates" | "timer-config";

type Props = {
  initialTemplates: TaskTemplateRecord[];
  initialTimerConfigs: TimerConfig[];
  initialTab?: Tab;
};

function tabFromSearchParam(value: string | null): Tab {
  return value === "timer-config" ? "timer-config" : "templates";
}

export function AdminTasksSettingsClient({
  initialTemplates,
  initialTimerConfigs,
  initialTab = "templates",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mainTab, setMainTab] = React.useState<Tab>(initialTab);

  React.useEffect(() => {
    setMainTab(tabFromSearchParam(searchParams.get("tab")));
  }, [searchParams]);

  const setTab = (tab: Tab) => {
    setMainTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "templates") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  };

  return (
    <div
      className={cn(
        "mx-auto px-4 py-6 md:px-6",
        mainTab === "templates" ? "max-w-7xl" : "max-w-2xl",
      )}
    >
      <div className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-pink-400">Administration</p>
        <h1 className="mt-2 text-[36px] font-bold leading-tight tracking-tight text-white">Tasks Settings</h1>
        <p className="mt-2 text-sm text-white/40">
          Reusable task templates and per-category timer configuration
        </p>
      </div>

      <div className="mb-8 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("templates")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition",
            mainTab === "templates"
              ? "border-pink-500/35 bg-pink-500/15 text-pink-200"
              : "border-white/10 bg-white/[0.04] text-white/50 hover:text-white/80",
          )}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Templates
        </button>
        <button
          type="button"
          onClick={() => setTab("timer-config")}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition",
            mainTab === "timer-config"
              ? "border-pink-500/35 bg-pink-500/15 text-pink-200"
              : "border-white/10 bg-white/[0.04] text-white/50 hover:text-white/80",
          )}
        >
          <Timer className="h-3.5 w-3.5" />
          Timer Config
        </button>
      </div>

      {mainTab === "templates" ? (
        <AdminTaskTemplatesClient initialTemplates={initialTemplates} embedded />
      ) : (
        <AdminTaskTimerConfigClient initialConfigs={initialTimerConfigs} embedded />
      )}
    </div>
  );
}
