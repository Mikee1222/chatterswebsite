"use client";

import * as React from "react";
import { CustomSelect } from "@/components/ui/custom-select";
import { VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

const PRIORITY_OPTIONS = [
  { value: "", label: "All priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
] as const;

type Props = {
  onDeferredSearchChange: (query: string) => void;
  filterPriority: string;
  onFilterPriorityChange: (value: string) => void;
  className?: string;
};

/** Keeps keystroke state local so the task list does not re-render on every character. */
export const VaTasksSearchBar = React.memo(function VaTasksSearchBar({
  onDeferredSearchChange,
  filterPriority,
  onFilterPriorityChange,
  className,
}: Props) {
  const [search, setSearch] = React.useState("");
  const deferredSearch = React.useDeferredValue(search);

  React.useEffect(() => {
    onDeferredSearchChange(deferredSearch);
  }, [deferredSearch, onDeferredSearchChange]);

  return (
    <div className={cn("relative z-10 flex flex-wrap gap-2 pointer-events-auto", className)}>
      <input
        type="search"
        placeholder="Search tasks…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={cn(VA_FILTER_INPUT, "min-w-[10rem] flex-1")}
      />
      <CustomSelect
        value={filterPriority}
        onChange={onFilterPriorityChange}
        portaled
        placeholder="All priorities"
        className="min-w-[9rem]"
        options={[...PRIORITY_OPTIONS]}
      />
    </div>
  );
});
