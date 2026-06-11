"use client";

import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/sidebar-context";

export function DashboardContentOffset({ children }: { children: React.ReactNode }) {
  const { collapsed, hydrated } = useSidebar();
  return (
    <div
      className={cn(
        "dashboard-content pl-0 transition-[padding] duration-200",
        hydrated && collapsed ? "md:pl-14" : "md:pl-64"
      )}
    >
      {children}
    </div>
  );
}
