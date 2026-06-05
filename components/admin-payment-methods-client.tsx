"use client";

import * as React from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { GlassModal } from "@/components/ui/glass-modal";
import { ButtonSecondary, Label } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { useToast } from "@/contexts/toast-context";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types";
import type { AdminClientRecord, PaymentMethodRecord, PaymentMethodType } from "@/types/client-portal";

type Props = {
  initialMethods: PaymentMethodRecord[];
  clients: AdminClientRecord[];
};

function localToast(id: string, title: string, body: string, priority: "normal" | "high"): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

type MethodFormState = {
  label: string;
  type: PaymentMethodType;
  details: string;
  scope: "global" | "client";
  clientId: string;
  is_available: boolean;
  network: string;
  wallet_address: string;
  beneficiary: string;
  iban: string;
  bic: string;
  open_url: string;
  fallback_url: string;
};

const badgeVariants = {
  default: "bg-white/10 text-white/80 border-white/15",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  slate: "bg-white/5 text-white/60 border-white/10",
} as const;

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: keyof typeof badgeVariants;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        badgeVariants[variant]
      )}
    >
      {children}
    </span>
  );
}

function typeBadgeVariant(type: string): keyof typeof badgeVariants {
  if (type === "Crypto") return "blue";
  if (type === "Bank") return "emerald";
  return "default";
}

function emptyForm(): MethodFormState {
  return {
    label: "",
    type: "Bank",
    details: "",
    scope: "global",
    clientId: "",
    is_available: true,
    network: "",
    wallet_address: "",
    beneficiary: "",
    iban: "",
    bic: "",
    open_url: "",
    fallback_url: "",
  };
}

function formFromMethod(method: PaymentMethodRecord): MethodFormState {
  return {
    label: method.label,
    type: method.type === "Crypto" ? "Crypto" : "Bank",
    details: method.details ?? "",
    scope: method.scope === "client" ? "client" : "global",
    clientId: method.client?.[0] ?? "",
    is_available: method.is_available,
    network: method.network ?? "",
    wallet_address: method.wallet_address ?? "",
    beneficiary: method.beneficiary ?? "",
    iban: method.iban ?? "",
    bic: method.bic ?? "",
    open_url: method.open_url ?? "",
    fallback_url: method.fallback_url ?? "",
  };
}

function buildPayload(form: MethodFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    label: form.label.trim(),
    type: form.type,
    details: form.details.trim(),
    scope: form.scope,
    is_available: form.is_available,
    open_url: form.open_url.trim(),
    fallback_url: form.fallback_url.trim(),
  };

  if (form.scope === "client" && form.clientId) {
    payload.client = [form.clientId];
  } else {
    payload.client = [];
  }

  if (form.type === "Crypto") {
    payload.network = form.network.trim();
    payload.wallet_address = form.wallet_address.trim();
    payload.beneficiary = "";
    payload.iban = "";
    payload.bic = "";
  } else {
    payload.beneficiary = form.beneficiary.trim();
    payload.iban = form.iban.trim();
    payload.bic = form.bic.trim();
    payload.network = "";
    payload.wallet_address = "";
  }

  return payload;
}

function validateForm(form: MethodFormState): string | null {
  if (!form.label.trim()) return "Label is required.";
  if (form.scope === "client" && !form.clientId) return "Select a client.";
  if (form.type === "Crypto" && !form.wallet_address.trim()) return "Wallet address is required.";
  if (form.type === "Bank" && !form.iban.trim()) return "IBAN is required.";
  return null;
}

function networkOrBank(method: PaymentMethodRecord): string {
  if (method.type === "Crypto") return method.network?.trim() || "—";
  return method.beneficiary?.trim() || "—";
}

function walletOrIban(method: PaymentMethodRecord): string {
  if (method.type === "Crypto") return method.wallet_address?.trim() || "—";
  return method.iban?.trim() || "—";
}

function truncateMiddle(value: string, max = 28): string {
  if (value.length <= max) return value;
  const half = Math.floor((max - 3) / 2);
  return `${value.slice(0, half)}…${value.slice(-half)}`;
}

function AvailableSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? "Available" : "Unavailable"}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={cn(
        "relative h-8 w-14 shrink-0 rounded-full border-2 transition-all duration-200",
        disabled && "cursor-not-allowed opacity-50",
        checked
          ? "border-pink-300/55 bg-gradient-to-r from-pink-500 to-fuchsia-600 shadow-[0_0_12px_-2px_hsl(330_80%_55%/0.55)]"
          : "border-white/22 bg-[#262626] hover:border-white/35"
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-md transition-transform duration-200",
          checked ? "translate-x-[26px]" : "translate-x-[3px]"
        )}
      />
    </button>
  );
}

function PaymentMethodModal({
  editing,
  form,
  setForm,
  clients,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  editing: PaymentMethodRecord | null;
  form: MethodFormState;
  setForm: React.Dispatch<React.SetStateAction<MethodFormState>>;
  clients: AdminClientRecord[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <GlassModal
      title={editing ? "Edit payment method" : "Add payment method"}
      subtitle="Bank or crypto option for client payments"
      onClose={onClose}
      className="md:max-w-lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="pm-label">Label</Label>
          <FormInput
            id="pm-label"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="e.g. USDT (TRC20)"
            required
          />
        </div>

        <div>
          <Label htmlFor="pm-type">Type</Label>
          <FormSelect
            id="pm-type"
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                type: e.target.value === "Crypto" ? "Crypto" : "Bank",
              }))
            }
          >
            <option value="Bank">Bank</option>
            <option value="Crypto">Crypto</option>
          </FormSelect>
        </div>

        <div>
          <Label htmlFor="pm-details">Details</Label>
          <textarea
            id="pm-details"
            value={form.details}
            onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
            rows={2}
            placeholder="Instructions shown to the client"
            className="w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-pink-500/50 focus:outline-none focus:ring-1 focus:ring-pink-500/20"
          />
        </div>

        {form.type === "Crypto" ? (
          <>
            <div>
              <Label htmlFor="pm-network">Network</Label>
              <FormInput
                id="pm-network"
                value={form.network}
                onChange={(e) => setForm((f) => ({ ...f, network: e.target.value }))}
                placeholder="e.g. TRC20, ERC20"
              />
            </div>
            <div>
              <Label htmlFor="pm-wallet">Wallet address</Label>
              <FormInput
                id="pm-wallet"
                value={form.wallet_address}
                onChange={(e) => setForm((f) => ({ ...f, wallet_address: e.target.value }))}
                placeholder="0x… or T…"
                className="font-mono text-sm"
                required
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <Label htmlFor="pm-beneficiary">Beneficiary</Label>
              <FormInput
                id="pm-beneficiary"
                value={form.beneficiary}
                onChange={(e) => setForm((f) => ({ ...f, beneficiary: e.target.value }))}
                placeholder="Account holder name"
              />
            </div>
            <div>
              <Label htmlFor="pm-iban">IBAN</Label>
              <FormInput
                id="pm-iban"
                value={form.iban}
                onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
                placeholder="GB…"
                className="font-mono text-sm"
                required
              />
            </div>
            <div>
              <Label htmlFor="pm-bic">BIC / SWIFT</Label>
              <FormInput
                id="pm-bic"
                value={form.bic}
                onChange={(e) => setForm((f) => ({ ...f, bic: e.target.value }))}
                placeholder="Optional"
                className="font-mono text-sm"
              />
            </div>
          </>
        )}

        <div>
          <Label htmlFor="pm-scope">Scope</Label>
          <FormSelect
            id="pm-scope"
            value={form.scope}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                scope: e.target.value === "client" ? "client" : "global",
              }))
            }
          >
            <option value="global">Global (all clients)</option>
            <option value="client">Client-specific</option>
          </FormSelect>
        </div>

        {form.scope === "client" ? (
          <div>
            <Label htmlFor="pm-client">Client</Label>
            <FormSelect
              id="pm-client"
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              required
            >
              <option value="">Select client…</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.display_name || client.company_name || client.email}
                </option>
              ))}
            </FormSelect>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pm-open-url">Open URL</Label>
            <FormInput
              id="pm-open-url"
              value={form.open_url}
              onChange={(e) => setForm((f) => ({ ...f, open_url: e.target.value }))}
              placeholder="Optional deep link"
            />
          </div>
          <div>
            <Label htmlFor="pm-fallback-url">Fallback URL</Label>
            <FormInput
              id="pm-fallback-url"
              value={form.fallback_url}
              onChange={(e) => setForm((f) => ({ ...f, fallback_url: e.target.value }))}
              placeholder="Optional"
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <input
            type="checkbox"
            checked={form.is_available}
            onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.checked }))}
            className="h-4 w-4 rounded border-white/20 bg-[#141414] text-pink-500 focus:ring-pink-500/30"
          />
          <span className="text-sm text-white">Available to clients</span>
        </label>

        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-3 pt-2">
          <ButtonSecondary type="button" onClick={onClose} disabled={saving}>
            Cancel
          </ButtonSecondary>
          <FormSubmitButton disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : editing ? (
              "Save changes"
            ) : (
              "Add method"
            )}
          </FormSubmitButton>
        </div>
      </form>
    </GlassModal>
  );
}

export function AdminPaymentMethodsClient({ initialMethods, clients }: Props) {
  const { addToast } = useToast();
  const [methods, setMethods] = React.useState(initialMethods);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PaymentMethodRecord | null>(null);
  const [form, setForm] = React.useState<MethodFormState>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<PaymentMethodRecord | null>(null);

  React.useEffect(() => {
    setMethods(initialMethods);
  }, [initialMethods]);

  const clientNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const client of clients) {
      map.set(client.id, client.display_name || client.company_name || client.email);
    }
    return map;
  }, [clients]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setError(null);
    setModalOpen(true);
  }

  function openEdit(method: PaymentMethodRecord) {
    setEditing(method);
    setForm(formFromMethod(method));
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    const payload = buildPayload(form);

    try {
      const url = editing
        ? `/api/admin/payment-methods/${editing.id}`
        : "/api/admin/payment-methods";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { paymentMethod?: PaymentMethodRecord; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to save payment method.");
        return;
      }
      if (!data.paymentMethod) {
        setError("Unexpected response from server.");
        return;
      }

      setMethods((prev) => {
        if (editing) {
          return prev.map((m) => (m.id === data.paymentMethod!.id ? data.paymentMethod! : m));
        }
        return [...prev, data.paymentMethod!].sort((a, b) => a.label.localeCompare(b.label));
      });
      addToast(
        localToast(
          `pm-save-${data.paymentMethod.id}`,
          editing ? "Payment method updated" : "Payment method added",
          data.paymentMethod.label,
          "normal"
        )
      );
      closeModal();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAvailable(method: PaymentMethodRecord) {
    setTogglingId(method.id);
    const next = !method.is_available;

    try {
      const res = await fetch(`/api/admin/payment-methods/${method.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_available: next }),
      });
      const data = (await res.json()) as { paymentMethod?: PaymentMethodRecord; error?: string };
      if (!res.ok || !data.paymentMethod) {
        addToast(
          localToast(
            `pm-toggle-error-${method.id}`,
            "Update failed",
            data.error ?? "Could not update availability.",
            "high"
          )
        );
        return;
      }
      setMethods((prev) => prev.map((m) => (m.id === method.id ? data.paymentMethod! : m)));
    } catch {
      addToast(
        localToast(`pm-toggle-network-${method.id}`, "Update failed", "Network error.", "high")
      );
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);

    try {
      const res = await fetch(`/api/admin/payment-methods/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(
          localToast(
            `pm-delete-error-${deleteTarget.id}`,
            "Delete failed",
            data.error ?? "Could not delete payment method.",
            "high"
          )
        );
        return;
      }
      setMethods((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      addToast(
        localToast(
          `pm-delete-${deleteTarget.id}`,
          "Payment method deleted",
          deleteTarget.label,
          "normal"
        )
      );
      setDeleteTarget(null);
    } catch {
      addToast(
        localToast(`pm-delete-network-${deleteTarget.id}`, "Delete failed", "Network error.", "high")
      );
    } finally {
      setDeletingId(null);
    }
  }

  function scopeLabel(method: PaymentMethodRecord): string {
    if (method.scope === "client") {
      const name = method.client?.[0] ? clientNameById.get(method.client[0]) : undefined;
      return name ? `Client: ${name}` : "Client-specific";
    }
    return "Global";
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">All methods</h2>
          <p className="mt-1 text-sm text-gray-400">{methods.length} payment method(s)</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-900/30 transition hover:from-pink-500 hover:to-pink-400"
        >
          <Plus className="h-4 w-4" />
          Add method
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-white/10 bg-white/5">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Network / Bank</th>
              <th className="px-4 py-3">Wallet / IBAN</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Available</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {methods.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                  No payment methods yet. Add one to get started.
                </td>
              </tr>
            ) : (
              methods.map((method) => (
                <tr key={method.id} className="hover:bg-white/[0.04]">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-white">{method.label}</div>
                    {method.details ? (
                      <div className="mt-0.5 max-w-xs truncate text-xs text-gray-500">
                        {method.details}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={typeBadgeVariant(method.type)}>{method.type || "—"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{networkOrBank(method)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-300">
                    {truncateMiddle(walletOrIban(method))}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={method.scope === "global" ? "slate" : "default"}>
                      {scopeLabel(method)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <AvailableSwitch
                      checked={method.is_available}
                      disabled={togglingId === method.id}
                      onChange={() => handleToggleAvailable(method)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(method)}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
                        aria-label={`Edit ${method.label}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(method)}
                        disabled={deletingId === method.id}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                        aria-label={`Delete ${method.label}`}
                      >
                        {deletingId === method.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <PaymentMethodModal
          editing={editing}
          form={form}
          setForm={setForm}
          clients={clients}
          saving={saving}
          error={error}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      ) : null}

      {deleteTarget ? (
        <GlassModal
          title="Delete payment method"
          subtitle={`Remove “${deleteTarget.label}”? This cannot be undone.`}
          onClose={() => {
            if (!deletingId) setDeleteTarget(null);
          }}
          className="md:max-w-md"
        >
          <div className="flex justify-end gap-3">
            <ButtonSecondary
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={!!deletingId}
            >
              Cancel
            </ButtonSecondary>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={!!deletingId}
              className="inline-flex items-center rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 disabled:opacity-50"
            >
              {deletingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </button>
          </div>
        </GlassModal>
      ) : null}
    </div>
  );
}
