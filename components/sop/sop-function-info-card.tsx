"use client";

import { Building2, CalendarClock, Target } from "lucide-react";
import { motion } from "framer-motion";
import { CADENCE_LABELS, CADENCE_STYLES, SOP_COLOR_STYLES } from "@/components/sop/sop-colors";
import { useSopMotion } from "@/components/sop/sop-motion";
import { cn } from "@/lib/utils";
import type { CadenceType, SopDepartment, SopFunction } from "@/types";

type InfoRowProps = {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accentClass?: string;
};

function InfoRow({ icon, label, value, accentClass }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]",
          accentClass
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-white/85">{value}</div>
      </div>
    </div>
  );
}

export function SopFunctionInfoCard({
  fn,
  department,
  className,
  compact = false,
}: {
  fn: SopFunction;
  department: SopDepartment | undefined;
  className?: string;
  /** Tighter padding for admin list contexts */
  compact?: boolean;
}) {
  const motionCfg = useSopMotion();
  const deptStyle = department ? SOP_COLOR_STYLES[department.color] : SOP_COLOR_STYLES.gray;
  const cadenceStyle = CADENCE_STYLES[fn.cadence_type as CadenceType] ?? CADENCE_STYLES.weekly;
  const cadenceLabel = CADENCE_LABELS[fn.cadence_type as CadenceType] ?? fn.cadence_type;

  const rows: InfoRowProps[] = [];

  if (department) {
    rows.push({
      icon: <Building2 className="h-4 w-4 text-white/55" />,
      label: "Department",
      value: (
        <span className={cn("inline-flex items-center gap-2", deptStyle.text)}>
          <span className={cn("h-2 w-2 shrink-0 rounded-full", deptStyle.dot)} aria-hidden />
          {department.name}
        </span>
      ),
      accentClass: deptStyle.border,
    });
  }

  rows.push({
    icon: <CalendarClock className="h-4 w-4 text-white/55" />,
    label: "Cadence",
    value: (
      <span>
        <span
          className={cn(
            "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            cadenceStyle.badge
          )}
        >
          {cadenceLabel}
        </span>
        {fn.cadence_note.trim() ? (
          <span className="mt-1 block text-xs font-normal text-white/50">{fn.cadence_note}</span>
        ) : null}
      </span>
    ),
    accentClass: "border-white/10",
  });

  if (fn.kpi.trim()) {
    rows.push({
      icon: <Target className="h-4 w-4 text-pink-300/70" />,
      label: "KPI",
      value: <span className="text-white/75">{fn.kpi}</span>,
      accentClass: "border-pink-500/20",
    });
  }

  if (rows.length === 0) return null;

  return (
    <motion.div
      variants={motionCfg.item}
      initial="hidden"
      animate="show"
      className={cn(
        "sop-glass-panel rounded-xl border border-white/10 bg-white/[0.03]",
        compact ? "p-3.5" : "p-4",
        className
      )}
    >
      <div className={cn("grid gap-4", compact ? "gap-3" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {rows.map((row) => (
          <InfoRow key={row.label} {...row} />
        ))}
      </div>
    </motion.div>
  );
}
