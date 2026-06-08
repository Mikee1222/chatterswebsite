"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  GraduationCap,
  Lock,
  Target,
} from "lucide-react";
import { SopRoleIcon } from "@/components/sop/sop-icons";
import { Markdown } from "@/components/ui/markdown";
import { FilePreview } from "@/components/ui/file-preview";
import { LoomEmbed } from "@/components/ui/loom-embed";
import { Spinner } from "@/components/ui/spinner";
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

type StepStatus = "completed" | "current" | "locked";

function getStepStatus(
  fnId: string,
  sorted: SopFunction[],
  completed: Set<string>
): StepStatus {
  if (completed.has(fnId)) return "completed";
  const firstIncompleteIdx = sorted.findIndex((f) => !completed.has(f.id));
  if (firstIncompleteIdx < 0) return "completed";
  const idx = sorted.findIndex((f) => f.id === fnId);
  if (idx === firstIncompleteIdx) return "current";
  return "locked";
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
              <SopRoleIcon name={role.icon} size="sm" className="opacity-70" />
              {role.name}
              {role.academy_mode ? (
                <GraduationCap className="h-3 w-3 opacity-60" aria-hidden />
              ) : null}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

function FunctionStandardBody({
  fn,
  department,
}: {
  fn: SopFunction;
  department: SopDepartment | undefined;
}) {
  const deptStyle = department ? SOP_COLOR_STYLES[department.color] : SOP_COLOR_STYLES.gray;
  const cadenceStyle = CADENCE_STYLES[fn.cadence_type];

  return (
    <>
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
          <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-white/[0.03] px-1 py-1">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-pink-300/60" />
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
    </>
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

  return (
    <motion.article
      variants={motionCfg.item}
      whileHover={motionCfg.hoverLift}
      className="sop-glass-card group overflow-hidden rounded-2xl transition-[border-color,box-shadow] duration-300 hover:border-white/14 hover:shadow-[0_0_48px_-12px_hsl(330_80%_55%_/_0.12)]"
    >
      <FunctionStandardBody fn={fn} department={department} />
    </motion.article>
  );
}

function AcademyStepper({
  sorted,
  completed,
  activeId,
  onSelect,
  roleColor,
}: {
  sorted: SopFunction[];
  completed: Set<string>;
  activeId: string;
  onSelect: (id: string) => void;
  roleColor: SopColor;
}) {
  const motionCfg = useSopMotion();
  const cfg = SOP_COLOR_STYLES[roleColor];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sorted.map((fn, i) => {
        const status = getStepStatus(fn.id, sorted, completed);
        const active = fn.id === activeId;
        const clickable = status === "completed" || status === "current";

        return (
          <React.Fragment key={fn.id}>
            {i > 0 ? (
              <span
                className={cn(
                  "hidden h-px w-4 sm:block",
                  status === "locked" ? "bg-white/10" : "bg-pink-500/35"
                )}
              />
            ) : null}
            <motion.button
              type="button"
              disabled={!clickable}
              whileHover={clickable ? motionCfg.hoverScale : undefined}
              whileTap={clickable ? { scale: 0.97 } : undefined}
              onClick={() => clickable && onSelect(fn.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                status === "completed" &&
                  (active
                    ? cn(cfg.badge, cfg.glow, "border-opacity-40")
                    : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200/90"),
                status === "current" && cn(cfg.badge, cfg.glow, "border-opacity-50"),
                status === "locked" &&
                  "cursor-not-allowed border-white/8 bg-white/[0.02] text-white/30",
                !clickable && "pointer-events-none"
              )}
              title={fn.name}
            >
              {status === "completed" ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : status === "current" ? (
                <Circle className="h-3.5 w-3.5 shrink-0 fill-current opacity-60" />
              ) : (
                <Lock className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="max-w-[8rem] truncate">{fn.name}</span>
            </motion.button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function AcademyRoleContent({
  bundle,
  departmentById,
  completedIds,
  onProgressUpdate,
}: {
  bundle: SopRoleBundle;
  departmentById: Map<string, SopDepartment>;
  completedIds: Set<string>;
  onProgressUpdate: (ids: Set<string>) => void;
}) {
  const motionCfg = useSopMotion();
  const { role, functions } = bundle;
  const roleStyle = SOP_COLOR_STYLES[role.color];
  const sorted = sortFunctions(functions.filter((f) => f.is_active));
  const total = sorted.length;
  const completedCount = sorted.filter((f) => completedIds.has(f.id)).length;
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const allComplete = total > 0 && completedCount >= total;

  const firstIncomplete = sorted.find((f) => !completedIds.has(f.id));
  const defaultActiveId = firstIncomplete?.id ?? sorted[0]?.id ?? "";

  const [activeFnId, setActiveFnId] = React.useState(defaultActiveId);
  const [completing, setCompleting] = React.useState(false);
  const [completeError, setCompleteError] = React.useState("");

  React.useEffect(() => {
    setActiveFnId(defaultActiveId);
    setCompleteError("");
  }, [role.id, defaultActiveId]);

  const activeFn = sorted.find((f) => f.id === activeFnId) ?? sorted[0];
  const activeStatus = activeFn ? getStepStatus(activeFn.id, sorted, completedIds) : "locked";
  const canComplete = activeFn && activeStatus === "current" && !allComplete;

  async function handleComplete() {
    if (!activeFn || !canComplete) return;
    setCompleting(true);
    setCompleteError("");
    try {
      const res = await fetch("/api/sops/progress/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_id: role.id, function_id: activeFn.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not save progress");
      }
      const next = new Set(completedIds);
      next.add(activeFn.id);
      onProgressUpdate(next);
      const nextIncomplete = sorted.find((f) => !next.has(f.id));
      if (nextIncomplete) setActiveFnId(nextIncomplete.id);
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : "Could not save progress");
    } finally {
      setCompleting(false);
    }
  }

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
          <span className={cn("mt-0.5 shrink-0", roleStyle.text)}>
            <SopRoleIcon name={role.icon} size="lg" className="opacity-80" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={cn("text-xl font-bold tracking-tight", roleStyle.text)}>{role.name}</h2>
              <SopGlowBadge className="bg-pink-500/15 text-pink-200" glowClassName="shadow-[0_0_16px_-4px_rgba(236,72,153,0.35)]">
                Academy
              </SopGlowBadge>
            </div>
            {role.description.trim() ? (
              <div className="mt-3">
                <Markdown emptyFallback="">{role.description}</Markdown>
              </div>
            ) : null}
          </div>
        </div>

        {total > 0 ? (
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-white/55">
              <span>
                {completedCount} / {total} completed
              </span>
              <span>{percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-pink-500/80 to-fuchsia-400/80"
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              />
            </div>
          </div>
        ) : null}
      </header>

      {total === 0 ? (
        <SopEmptyState
          icon={BookOpen}
          title="No functions published for this role yet."
          description="Check back later — your admin may still be building this academy."
        />
      ) : allComplete ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="sop-glass-panel rounded-2xl border border-emerald-500/25 p-8 text-center"
        >
          <GraduationCap className="mx-auto mb-4 h-12 w-12 text-emerald-300/80" />
          <h3 className="text-xl font-bold text-white">Training complete</h3>
          <p className="mt-2 text-sm text-white/55">
            You have finished all {total} steps for {role.name}. Great work!
          </p>
          <div className="mt-6">
            <AcademyStepper
              sorted={sorted}
              completed={completedIds}
              activeId={activeFnId}
              onSelect={setActiveFnId}
              roleColor={role.color}
            />
          </div>
          {activeFn ? (
            <motion.article
              key={activeFn.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="sop-glass-card mt-6 overflow-hidden rounded-2xl text-left"
            >
              <FunctionStandardBody
                fn={activeFn}
                department={departmentById.get(activeFn.department_id)}
              />
            </motion.article>
          ) : null}
        </motion.div>
      ) : (
        <>
          <section className="sop-glass-panel rounded-2xl p-4 md:p-5">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-white/40">Your path</p>
            <AcademyStepper
              sorted={sorted}
              completed={completedIds}
              activeId={activeFnId}
              onSelect={setActiveFnId}
              roleColor={role.color}
            />
          </section>

          <AnimatePresence mode="wait">
            {activeFn ? (
              <motion.article
                key={activeFn.id}
                layout
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="sop-glass-card overflow-hidden rounded-2xl"
              >
                <FunctionStandardBody
                  fn={activeFn}
                  department={departmentById.get(activeFn.department_id)}
                />
                {canComplete ? (
                  <div className="border-t border-white/[0.07] px-5 py-5">
                    {completeError ? (
                      <p className="mb-3 text-sm text-rose-300/90">{completeError}</p>
                    ) : null}
                    <motion.button
                      type="button"
                      disabled={completing}
                      whileHover={completing ? undefined : motionCfg.hoverScale}
                      whileTap={completing ? undefined : { scale: 0.98 }}
                      onClick={() => void handleComplete()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-pink-500/35 bg-pink-500/20 px-5 py-3 text-sm font-semibold text-pink-100 shadow-[0_0_24px_-8px_rgba(236,72,153,0.45)] transition hover:bg-pink-500/30 disabled:opacity-60 sm:w-auto"
                    >
                      {completing ? (
                        <>
                          <Spinner className="h-4 w-4 border-white/40 border-t-white" />
                          Αποθήκευση…
                        </>
                      ) : (
                        "Ολοκληρώθηκε → Επόμενο"
                      )}
                    </motion.button>
                  </div>
                ) : null}
              </motion.article>
            ) : null}
          </AnimatePresence>
        </>
      )}
    </motion.div>
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
          <span className={cn("mt-0.5 shrink-0", roleStyle.text)}>
            <SopRoleIcon name={role.icon} size="lg" className="opacity-80" />
          </span>
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
  const [progressByRole, setProgressByRole] = React.useState<Record<string, Set<string>>>({});
  const [loadingProgress, setLoadingProgress] = React.useState(false);

  React.useEffect(() => {
    if (!roleBundles.some((b) => b.role.id === activeRoleId)) {
      setActiveRoleId(roleBundles[0]?.role.id ?? "");
    }
  }, [roleBundles, activeRoleId]);

  React.useEffect(() => {
    const academyRoles = roleBundles.filter((b) => b.role.academy_mode);
    if (academyRoles.length === 0) return;

    let cancelled = false;
    setLoadingProgress(true);

    Promise.all(
      academyRoles.map(async (b) => {
        const res = await fetch(`/api/sops/progress?role_id=${encodeURIComponent(b.role.id)}`);
        const data = (await res.json().catch(() => ({}))) as {
          completed_function_ids?: string[];
        };
        const ids = Array.isArray(data.completed_function_ids) ? data.completed_function_ids : [];
        return { roleId: b.role.id, ids };
      })
    )
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, Set<string>> = {};
        for (const r of results) map[r.roleId] = new Set(r.ids);
        setProgressByRole(map);
      })
      .catch(() => {
        if (!cancelled) setProgressByRole({});
      })
      .finally(() => {
        if (!cancelled) setLoadingProgress(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roleBundles]);

  const activeBundle = roleBundles.find((b) => b.role.id === activeRoleId) ?? roleBundles[0];
  const showTabs = roleBundles.length > 1;
  const activeIsAcademy = activeBundle?.role.academy_mode === true;

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
            {activeIsAcademy && loadingProgress ? (
              <div className="flex justify-center py-12">
                <Spinner className="h-8 w-8 border-white/20 border-t-pink-400" />
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {activeBundle ? (
                  activeBundle.role.academy_mode ? (
                    <AcademyRoleContent
                      key={activeBundle.role.id}
                      bundle={activeBundle}
                      departmentById={departmentById}
                      completedIds={progressByRole[activeBundle.role.id] ?? new Set()}
                      onProgressUpdate={(ids) =>
                        setProgressByRole((prev) => ({
                          ...prev,
                          [activeBundle.role.id]: ids,
                        }))
                      }
                    />
                  ) : (
                    <RoleContent
                      key={activeBundle.role.id}
                      bundle={activeBundle}
                      departmentById={departmentById}
                    />
                  )
                ) : null}
              </AnimatePresence>
            )}
          </>
        )}
      </motion.div>
    </SopShell>
  );
}
