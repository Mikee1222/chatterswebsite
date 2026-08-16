"use client";

import * as React from "react";
import { Copy, Eye, EyeOff, KeyRound, Loader2, Lock, Plus, X } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import {
  CREDENTIAL_FIELD_LABELS,
  CREDENTIAL_LIST_PLAINTEXT_FIELDS,
  MASKED_VALUE,
  type CredentialField,
  type CredentialFieldRef,
  toCustomFieldRef,
} from "@/lib/credentials-types";
import { categoryVisual } from "@/lib/credentials-ui-helpers";
import {
  buildAppleCredentialQuickAddDefaults,
  buildCredentialQuickAddDefaults,
  findAppleIdCredentialForPhone,
  findSocialAccountCredential,
} from "@/lib/marketing-credentials-match";
import { copyTextToClipboard } from "@/lib/winner-videos-copy";
import { VA_BTN_PRIMARY, VA_FILTER_INPUT, VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { MaskedCredentialEntry } from "@/services/credential-entries";
import type { AppNotification } from "@/types";

function credToast(title: string, body: string, priority: "normal" | "high"): AppNotification {
  return {
    id: `cred-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    notification_id: `cred-${Date.now()}`,
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

function fieldDisplayLabel(field: CredentialFieldRef): string {
  if (typeof field === "string" && field.startsWith("custom:")) {
    return field.slice("custom:".length);
  }
  return CREDENTIAL_FIELD_LABELS[field as CredentialField] ?? field;
}

type BaseProps = {
  entries: MaskedCredentialEntry[];
  canView: boolean;
  canManage: boolean;
  modelUuidByPublicId: Record<string, string>;
  onEntryCreated?: (entry: MaskedCredentialEntry) => void;
  compact?: boolean;
};

type SocialProps = BaseProps & {
  variant: "social";
  modelId: string;
  platform: string;
  username: string;
};

type AppleProps = BaseProps & {
  variant: "apple";
  icloudEmail: string;
  linkedModelIds?: string[];
  modelId?: string;
};

export type MarketingCredentialIndicatorProps = SocialProps | AppleProps;

function CategoryDot({ category }: { category: string }) {
  const visual = categoryVisual(category);
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold"
      style={{ background: visual.bg, color: visual.text }}
    >
      {visual.initials}
    </span>
  );
}

export function MarketingCredentialIndicator(props: MarketingCredentialIndicatorProps) {
  const { entries, canView, canManage, modelUuidByPublicId, onEntryCreated, compact } = props;
  const { addToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [revealed, setRevealed] = React.useState<Partial<Record<CredentialFieldRef, string>>>({});
  const [revealingField, setRevealingField] = React.useState<string | null>(null);
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);
  const [quickAddBusy, setQuickAddBusy] = React.useState(false);
  const [quickAddPassword, setQuickAddPassword] = React.useState("");
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const match = React.useMemo(() => {
    if (props.variant === "social") {
      return findSocialAccountCredential(entries, {
        modelId: props.modelId,
        platform: props.platform,
        username: props.username,
        uuidByPublicId: modelUuidByPublicId,
      });
    }
    return findAppleIdCredentialForPhone(entries, {
      icloudEmail: props.icloudEmail,
      linkedModelIds: props.linkedModelIds,
      uuidByPublicId: modelUuidByPublicId,
    });
  }, [entries, modelUuidByPublicId, props]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuickAddOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setRevealed({});
      setQuickAddOpen(false);
      setQuickAddPassword("");
    }
  }, [open]);

  async function handleReveal(entryId: string, field: CredentialFieldRef) {
    const key = `${entryId}:${field}`;
    setRevealingField(key);
    try {
      const res = await fetch(`/api/admin/credentials/${entryId}/reveal`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });
      const body = (await res.json()) as { value?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Reveal failed");
      setRevealed((prev) => ({ ...prev, [field]: body.value ?? "" }));
    } catch (err) {
      addToast(
        credToast("Reveal failed", err instanceof Error ? err.message : "Could not reveal", "high"),
      );
    } finally {
      setRevealingField(null);
    }
  }

  async function handleCopy(entryId: string, field: CredentialFieldRef) {
    try {
      const res = await fetch(`/api/admin/credentials/${entryId}/copy`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });
      const body = (await res.json()) as { value?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Copy failed");
      await copyTextToClipboard(body.value ?? "");
      addToast(credToast("Copied", `${fieldDisplayLabel(field)} copied`, "normal"));
    } catch (err) {
      addToast(credToast("Copy failed", err instanceof Error ? err.message : "Could not copy", "high"));
    }
  }

  function displayValue(entry: MaskedCredentialEntry, field: CredentialField): string {
    if (!entry.has_value[field]) return "—";
    const revealedVal = revealed[field];
    if (revealedVal !== undefined) return revealedVal || "—";
    if (CREDENTIAL_LIST_PLAINTEXT_FIELDS.includes(field)) return entry.fields[field] || "—";
    return entry.fields[field] || MASKED_VALUE;
  }

  function displayCustom(entry: MaskedCredentialEntry, key: string): string {
    const ref = toCustomFieldRef(key);
    const revealedVal = revealed[ref];
    if (revealedVal !== undefined) return revealedVal || "—";
    return entry.custom_fields[key] ?? MASKED_VALUE;
  }

  function isRevealed(field: CredentialFieldRef): boolean {
    return revealed[field] !== undefined;
  }

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setQuickAddBusy(true);
    try {
      const defaults =
        props.variant === "social"
          ? buildCredentialQuickAddDefaults({
              modelId: props.modelId,
              platform: props.platform,
              username: props.username,
              uuidByPublicId: modelUuidByPublicId,
            })
          : buildAppleCredentialQuickAddDefaults({
              icloudEmail: props.icloudEmail,
              modelId: props.modelId ?? props.linkedModelIds?.[0],
              uuidByPublicId: modelUuidByPublicId,
            });

      const res = await fetch("/api/admin/credentials", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: defaults.model_id,
          category: defaults.category,
          label: defaults.label,
          data:
            props.variant === "social"
              ? {
                  username: "username" in defaults ? defaults.username : "",
                  password: quickAddPassword,
                }
              : {
                  email: "email" in defaults ? defaults.email : props.icloudEmail,
                  password: quickAddPassword,
                },
        }),
      });
      const body = (await res.json()) as { entry?: MaskedCredentialEntry; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Create failed");
      addToast(credToast("Added to Password Library", defaults.label, "normal"));
      if (body.entry) onEntryCreated?.(body.entry);
      setQuickAddOpen(false);
      setQuickAddPassword("");
      setOpen(false);
    } catch (err) {
      addToast(
        credToast("Create failed", err instanceof Error ? err.message : "Could not create entry", "high"),
      );
    } finally {
      setQuickAddBusy(false);
    }
  }

  if (!canView && !canManage) {
    return (
      <span
        className={cn(
          VA_STATUS_BADGE,
          "gap-1 normal-case tracking-normal border-white/10 bg-white/5 text-[#B8B4B8]/45",
          compact && "text-[10px]",
        )}
        title="Password Library access required"
      >
        <Lock className="h-3 w-3" aria-hidden />
        Credentials locked
      </span>
    );
  }

  if (!match) {
    return (
      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-[#B8B4B8]/55 transition hover:border-white/15 hover:text-[#B8B4B8]/75",
            compact && "text-[10px] px-2 py-0.5",
          )}
        >
          No credentials on file
        </button>
        {open && canManage ? (
          <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-2xl border border-white/10 bg-[#0D0B0D]/98 p-4 shadow-2xl backdrop-blur-xl">
            {!quickAddOpen ? (
              <div className="space-y-3">
                <p className="text-sm text-[#B8B4B8]/70">
                  No matching entry in the Password Library for this account.
                </p>
                <button
                  type="button"
                  onClick={() => setQuickAddOpen(true)}
                  className={cn(VA_BTN_PRIMARY, "inline-flex w-full items-center justify-center gap-2 px-3 py-2 text-xs")}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add to Password Library
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => void handleQuickAdd(e)} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">Quick add</p>
                  <button
                    type="button"
                    onClick={() => setQuickAddOpen(false)}
                    className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white"
                    aria-label="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-[#B8B4B8]/55">
                  Model and category will be pre-filled from this account.
                </p>
                <label className="flex flex-col gap-1 text-xs text-white/45">
                  Password
                  <input
                    type="password"
                    value={quickAddPassword}
                    onChange={(e) => setQuickAddPassword(e.target.value)}
                    className={cn(VA_FILTER_INPUT, "rounded-xl text-sm")}
                    placeholder="Enter password"
                    autoComplete="new-password"
                  />
                </label>
                <button
                  type="submit"
                  disabled={quickAddBusy || !quickAddPassword.trim()}
                  className={cn(VA_BTN_PRIMARY, "inline-flex w-full items-center justify-center gap-2 px-3 py-2 text-xs disabled:opacity-50")}
                >
                  {quickAddBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Create entry
                </button>
              </form>
            )}
          </div>
        ) : null}
        {open && !canManage ? (
          <div className="absolute left-0 top-full z-40 mt-2 w-64 rounded-2xl border border-white/10 bg-[#0D0B0D]/98 p-4 shadow-2xl backdrop-blur-xl">
            <p className="text-sm text-[#B8B4B8]/65">No credentials on file for this account.</p>
          </div>
        ) : null}
      </div>
    );
  }

  const secretFields = (Object.keys(CREDENTIAL_FIELD_LABELS) as CredentialField[]).filter(
    (f) => match.has_value[f] && !CREDENTIAL_LIST_PLAINTEXT_FIELDS.includes(f),
  );

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => canView && setOpen((v) => !v)}
        disabled={!canView}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
          canView
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-500/45 hover:bg-emerald-500/15"
            : "cursor-not-allowed border-white/10 bg-white/5 text-[#B8B4B8]/45",
          compact && "text-[10px] px-2 py-0.5",
        )}
        title={canView ? "View credentials from Password Library" : "Password Library view permission required"}
      >
        {canView ? <KeyRound className="h-3 w-3" aria-hidden /> : <Lock className="h-3 w-3" aria-hidden />}
        {canView ? "🔑 Credentials available" : "Credentials locked"}
      </button>

      {open && canView ? (
        <div className="absolute left-0 top-full z-40 mt-2 w-80 rounded-2xl border border-[#D4AF8C]/20 bg-[#0D0B0D]/98 p-4 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-start gap-2.5">
            <CategoryDot category={match.category} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{match.label}</p>
              <p className="text-xs text-[#B8B4B8]/45">{match.category}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto">
            {CREDENTIAL_LIST_PLAINTEXT_FIELDS.map((field) =>
              match.has_value[field] ? (
                <FieldRow
                  key={field}
                  label={fieldDisplayLabel(field)}
                  value={displayValue(match, field)}
                  onCopy={() => void handleCopy(match.id, field)}
                  masked={false}
                />
              ) : null,
            )}
            {secretFields.map((field) => {
              const revealedNow = isRevealed(field);
              return (
                <FieldRow
                  key={field}
                  label={fieldDisplayLabel(field)}
                  value={displayValue(match, field)}
                  masked={!revealedNow}
                  revealing={revealingField === `${match.id}:${field}`}
                  onReveal={() =>
                    revealedNow
                      ? setRevealed((prev) => {
                          const next = { ...prev };
                          delete next[field];
                          return next;
                        })
                      : void handleReveal(match.id, field)
                  }
                  onCopy={() => void handleCopy(match.id, field)}
                />
              );
            })}
            {match.custom_field_keys.map((key) => {
              const ref = toCustomFieldRef(key);
              const revealedNow = isRevealed(ref);
              return (
                <FieldRow
                  key={key}
                  label={key}
                  value={displayCustom(match, key)}
                  masked={!revealedNow}
                  revealing={revealingField === `${match.id}:${ref}`}
                  onReveal={() =>
                    revealedNow
                      ? setRevealed((prev) => {
                          const next = { ...prev };
                          delete next[ref];
                          return next;
                        })
                      : void handleReveal(match.id, ref)
                  }
                  onCopy={() => void handleCopy(match.id, ref)}
                />
              );
            })}
          </div>

          <p className="mt-3 text-[10px] text-[#B8B4B8]/35">
            Reveal and copy actions are logged in the Password Library audit trail.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function FieldRow({
  label,
  value,
  masked,
  revealing,
  onReveal,
  onCopy,
}: {
  label: string;
  value: string;
  masked?: boolean;
  revealing?: boolean;
  onReveal?: () => void;
  onCopy?: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-widest text-white/35">{label}</p>
        <div className="flex items-center gap-0.5">
          {masked && onReveal ? (
            <button
              type="button"
              onClick={onReveal}
              disabled={revealing}
              className="rounded-lg border border-white/10 p-1.5 text-white/45 hover:bg-white/10 hover:text-white disabled:opacity-50"
              aria-label={revealing ? "Revealing" : "Reveal"}
            >
              {revealing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </button>
          ) : onReveal ? (
            <button
              type="button"
              onClick={onReveal}
              className="rounded-lg border border-white/10 p-1.5 text-white/45 hover:bg-white/10 hover:text-white"
              aria-label="Hide"
            >
              <EyeOff className="h-3 w-3" />
            </button>
          ) : null}
          {onCopy ? (
            <button
              type="button"
              onClick={onCopy}
              className="rounded-lg border border-white/10 p-1.5 text-white/45 hover:bg-white/10 hover:text-white"
              aria-label="Copy"
            >
              <Copy className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>
      <p className={cn("mt-1 break-all font-mono text-xs", masked ? "text-[#D4AF8C]/80" : "text-[#B8B4B8]/85")}>
        {value}
      </p>
    </div>
  );
}
