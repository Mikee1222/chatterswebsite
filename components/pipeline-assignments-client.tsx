"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { setPipelineAssignment, setCentralPipelineRole } from "@/app/actions/pipeline-assignments";
import type { CreatorAssignedRole } from "@/services/creator-assignments";

export type AssignmentCreator = { model_id: string; model_name: string };
export type AssignmentUser = { user_id: string; full_name: string };

type Props = {
  creators: AssignmentCreator[];
  roles: string[];
  usersByRole: Record<string, AssignmentUser[]>;
  /** `${role}__${creator_model_id}` → user_id */
  initialAssignments: Record<string, string>;
  /** Central roles (one person for ALL creators). */
  centralRoles: string[];
  /** All active staff — eligible for any central role regardless of their primary role. */
  allUsers: AssignmentUser[];
  /** central role → user_id */
  initialCentral: Record<string, string>;
};

const ROLE_LABELS: Record<string, string> = {
  researcher: "Researcher",
  creative: "Creative",
  filmer: "Filmer",
  editor: "Editor",
  "marketing-executive": "Marketing Exec",
  "icloud-manager": "iCloud Manager",
  "head-of-marketing": "Head of Marketing",
  supervisor: "Supervisor",
};

const CENTRAL_ROLE_HINTS: Record<string, string> = {
  "icloud-manager": "Μετακινεί RAW→editing & edited→post (στάδια iCloud). Ένα άτομο για όλους.",
  "head-of-marketing": "QA gates (Creative/Filming/Editing) + διαχείριση.",
  supervisor: "Εποπτεία / QA.",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function PipelineAssignmentsClient({
  creators,
  roles,
  usersByRole,
  initialAssignments,
  centralRoles,
  allUsers,
  initialCentral,
}: Props) {
  const [assignments, setAssignments] = React.useState<Record<string, string>>(initialAssignments);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [central, setCentral] = React.useState<Record<string, string>>(initialCentral);
  const [savingCentral, setSavingCentral] = React.useState<string | null>(null);

  async function handleCentralChange(role: string, userId: string) {
    const prev = central[role] ?? "";
    setCentral((c) => ({ ...c, [role]: userId }));
    setSavingCentral(role);
    const res = await setCentralPipelineRole({ role, user_id: userId });
    setSavingCentral(null);
    if (!res.success) {
      setCentral((c) => ({ ...c, [role]: prev })); // rollback
      toast.error(res.error ?? "Δεν αποθηκεύτηκε");
      return;
    }
    const u = allUsers.find((x) => x.user_id === userId);
    toast.success(userId ? `${roleLabel(role)} → ${u?.full_name}` : `Καθαρίστηκε ${roleLabel(role)}`);
  }

  async function handleChange(
    creator: AssignmentCreator,
    role: string,
    userId: string
  ) {
    const key = `${role}__${creator.model_id}`;
    const prev = assignments[key] ?? "";
    const user = usersByRole[role]?.find((u) => u.user_id === userId);
    setAssignments((a) => ({ ...a, [key]: userId }));
    setSavingKey(key);
    const res = await setPipelineAssignment({
      creator_model_id: creator.model_id,
      creator_name: creator.model_name,
      role: role as CreatorAssignedRole,
      user_id: userId,
      user_name: user?.full_name ?? "",
    });
    setSavingKey(null);
    if (!res.success) {
      setAssignments((a) => ({ ...a, [key]: prev })); // rollback
      toast.error(res.error ?? "Δεν αποθηκεύτηκε");
      return;
    }
    toast.success(
      userId
        ? `${roleLabel(role)} → ${user?.full_name} για ${creator.model_name}`
        : `Καθαρίστηκε ${roleLabel(role)} για ${creator.model_name}`
    );
  }

  const totalGaps = creators.reduce(
    (n, c) => n + roles.filter((r) => !assignments[`${r}__${c.model_id}`]).length,
    0
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-white">
          Pipeline Assignments
        </h1>
        <p className="mt-1 text-sm text-white/55">
          Ποιος αναλαμβάνει κάθε creator ανά στάδιο. Κενά κελιά = το item θα «κρατιέται» εκεί.
        </p>
        {totalGaps > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            {totalGaps} κενά assignments
          </div>
        )}
      </div>

      {/* Central roles — one person for ALL creators */}
      <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-pink-300/80">Central roles</h2>
        <p className="mt-1 text-xs text-white/45">Ένα άτομο για όλους τους creators. Μπορεί να το κρατά όποιος, ανεξάρτητα από τον βασικό του ρόλο (π.χ. Εύη = VA + iCloud).</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {centralRoles.map((role) => {
            const value = central[role] ?? "";
            return (
              <div key={role}>
                <label className="mb-1 block text-xs font-medium text-white/70">{roleLabel(role)}</label>
                <select
                  value={value}
                  disabled={savingCentral === role}
                  onChange={(e) => handleCentralChange(role, e.target.value)}
                  className={`h-9 w-full rounded-xl border bg-white/5 px-2.5 text-sm text-white outline-none transition focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 disabled:opacity-50 ${value ? "border-white/10" : "border-amber-400/30"}`}
                >
                  <option value="" className="bg-[#1a1a1a]">— unassigned —</option>
                  {allUsers.map((u) => (
                    <option key={u.user_id} value={u.user_id} className="bg-[#1a1a1a]">{u.full_name}</option>
                  ))}
                </select>
                {CENTRAL_ROLE_HINTS[role] && <p className="mt-1 text-[11px] text-white/35">{CENTRAL_ROLE_HINTS[role]}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/50">Per-creator roles</h2>
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="sticky left-0 z-10 bg-[#0d0d10] px-4 py-3 text-left font-medium text-white/70">
                Creator
              </th>
              {roles.map((r) => (
                <th key={r} className="px-3 py-3 text-left font-medium text-white/70 whitespace-nowrap">
                  {roleLabel(r)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {creators.length === 0 && (
              <tr>
                <td colSpan={roles.length + 1} className="px-4 py-8 text-center text-white/45">
                  Δεν βρέθηκαν ενεργοί creators (gunzo_team).
                </td>
              </tr>
            )}
            {creators.map((c) => (
              <tr key={c.model_id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                <td className="sticky left-0 z-10 bg-[#0d0d10] px-4 py-2.5 font-medium text-white/90 whitespace-nowrap">
                  {c.model_name}
                </td>
                {roles.map((role) => {
                  const key = `${role}__${c.model_id}`;
                  const value = assignments[key] ?? "";
                  const options = usersByRole[role] ?? [];
                  const isGap = !value;
                  return (
                    <td key={role} className="px-3 py-2">
                      <div className="relative">
                        <select
                          value={value}
                          disabled={savingKey === key}
                          onChange={(e) => handleChange(c, role, e.target.value)}
                          className={`h-9 w-full min-w-[150px] rounded-xl border bg-white/5 px-2.5 text-sm text-white outline-none transition focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 disabled:opacity-50 ${
                            isGap ? "border-amber-400/30" : "border-white/10"
                          }`}
                        >
                          <option value="" className="bg-[#1a1a1a]">
                            — unassigned —
                          </option>
                          {options.map((u) => (
                            <option key={u.user_id} value={u.user_id} className="bg-[#1a1a1a]">
                              {u.full_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {options.length === 0 && (
                        <p className="mt-1 text-[11px] text-white/35">κανένας {roleLabel(role)}</p>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
