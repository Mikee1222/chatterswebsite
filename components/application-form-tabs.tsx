"use client";

import Link from "next/link";
import { BarChart3, LayoutList, Pencil } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

export type ApplicationFormTab = "edit" | "responses" | "analytics";

const TABS: {
  id: ApplicationFormTab;
  label: string;
  href: (formId: string) => string;
  icon: typeof Pencil;
}[] = [
  {
    id: "edit",
    label: "Edit / Pipeline",
    href: ROUTES.admin.applicationFormDetail,
    icon: Pencil,
  },
  {
    id: "responses",
    label: "Responses",
    href: ROUTES.admin.applicationFormResponses,
    icon: LayoutList,
  },
  {
    id: "analytics",
    label: "Analytics",
    href: ROUTES.admin.applicationFormAnalytics,
    icon: BarChart3,
  },
];

export function ApplicationFormTabs({
  formId,
  active,
  responseCount,
}: {
  formId: string;
  active: ApplicationFormTab;
  responseCount?: number;
}) {
  return (
    <div className="mt-4 inline-flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === active;
        const label =
          tab.id === "responses" && responseCount != null
            ? `Responses (${responseCount})`
            : tab.label;
        return (
          <Link
            key={tab.id}
            href={tab.href(formId)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
              isActive
                ? "bg-[#FF1493]/20 text-[#FF1493]"
                : "text-white/50 hover:text-white/80",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
