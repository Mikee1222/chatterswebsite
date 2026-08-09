"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  Headphones,
  Hash,
  KeyRound,
  Languages,
  Link2,
  Mail,
  Send,
  StickyNote,
  Trash2,
  User,
  UserCog,
  Users,
} from "lucide-react";
import { updateAccount, deleteUserAction } from "@/app/actions/accounts";
import { ROUTES } from "@/lib/routes";
import type { RoleRecord, SopColor, UserRecord, VaType } from "@/types";
import { Checkbox, btnSecondaryClass, formSpace, selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { SopFormSection } from "@/components/sop/sop-form-section";
import { SopSegmentedToggle } from "@/components/sop/sop-segmented-toggle";
import { SOP_COLOR_STYLES } from "@/components/sop/sop-colors";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AccountCompensationSection } from "@/components/account-compensation-section";
import { AccountReviewHistorySection } from "@/components/account-review-history-section";
import type { VaReviewHistorySummary } from "@/services/marketing-reviews";
import { StatInfoTooltip } from "@/components/infloww-performance-ui";
import { cn } from "@/lib/utils";

const INFLOWW_EMPLOYEE_TOOLTIP =
  "Numeric employee ID from Infloww — links this user's sales and chat performance sync. Find it in Infloww under employee settings.";

const STATUSES = ["active", "inactive", "suspended"] as const;
const VA_TYPES: VaType[] = ["chatting", "marketing", "both"];

function RoleColorDot({ color }: { color: string }) {
  const key = (color in SOP_COLOR_STYLES ? color : "gray") as SopColor;
  return <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", SOP_COLOR_STYLES[key].dot)} />;
}

function EditAccountSubmit() {
  const { pending } = useFormStatus();
  return (
    <FormSubmitButton className="w-full sm:w-auto sm:min-w-[180px]" loading={pending} disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </FormSubmitButton>
  );
}

type Props = {
  user: UserRecord;
  roles: RoleRecord[];
  modelOptions?: { id: string; model_name: string; alreadyLinked?: boolean }[];
  canDelete?: boolean;
  reviewHistory?: VaReviewHistorySummary | null;
};

export function EditAccountForm({ user, roles, modelOptions = [], canDelete = false, reviewHistory = null }: Props) {
  const roleIds = React.useMemo(() => new Set(roles.map((r) => r.role_id)), [roles]);
  const initialRole = roleIds.has(user.role) ? user.role : roles[0]?.role_id ?? user.role;
  const [role, setRole] = React.useState(initialRole);
  const [secondaryRole, setSecondaryRole] = React.useState(
    user.secondary_role === "chatter" || user.secondary_role === "virtual_assistant"
      ? user.secondary_role
      : ""
  );
  const [vaType, setVaType] = React.useState<VaType | "">(
    user.va_type === "chatting" || user.va_type === "marketing" || user.va_type === "both"
      ? user.va_type
      : ""
  );
  const [linkedModelId, setLinkedModelId] = React.useState(user.linked_model_id ?? "");
  const [languagePreference, setLanguagePreference] = React.useState(user.language_preference ?? "en");
  const [accountStatus, setAccountStatus] = React.useState(user.status || "active");
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const selectedRole = roles.find((r) => r.role_id === role);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteUserAction(user.id);
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  return (
    <>
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete user"
        description={`This will permanently delete "${user.full_name || user.email}" and remove all their data. This cannot be undone.`}
        confirmLabel="Delete permanently"
        confirmVariant="danger"
        loading={deleting}
        requireNameConfirmation
        nameToConfirm={user.full_name?.trim() || user.email?.trim() || "User"}
      />

      <form action={updateAccount} encType="multipart/form-data" className={`${formSpace} mx-auto max-w-2xl space-y-5`}>
        <input type="hidden" name="recordId" value={user.id} />

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-pink-500/[0.03] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            {selectedRole ? <RoleColorDot color={selectedRole.color || "gray"} /> : null}
            <span className="text-sm font-semibold text-white/90">{user.full_name}</span>
            <span className="text-xs text-white/45">{user.email}</span>
          </div>
        </div>

        <SopFormSection title="Basic info" description="Name and email">
          <FormField label="Full name" icon={<User />} htmlFor="full_name" required>
            <FormInput id="full_name" name="full_name" type="text" required defaultValue={user.full_name} />
          </FormField>
          <FormField label="Email" icon={<Mail />} htmlFor="email" required>
            <FormInput id="email" name="email" type="email" required defaultValue={user.email} />
          </FormField>
        </SopFormSection>

        <SopFormSection title="Role & access" description="Primary role, secondary role, and login">
          <FormField
            label="Role"
            icon={role === "virtual_assistant" ? <Headphones /> : role === "chatter" ? <Users /> : <UserCog />}
            htmlFor="role"
            required
          >
            <div className="relative">
              {selectedRole ? (
                <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2">
                  <RoleColorDot color={selectedRole.color || "gray"} />
                </span>
              ) : null}
              <FormSelect
                id="role"
                name="role"
                value={role}
                onChange={(e) => {
                  const r = e.target.value;
                  setRole(r);
                  if (r !== "chatter" && r !== "virtual_assistant") {
                    setSecondaryRole("");
                    setVaType("");
                  }
                }}
                required
                className={selectedRole ? "pl-8" : undefined}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.role_id} className={selectOptionClass}>
                    {r.label || r.role_id.replace(/_/g, " ")}
                  </option>
                ))}
              </FormSelect>
            </div>
          </FormField>

          {(role === "chatter" || role === "virtual_assistant") && (
            <FormField
              label="Secondary role"
              icon={<UserCog />}
              htmlFor="secondary_role"
              description="Optional second hat (chatter ↔ VA). User switches in Settings."
            >
              <FormSelect
                id="secondary_role"
                name="secondary_role"
                value={secondaryRole}
                onChange={(e) => {
                  setSecondaryRole(e.target.value);
                  if (e.target.value !== "virtual_assistant" && role !== "virtual_assistant") {
                    setVaType("");
                  }
                }}
              >
                <option value="" className={selectOptionClass}>
                  No secondary role
                </option>
                <option value="virtual_assistant" className={selectOptionClass}>
                  Virtual Assistant
                </option>
                <option value="chatter" className={selectOptionClass}>
                  Chatter
                </option>
              </FormSelect>
            </FormField>
          )}

          {(role === "virtual_assistant" || secondaryRole === "virtual_assistant") && (
            <FormField
              label="VA type"
              icon={<UserCog />}
              htmlFor="va_type"
              description="Specialization for virtual assistant accounts."
            >
              <FormSelect
                id="va_type"
                name="va_type"
                value={vaType}
                onChange={(e) => setVaType(e.target.value as VaType | "")}
              >
                <option value="" className={selectOptionClass}>
                  — Select VA type —
                </option>
                {VA_TYPES.map((t) => (
                  <option key={t} value={t} className={selectOptionClass}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          )}

          <FormField label="Status" icon={<UserCog />} htmlFor="status" required>
            <input type="hidden" name="status" value={accountStatus} />
            <SopSegmentedToggle
              name="Account status"
              value={accountStatus}
              onChange={setAccountStatus}
              className="grid-cols-3"
              options={STATUSES.map((s) => ({
                value: s,
                label: s.charAt(0).toUpperCase() + s.slice(1),
              }))}
            />
          </FormField>

          <FormField
            label="Can log in"
            icon={<KeyRound />}
            htmlFor="can_login"
            description="Allow this user to sign in to the dashboard."
          >
            <div className="flex justify-end pt-0.5">
              <Checkbox id="can_login" name="can_login" defaultChecked={user.can_login} />
            </div>
          </FormField>
        </SopFormSection>

        <AccountCompensationSection
          defaultCompensationType={user.compensation_type ?? ""}
          defaultCompensationValue={user.compensation_value ?? null}
          defaultCollaborationStartDate={user.collaboration_start_date ?? ""}
          defaultCollaborationEndDate={user.collaboration_end_date ?? ""}
          existingAttachments={user.contract_attachments ?? []}
          defaultOpen={
            Boolean(
              user.compensation_type ||
                user.compensation_value != null ||
                user.collaboration_start_date ||
                user.collaboration_end_date ||
                (user.contract_attachments?.length ?? 0) > 0
            )
          }
        />

        <SopFormSection
          title="Profile"
          description="Role-specific profile fields"
          defaultOpen={role === "model" || role === "chatter" || role === "virtual_assistant"}
        >
          {(role === "chatter" || role === "virtual_assistant") && (
            <FormField
              label="Telegram username"
              icon={<Send />}
              htmlFor="telegram_username"
              description="Without @ — used for Message links on live shifts."
            >
              <FormInput
                id="telegram_username"
                name="telegram_username"
                type="text"
                defaultValue={user.telegram_username ?? ""}
                placeholder="username"
                autoComplete="off"
              />
            </FormField>
          )}
          {(role === "chatter" ||
            role === "virtual_assistant" ||
            role === "admin" ||
            role === "manager") && (
            <FormField
              label={
                <span className="inline-flex items-center gap-1.5">
                  Infloww employee ID
                  <StatInfoTooltip text={INFLOWW_EMPLOYEE_TOOLTIP} />
                </span>
              }
              icon={<Hash />}
              htmlFor="infloww_employee_id"
              description="Numeric employee ID from Infloww — links sales & chat performance sync."
            >
              <FormInput
                id="infloww_employee_id"
                name="infloww_employee_id"
                type="text"
                inputMode="numeric"
                defaultValue={
                  user.infloww_employee_id != null && user.infloww_employee_id > 0
                    ? String(user.infloww_employee_id)
                    : ""
                }
                placeholder="e.g. 1234567890"
                autoComplete="off"
              />
            </FormField>
          )}
          {role === "model" && (
            <>
              <FormField
                label="Link to model profile"
                icon={<Link2 />}
                htmlFor="linked_model_id"
                description="Links this login account to a model profile so they can access their dashboard."
              >
                <FormSelect
                  id="linked_model_id"
                  name="linked_model_id"
                  value={linkedModelId}
                  onChange={(e) => setLinkedModelId(e.target.value)}
                >
                  <option value="" className={selectOptionClass}>
                    — No model profile linked —
                  </option>
                  {modelOptions.map((m) => (
                    <option
                      key={m.id}
                      value={m.id}
                      disabled={Boolean(m.alreadyLinked && m.id !== linkedModelId)}
                      className={selectOptionClass}
                    >
                      {m.model_name}
                      {m.alreadyLinked && m.id !== linkedModelId ? " (already linked)" : ""}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField label="Language" icon={<Languages />} htmlFor="language_preference">
                <FormSelect
                  id="language_preference"
                  name="language_preference"
                  value={languagePreference}
                  onChange={(e) => setLanguagePreference(e.target.value)}
                >
                  <option value="en" className={selectOptionClass}>
                    English
                  </option>
                  <option value="es" className={selectOptionClass}>
                    Spanish
                  </option>
                </FormSelect>
              </FormField>
            </>
          )}
        </SopFormSection>

        {reviewHistory &&
        (role === "virtual_assistant" || secondaryRole === "virtual_assistant") &&
        (vaType === "marketing" || vaType === "both" || user.va_type === "marketing" || user.va_type === "both") ? (
          <AccountReviewHistorySection history={reviewHistory} />
        ) : null}

        <SopFormSection title="Notes" description="Internal notes visible to admins only" defaultOpen={Boolean(user.notes)}>
          <FormField label="Notes" icon={<StickyNote />} htmlFor="notes">
            <FormTextarea id="notes" name="notes" rows={3} defaultValue={user.notes} placeholder="Optional" />
          </FormField>
        </SopFormSection>

        {canDelete && (
          <section className="rounded-2xl border border-red-500/25 bg-red-500/[0.04] p-5">
            <h3 className="text-sm font-semibold text-red-200">Danger zone</h3>
            <p className="mt-1 text-xs text-white/45">
              Permanently delete this user and all associated data. This cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={deleting}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete user
            </button>
          </section>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={ROUTES.admin.accounts}
            className={`${btnSecondaryClass} flex min-h-[52px] w-full items-center justify-center sm:w-auto sm:px-8`}
          >
            Cancel
          </Link>
          <EditAccountSubmit />
        </div>
      </form>
    </>
  );
}
