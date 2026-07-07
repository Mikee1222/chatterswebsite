"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { startTaskShift, endTaskShift } from "@/app/actions/shifts";
import { formatDateTimeEuropean } from "@/lib/format";
import { ButtonSecondary, selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { FileText, ListTodo, Type } from "lucide-react";
import type { Shift } from "@/types";
import type { StaffTaskType } from "@/types";

export function TaskShiftsPanel({
  userRole,
  shifts,
  myShift,
  taskTypes,
}: {
  userRole: string;
  shifts: Shift[];
  myShift: Shift | null;
  taskTypes: StaffTaskType[];
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [shiftType, setShiftType] = useState("");
  const [taskLabel, setTaskLabel] = useState("");
  const [notes, setNotes] = useState("");

  const canControl = userRole === "virtual_assistant" || userRole === "admin";
  const typeOptions = taskTypes.length
    ? taskTypes.map((t) => ({ value: t.task_key || t.task_label, label: t.task_label }))
    : [
        { value: "mistakes", label: "Mistakes" },
        { value: "vault_cleaning", label: "Vault cleaning" },
        { value: "other", label: "Other" },
      ];

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    const validTypeValues = typeOptions.map((o) => o.value).filter(Boolean);
    if (!validTypeValues.length || !validTypeValues.includes(shiftType)) {
      alert("Please select a valid shift type from the list.");
      return;
    }
    const formData = new FormData();
    formData.set("shift_type", shiftType);
    formData.set("task_label", shiftType === "other" ? taskLabel : "");
    formData.set("notes", notes);
    const res = await startTaskShift(formData);
    if (res.error) alert(res.error);
    else {
      setShowModal(false);
      setShiftType("");
      setTaskLabel("");
      setNotes("");
      router.refresh();
    }
  }

  async function handleEnd() {
    const res = await endTaskShift();
    if (res.error) alert(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      {canControl && (
        <div className="glass-card flex items-center gap-4 p-4">
          {!myShift ? (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="rounded-xl bg-[hsl(330,80%,55%)] px-6 py-2.5 font-medium text-white hover:bg-[hsl(330,80%,50%)]"
            >
              Start task shift
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnd}
              className="rounded-xl border border-white/20 bg-white/10 px-6 py-2.5 font-medium text-white hover:bg-white/15"
            >
              End task shift
            </button>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Start task shift</h2>
            <form onSubmit={handleStart} className="space-y-4">
              <FormField label="Shift type" icon={<ListTodo />} htmlFor="task-shift-type" required>
                <FormSelect
                  id="task-shift-type"
                  value={shiftType}
                  onChange={(e) => setShiftType(e.target.value)}
                  required
                >
                  <option value="" disabled className={selectOptionClass}>
                    Select…
                  </option>
                  {typeOptions.map((o) => (
                    <option key={o.value} value={o.value} className={selectOptionClass}>
                      {o.label}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              {shiftType === "other" && (
                <FormField label="Task label" icon={<Type />} htmlFor="task-label" required description="Required when type is Other.">
                  <FormInput
                    id="task-label"
                    type="text"
                    value={taskLabel}
                    onChange={(e) => setTaskLabel(e.target.value)}
                    required={shiftType === "other"}
                    placeholder="Describe the task"
                  />
                </FormField>
              )}
              <FormField label="Notes (optional)" icon={<FileText />} htmlFor="task-notes">
                <FormTextarea
                  id="task-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes"
                />
              </FormField>
              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <ButtonSecondary type="button" onClick={() => setShowModal(false)} className="w-full sm:w-auto">
                  Cancel
                </ButtonSecondary>
                <FormSubmitButton className="w-full sm:min-w-[10rem] sm:flex-1">Start shift</FormSubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <h2 className="border-b border-white/10 p-4 text-lg font-semibold text-white">Active task shifts</h2>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-white/60">
              <th className="p-3 font-medium">Staff</th>
              <th className="p-3 font-medium">Type</th>
              <th className="p-3 font-medium">Task label</th>
              <th className="p-3 font-medium">Start</th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-white/50">
                  No active task shifts
                </td>
              </tr>
            ) : (
              shifts.map((s) => (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 text-white/90">{s.chatter_name}</td>
                  <td className="p-3 text-white/70">{s.shift_type}</td>
                  <td className="p-3 text-white/70">{s.task_label || "—"}</td>
                  <td className="p-3 text-white/70">{s.start_time ? formatDateTimeEuropean(s.start_time) : "—"}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-[hsl(330,80%,55%)]/20 px-2 py-0.5 text-xs text-[hsl(330,90%,65%)]">
                      active
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
