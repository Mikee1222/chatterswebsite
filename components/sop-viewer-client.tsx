"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Target } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { FilePreview } from "@/components/ui/file-preview";
import { LoomEmbed } from "@/components/ui/loom-embed";
import { SopShell } from "@/components/sop/sop-shell";
import { SopEmptyState } from "@/components/sop/sop-empty-state";
import { SopGlowBadge } from "@/components/sop/sop-glow-badge";
import { CADENCE_STYLES, SOP_COLOR_STYLES } from "@/components/sop/sop-colors";
import { useSopMotion } from "@/components/sop/sop-motion";
import { cn } from "@/lib/utils";
import type { SopDepartment, SopFunction, SopRole, SopColor, CadenceType } from "@/types";

const CADENCE_LABELS: Record<CadenceType, string> = {
  daily: "Daily",
  per_shift: "Per shift",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  ad_hoc: "Ad hoc",
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
  const motionCfg = useSopMotion();

  return (
    <div className="flex flex-wrap gap-2.5">
      {roles.map((role) => {
        const active = activeId === role.id;
        const cfg = SOP_COLOR_STYLES[role.color];
        return (
          <motion.button
            key={role.id}
            type="button"
            layout
            whileHover={motionCfg.hoverScale}
            whileTap={active ? undefined : { scale: 0.97 }}
            onClick={() => onChange(role.id)}
            className={cn(
              "relative rounded-full border px-4 py-2 text-xs font-semibold transition-colors duration-300",
              active
                ? cn(cfg.badge, cfg.glow, "border-opacity-40")
                : "border-white/10 bg-white/[0.04] text-white/50 hover:border-white/18 hover:bg-white/[0.07] hover:text-white/85"
            )}
          >
            {active ? (
              <motion.span
                layoutId="sop-role-pill-glow"
                className="pointer-events-none absolute inset-0 rounded-full opacity-60"
                style={{
                  boxShadow: "0 0 24px -4px hsl(330 80% 55% / 0.2)",
                }}
                transition={motionCfg.tabTransition}
              />
            ) : null}
            <span className="relative inline-flex items-center gap-1.5">
              {role.icon ? <span>{role.icon}</span> : null}
              {role.name}
            </span>
          </motion.button>
        );
      })}
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
  const motionCfg = useSopMotion();
  const deptStyle = department ? SOP_COLOR_STYLES[department.color] : SOP_COLOR_STYLES.gray;
  const cadenceStyle = CADENCE_STYLES[fn.cadence_type];

  return (
    <motion.article
      variants={motionCfg.item}
      whileHover={motionCfg.hoverLift}
      className="sop-glass-card group overflow-hidden rounded-2xl transition-[border-color,box-shadow] duration-300 hover:border-white/14 hover:shadow-[0_0_48px_-12px_hsl(330_80%_55%_/_0.12)]"
    >
      <div className="border-b border-white/[0.07] px-5 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h3 className="text-base font-semibold tracking-tight text-white">{fn.name}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {department ? (
              <SopGlowBadge className={deptStyle.badge} glowClassName={deptStyle.glow}>
                {department.name}
              </SopGlowBadge>
            ) : null}
            <SopGlowBadge className={cadenceStyle.badge} glowClassName={cadenceStyle.glow}>
              {CADENCE_LABELS[fn.cadence_type]}
              {fn.cadence_note.trim() ? ` · ${fn.cadence_note}` : ""}
            </SopGlowBadge>
          </div>
        </div>
        {fn.kpi.trim() ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-pink-300/70" />
            <p className="text-sm text-white/60">
              <span className="font-semibold text-white/75">KPI:</span> {fn.kpi}
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-5 px-5 py-5">
        <div>
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-white/40">Standard</p>
          {fn.standard_type === "file" ? (
            fn.sop_file_url.trim() ? (
              <FilePreview url={fn.sop_file_url} name={fn.sop_file_name} />
            ) : (
              <p className="text-sm text-white/45">No file uploaded yet.</p>
            )
          ) : (
            <Markdown emptyFallback="No SOP content yet.">{fn.sop_content}</Markdown>
          )}
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
  const motionCfg = useSopMotion();
  const { role, functions } = bundle;
  const roleStyle = SOP_COLOR_STYLES[role.color];
  const sorted = sortFunctions(functions);

  return (
    <motion.div
      key={role.id}
      variants={motionCfg.reveal}
      initial="hidden"
      animate="show"
      exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
      className="space-y-7"
    >
      <header
        className={cn(
          "sop-glass-panel rounded-2xl border p-6",
          roleStyle.border,
          roleStyle.glow
        )}
      >
        <div className="flex items-start gap-4">
          {role.icon ? (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              {role.icon}
            </span>
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-pink-300/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <BookOpen className="h-6 w-6" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className={cn("text-xl font-bold tracking-tight", roleStyle.text)}>{role.name}</h2>
            {role.description.trim() ? (
              <div className="mt-3">
                <Markdown emptyFallback="">{role.description}</Markdown>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <h3 className="text-lg font-bold tracking-tight text-white">Functions</h3>
        {sorted.length === 0 ? (
          <SopEmptyState
            icon={BookOpen}
            title="No functions published for this role yet."
            description="Check back later — your admin may still be building this library."
          />
        ) : (
          <motion.div
            className="grid grid-cols-1 gap-5"
            variants={motionCfg.stagger}
            initial="hidden"
            animate="show"
          >
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
  const motionCfg = useSopMotion();
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
    <SopShell>
      <motion.div
        className="mx-auto max-w-4xl space-y-8 px-4 py-8 md:px-6 md:py-10"
        initial="hidden"
        animate="show"
        variants={motionCfg.stagger}
      >
        <motion.div variants={motionCfg.reveal}>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-pink-400/55">Training</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">SOPs / Training</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
            Role-based standards, KPIs, and walkthroughs for your position.
          </p>
        </motion.div>

        {roleBundles.length === 0 ? (
          <SopEmptyState
            icon={BookOpen}
            title="No SOP library assigned yet"
            description="Your account is not linked to any active training role. Ask an admin if you think this is a mistake."
          />
        ) : (
          <>
            {showTabs ? (
              <motion.div variants={motionCfg.reveal}>
                <RoleTabs
                  roles={roleBundles.map((b) => b.role)}
                  activeId={activeRoleId}
                  onChange={setActiveRoleId}
                />
              </motion.div>
            ) : null}
            <AnimatePresence mode="wait">
              {activeBundle ? (
                <RoleContent
                  key={activeBundle.role.id}
                  bundle={activeBundle}
                  departmentById={departmentById}
                />
              ) : null}
            </AnimatePresence>
          </>
        )}
      </motion.div>
    </SopShell>
  );
}
