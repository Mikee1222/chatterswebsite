"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { LoomEmbed } from "@/components/ui/loom-embed";
import { cn } from "@/lib/utils";
import type { SopDepartment, SopFunction, SopRole, SopColor, CadenceType } from "@/types";

const sectionReveal = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const itemMotion = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] as const } },
};

const COLOR_STYLES: Record<SopColor, { badge: string; border: string; text: string }> = {
  blue: {
    badge: "border-blue-500/25 bg-blue-500/15 text-blue-300",
    border: "border-blue-500/20",
    text: "text-blue-300",
  },
  pink: {
    badge: "border-pink-500/25 bg-pink-500/15 text-pink-300",
    border: "border-pink-500/20",
    text: "text-pink-300",
  },
  green: {
    badge: "border-emerald-500/25 bg-emerald-500/15 text-emerald-300",
    border: "border-emerald-500/20",
    text: "text-emerald-300",
  },
  orange: {
    badge: "border-orange-500/25 bg-orange-500/15 text-orange-300",
    border: "border-orange-500/20",
    text: "text-orange-300",
  },
  purple: {
    badge: "border-violet-500/25 bg-violet-500/15 text-violet-300",
    border: "border-violet-500/20",
    text: "text-violet-300",
  },
  gray: {
    badge: "border-white/15 bg-white/10 text-white/60",
    border: "border-white/10",
    text: "text-white/60",
  },
};

const CADENCE_LABELS: Record<CadenceType, string> = {
  daily: "Daily",
  per_shift: "Per shift",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  ad_hoc: "Ad hoc",
};

const CADENCE_STYLES: Record<CadenceType, string> = {
  daily: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
  per_shift: "border-sky-500/25 bg-sky-500/10 text-sky-200",
  weekly: "border-violet-500/25 bg-violet-500/10 text-violet-200",
  biweekly: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  monthly: "border-pink-500/25 bg-pink-500/10 text-pink-200",
  ad_hoc: "border-white/15 bg-white/10 text-white/55",
};

export type SopRoleBundle = {
  role: SopRole;
  functions: SopFunction[];
};

function sortFunctions(items: SopFunction[]): SopFunction[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

function RoleTabs({
  roles,
  activeId,
  onChange,
}: {
  roles: SopRole[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  const pill = (active: boolean, color: SopColor) =>
    cn(
      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
      active
        ? cn("shadow-sm", COLOR_STYLES[color].badge)
        : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/80"
    );

  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((role) => (
        <button
          key={role.id}
          type="button"
          className={pill(activeId === role.id, role.color)}
          onClick={() => onChange(role.id)}
        >
          {role.icon ? <span className="mr-1">{role.icon}</span> : null}
          {role.name}
        </button>
      ))}
    </div>
  );
}

function FunctionCard({
  fn,
  department,
}: {
  fn: SopFunction;
  department: SopDepartment | undefined;
}) {
  const deptStyle = department ? COLOR_STYLES[department.color] : COLOR_STYLES.gray;
  const cadenceStyle = CADENCE_STYLES[fn.cadence_type];

  return (
    <motion.article
      variants={itemMotion}
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl"
      style={{
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -10px rgba(0,0,0,0.5), 0 0 40px -16px hsl(330 80% 55% / 0.04)",
      }}
    >
      <div className="border-b border-white/[0.06] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h3 className="text-base font-semibold text-white">{fn.name}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {department ? (
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", deptStyle.badge)}>
                {department.name}
              </span>
            ) : null}
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", cadenceStyle)}>
              {CADENCE_LABELS[fn.cadence_type]}
              {fn.cadence_note.trim() ? ` · ${fn.cadence_note}` : ""}
            </span>
          </div>
        </div>
        {fn.kpi.trim() ? (
          <p className="mt-2 text-sm text-white/55">
            <span className="font-semibold text-white/70">KPI:</span> {fn.kpi}
          </p>
        ) : null}
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">Standard</p>
          <Markdown emptyFallback="No SOP content yet.">{fn.sop_content}</Markdown>
        </div>
        {fn.loom_url.trim() ? <LoomEmbed url={fn.loom_url} title={`${fn.name} — Loom`} /> : null}
      </div>
    </motion.article>
  );
}

function RoleContent({
  bundle,
  departmentById,
}: {
  bundle: SopRoleBundle;
  departmentById: Map<string, SopDepartment>;
}) {
  const { role, functions } = bundle;
  const roleStyle = COLOR_STYLES[role.color];
  const sorted = sortFunctions(functions);

  return (
    <motion.div variants={sectionReveal} initial="hidden" animate="show" className="space-y-6">
      <header
        className={cn("rounded-2xl border p-5 backdrop-blur-xl", roleStyle.border, "bg-white/[0.03]")}
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 12px 40px -16px rgba(0,0,0,0.45)" }}
      >
        <div className="flex items-start gap-3">
          {role.icon ? (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl">
              {role.icon}
            </span>
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-pink-300/80">
              <BookOpen className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className={cn("text-xl font-bold tracking-tight", roleStyle.text)}>{role.name}</h2>
            {role.description.trim() ? (
              <div className="mt-2">
                <Markdown emptyFallback="">{role.description}</Markdown>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <h3 className="text-lg font-bold tracking-tight text-white">Functions</h3>
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-10 text-center text-sm text-white/45">
            No functions published for this role yet.
          </div>
        ) : (
          <motion.div className="grid grid-cols-1 gap-4" variants={stagger} initial="hidden" animate="show">
            {sorted.map((fn) => (
              <FunctionCard key={fn.id} fn={fn} department={departmentById.get(fn.department_id)} />
            ))}
          </motion.div>
        )}
      </section>
    </motion.div>
  );
}

export function SopViewerClient({
  roleBundles,
  departments,
}: {
  roleBundles: SopRoleBundle[];
  departments: SopDepartment[];
}) {
  const departmentById = React.useMemo(
    () => new Map(departments.map((d) => [d.id, d])),
    [departments]
  );

  const [activeRoleId, setActiveRoleId] = React.useState(() => roleBundles[0]?.role.id ?? "");

  React.useEffect(() => {
    if (!roleBundles.some((b) => b.role.id === activeRoleId)) {
      setActiveRoleId(roleBundles[0]?.role.id ?? "");
    }
  }, [roleBundles, activeRoleId]);

  const activeBundle = roleBundles.find((b) => b.role.id === activeRoleId) ?? roleBundles[0];
  const showTabs = roleBundles.length > 1;

  return (
    <motion.div
      className="mx-auto max-w-4xl space-y-8 px-4 py-8 md:px-6"
      initial="hidden"
      animate="show"
      variants={stagger}
    >
      <motion.div variants={sectionReveal}>
        <h1 className="text-2xl font-semibold tracking-tight text-white">SOPs / Training</h1>
        <p className="mt-1 text-sm text-white/55">
          Role-based standards, KPIs, and walkthroughs for your position.
        </p>
      </motion.div>

      {roleBundles.length === 0 ? (
        <motion.div
          variants={sectionReveal}
          className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-12 text-center backdrop-blur-xl"
        >
          <BookOpen className="mx-auto h-8 w-8 text-white/25" />
          <p className="mt-3 text-sm font-medium text-white/70">No SOP library assigned yet</p>
          <p className="mt-1 text-sm text-white/45">
            Your account is not linked to any active training role. Ask an admin if you think this is a mistake.
          </p>
        </motion.div>
      ) : (
        <>
          {showTabs ? (
            <motion.div variants={sectionReveal}>
              <RoleTabs
                roles={roleBundles.map((b) => b.role)}
                activeId={activeRoleId}
                onChange={setActiveRoleId}
              />
            </motion.div>
          ) : null}
          {activeBundle ? (
            <RoleContent key={activeBundle.role.id} bundle={activeBundle} departmentById={departmentById} />
          ) : null}
        </>
      )}
    </motion.div>
  );
}
