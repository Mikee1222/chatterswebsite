"use client";

import * as React from "react";
import { CustomSelect } from "@/components/ui/custom-select";
import { VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { VaTaskPriority, VaTaskStatus } from "@/types";

const STATUSES: VaTaskStatus[] = ["pending", "in_progress", "done", "skipped"];
const PRIORITIES: VaTaskPriority[] = ["low", "normal", "high", "urgent"];

type VaUserOption = { value: string; label: string };

type Props = {
  onDeferredSearchChange: (query: string) => void;
  filterVa: string;
  onFilterVaChange: (value: string) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  filterPriority: string;
  onFilterPriorityChange: (value: string) => void;
  vaOptions: VaUserOption[];
  className?: string;
};

/** Isolates search keystrokes from the admin task grid. */
export const AdminVaTasksFilters = React.memo(function AdminVaTasksFilters({
  onDeferredSearchChange,
  filterVa,
  onFilterVaChange,
  filterStatus,
  onFilterStatusChange,
  filterPriority,
  onFilterPriorityChange,
  vaOptions,
  className,
}: Props) {
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);

  React.useEffect(() => {
    onDeferredSearchChange(deferredSearch);
  }, [deferredSearch, onDeferredSearchChange]);

  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      <input
        type="search"
        placeholder="Search tasks…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={cn(VA_FILTER_INPUT, "min-w-[10rem] flex-1")}
      />
      <CustomSelect
        value={filterVa}
        onChange={onFilterVaChange}
        options={vaOptions}
        triggerClassName={cn(VA_FILTER_INPUT, "min-w-[10rem]")}
        portaled
      />
      <select
        value={filterStatus}
        onChange={(e) => onFilterStatusChange(e.target.value)}
        className={cn(VA_FILTER_INPUT, "min-w-[9rem]")}
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <select
        value={filterPriority}
        onChange={(e) => onFilterPriorityChange(e.target.value)}
        className={cn(VA_FILTER_INPUT, "min-w-[9rem]")}
      >
        <option value="">All priorities</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
});
