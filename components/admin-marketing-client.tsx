"use client";

import * as React from "react";
import {
  Ban,
  Check,
  ChevronDown,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  ImageIcon,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Smartphone,
  Star,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { ConfirmDeleteModal } from "@/components/confirm-delete-modal";
import { PlatformIconBadge } from "@/components/social-platform-icon";
import { useToast } from "@/contexts/toast-context";
import { formatDateTimeAthens, formatRelativeTime } from "@/lib/format";
import { getSocialColor } from "@/lib/social-platform-config";
import type { ShadowbanReportType } from "@/lib/shadowban-helpers";
import {
  VA_CARD,
  VA_CHAMPAGNE_DIVIDER,
  VA_FILTER_INPUT,
  VA_MODEL_TAG,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type {
  FunnelLink,
  MarketingPlatform,
  Phone,
  PhoneDetail,
  ShadowbanReport,
  ShadowbanReportStatus,
  SocialAccount,
  SocialAccountStatus,
} from "@/services/marketing";
import type { AppNotification, ModelRecord, UserRecord } from "@/types";
import { isModelActiveForAssignment } from "@/lib/assignment-filters";

type Tab = "platforms" | "accounts" | "funnels" | "reports" | "phones";
type ReportDateRange = "all" | "7d" | "30d" | "custom";

const REGIONS = ["USA", "Greek", "Global"] as const;
const ACCOUNT_TYPES = ["main", "secondary"] as const;

const ADMIN_FILTER_INPUT = VA_FILTER_INPUT;
const ADMIN_SELECT = cn(ADMIN_FILTER_INPUT, "min-w-[9rem]");

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

const STATUS_CONFIG: Record<
  SocialAccountStatus,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    dot: string;
    cardClass: string;
    glowClass: string;
    pulse: boolean;
  }
> = {
  active: {
    label: "Active",
    color: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/25",
    dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.35)]",
    cardClass: "border-[rgba(255,255,255,0.06)]",
    glowClass: "",
    pulse: false,
  },
  shadowbanned: {
    label: "Shadowbanned",
    color: "text-amber-300",
    bg: "bg-amber-500/12",
    border: "border-amber-500/35",
    dot: "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.55)]",
    cardClass: "border-amber-500/30",
    glowClass:
      "before:pointer-events-none before:absolute before:-inset-4 before:-z-10 before:rounded-[20px] before:bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.18)_0%,transparent_72%)] before:opacity-70 before:blur-xl max-md:before:opacity-45",
    pulse: true,
  },
  banned: {
    label: "Banned",
    color: "text-red-300",
    bg: "bg-red-500/15",
    border: "border-red-500/40",
    dot: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.65)]",
    cardClass: "border-red-500/35",
    glowClass:
      "before:pointer-events-none before:absolute before:-inset-5 before:-z-10 before:rounded-[22px] before:bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.22)_0%,transparent_68%)] before:opacity-90 before:blur-2xl max-md:before:opacity-50",
    pulse: true,
  },
};

function pill(active: boolean) {
  return cn(
    "relative rounded-full px-4 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-[#FF1493]/20 text-[#FFB3D9] ring-1 ring-[#FF1493]/35 shadow-[0_0_16px_-6px_rgba(255,20,147,0.35)]"
      : "text-[#B8B4B8]/60 hover:bg-white/5 hover:text-white/90",
  );
}

function maskEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return "—";
  const at = trimmed.indexOf("@");
  if (at <= 0) return "••••••••";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}${domain}`;
}

function maskSecret(value: string): string {
  if (!value) return "—";
  return "•".repeat(Math.min(Math.max(value.length, 8), 16));
}

function MaskedSecretInput({
  value,
  onChange,
  placeholder,
  className,
  inputType = "password",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  inputType?: "password" | "email" | "text";
}) {
  const [revealed, setRevealed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative flex items-center gap-1">
      <input
        type={revealed ? inputType : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(className, "pr-20")}
        autoComplete="off"
      />
      <div className="absolute right-2 flex items-center gap-0.5">
        {value ? (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
            aria-label="Copy"
            title={copied ? "Copied" : "Copy"}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setRevealed(!revealed)}
          className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
          aria-label={revealed ? "Hide" : "Show"}
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function MaskedDisplay({
  value,
  mode = "secret",
}: {
  value: string;
  mode?: "secret" | "email";
}) {
  const [revealed, setRevealed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const display = !value ? "—" : revealed ? value : mode === "email" ? maskEmail(value) : maskSecret(value);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-sm text-[#B8B4B8]/80">
      <span>{display}</span>
      {value ? (
        <>
          <button
            type="button"
            onClick={() => setRevealed(!revealed)}
            className="rounded p-1 text-white/35 hover:bg-white/10 hover:text-white"
            aria-label={revealed ? "Hide" : "Show"}
          >
            {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="rounded p-1 text-white/35 hover:bg-white/10 hover:text-white"
            aria-label="Copy"
            title={copied ? "Copied" : "Copy"}
          >
            <Copy className="h-3 w-3" />
          </button>
        </>
      ) : null}
    </span>
  );
}

function SearchablePicker({
  value,
  onChange,
  items,
  placeholder,
  emptyLabel,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  items: { id: string; label: string }[];
  placeholder: string;
  emptyLabel: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items.slice(0, 50);
    return items.filter((i) => i.label.toLowerCase().includes(qq)).slice(0, 50);
  }, [items, q]);

  const selectedLabel = items.find((i) => i.id === value)?.label ?? "";

  return (
    <div ref={ref} className={cn("relative min-w-[10rem]", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(ADMIN_FILTER_INPUT, "flex w-full items-center justify-between text-left")}
      >
        <span className={cn("truncate", selectedLabel ? "text-[#B8B4B8]" : "text-[#B8B4B8]/40")}>
          {selectedLabel || emptyLabel}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#B8B4B8]/40" aria-hidden />
      </button>
      {open ? (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0D0B0D]/98 py-2 shadow-2xl backdrop-blur-xl">
          <input
            type="search"
            placeholder={placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={cn(ADMIN_FILTER_INPUT, "mx-2 mb-1 !h-9 w-[calc(100%-1rem)] text-sm")}
          />
          <div className="max-h-52 overflow-y-auto px-1">
            <button
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#B8B4B8]/50 hover:bg-white/5"
              onClick={() => {
                onChange("");
                setOpen(false);
                setQ("");
              }}
            >
              {emptyLabel}
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[#B8B4B8]/40">No matches</p>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm text-[#B8B4B8]/90 hover:bg-white/10"
                  onClick={() => {
                    onChange(i.id);
                    setOpen(false);
                    setQ("");
                  }}
                >
                  {i.label}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AF8C]/30 bg-[#D4AF8C]/8 px-2.5 py-1 text-xs text-[#D4AF8C]">
      {label}
      <button type="button" onClick={onRemove} className="rounded-full p-0.5 hover:bg-[#D4AF8C]/15" aria-label={`Remove ${label}`}>
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  );
}

function ReportTypeBadge({ type }: { type: ShadowbanReportType }) {
  if (type === "lifted") {
    return (
      <span
        className={cn(
          VA_STATUS_BADGE,
          "gap-1 normal-case tracking-normal",
          "border-emerald-500/40 bg-emerald-500/12 text-emerald-300 shadow-[0_0_12px_-4px_rgba(52,211,153,0.35)]",
        )}
      >
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        Lift reported
      </span>
    );
  }
  const banned = type === "banned";
  return (
    <span
      className={cn(
        VA_STATUS_BADGE,
        "gap-1 normal-case tracking-normal",
        banned
          ? "border-red-500/40 bg-red-500/12 text-red-300 shadow-[0_0_12px_-4px_rgba(239,68,68,0.4)]"
          : "border-amber-500/40 bg-amber-500/12 text-amber-300 shadow-[0_0_12px_-4px_rgba(245,158,11,0.35)]",
      )}
    >
      {banned ? <Ban className="h-3 w-3" aria-hidden /> : <ShieldAlert className="h-3 w-3" aria-hidden />}
      {banned ? "Banned" : "Shadowbanned"}
    </span>
  );
}

function reportInDateRange(createdAt: string, range: ReportDateRange, from: string, to: string): boolean {
  if (!createdAt) return range === "all";
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  if (range === "7d") return t >= now - 7 * 24 * 60 * 60 * 1000;
  if (range === "30d") return t >= now - 30 * 24 * 60 * 60 * 1000;
  if (range === "custom") {
    if (from) {
      const fromT = new Date(`${from}T00:00:00`).getTime();
      if (Number.isFinite(fromT) && t < fromT) return false;
    }
    if (to) {
      const toT = new Date(`${to}T23:59:59`).getTime();
      if (Number.isFinite(toT) && t > toT) return false;
    }
    return true;
  }
  return true;
}

export function AdminMarketingClient({
  platforms: initialPlatforms,
  accounts: initialAccounts,
  funnels: initialFunnels,
  phones: initialPhones,
  models,
  vaUsers,
  initialReports = [],
}: {
  platforms: MarketingPlatform[];
  accounts: SocialAccount[];
  funnels: FunnelLink[];
  phones: Phone[];
  models: ModelRecord[];
  vaUsers: UserRecord[];
  initialReports?: ShadowbanReport[];
}) {
  const { addToast } = useToast();
  const initialPending = initialReports.filter((r) => r.status === "pending").length;
  const [tab, setTab] = React.useState<Tab>(initialPending > 0 ? "reports" : "accounts");
  const [platforms, setPlatforms] = React.useState(initialPlatforms);
  const [accounts, setAccounts] = React.useState(initialAccounts);
  const [funnels, setFunnels] = React.useState(initialFunnels);
  const [phones, setPhones] = React.useState(initialPhones);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [highlightAccountId, setHighlightAccountId] = React.useState<string | null>(null);

  const modelNameById = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const x of models) m[x.id] = x.model_name || x.model_id || x.id;
    return m;
  }, [models]);

  const assignmentModels = React.useMemo(
    () => models.filter((m) => isModelActiveForAssignment(m)),
    [models],
  );

  const platformNames = React.useMemo(
    () => [...new Set(platforms.map((p) => p.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [platforms],
  );

  const phoneNameById = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of phones) m[p.id] = p.device_name || p.id;
    return m;
  }, [phones]);

  const phonePickerItems = React.useMemo(
    () => phones.filter((p) => p.active).map((p) => ({ id: p.id, label: p.device_name || p.id })),
    [phones],
  );

  // —— Phones ——
  const [searchPhones, setSearchPhones] = React.useState("");
  const [phoneDetail, setPhoneDetail] = React.useState<PhoneDetail | null>(null);
  const [phoneDetailLoading, setPhoneDetailLoading] = React.useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = React.useState(false);
  const [editingPhoneId, setEditingPhoneId] = React.useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = React.useState<Partial<Phone>>({});
  const [phonePhotoFiles, setPhonePhotoFiles] = React.useState<File[]>([]);
  const phonePhotoRef = React.useRef<HTMLInputElement>(null);
  const [deletePhoneId, setDeletePhoneId] = React.useState<string | null>(null);
  const [deletePhoneBusy, setDeletePhoneBusy] = React.useState(false);
  const [linkAccountModalOpen, setLinkAccountModalOpen] = React.useState(false);
  const [linkAccountTargetId, setLinkAccountTargetId] = React.useState("");

  const filteredPhones = React.useMemo(() => {
    const q = searchPhones.trim().toLowerCase();
    return phones.filter((p) => {
      if (!q) return true;
      return `${p.device_name} ${p.icloud_email} ${p.assigned_va_name}`.toLowerCase().includes(q);
    });
  }, [phones, searchPhones]);

  async function loadPhoneDetail(phoneId: string) {
    setPhoneDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketing/phones/${encodeURIComponent(phoneId)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { phone: PhoneDetail };
      setPhoneDetail(data.phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load phone");
    } finally {
      setPhoneDetailLoading(false);
    }
  }

  function openPhonesTab(phoneId?: string) {
    setTab("phones");
    if (phoneId) void loadPhoneDetail(phoneId);
    else setPhoneDetail(null);
  }

  function openNewPhone() {
    setEditingPhoneId(null);
    setPhoneDraft({ active: true, device_name: "", icloud_email: "", icloud_password: "", recovery_email: "", recovery_phone: "", notes: "" });
    setPhonePhotoFiles([]);
    setPhoneModalOpen(true);
  }

  function openEditPhone(phone: Phone) {
    setEditingPhoneId(phone.id);
    setPhoneDraft({ ...phone });
    setPhonePhotoFiles([]);
    setPhoneModalOpen(true);
  }

  function closePhoneModal() {
    setPhoneModalOpen(false);
    setEditingPhoneId(null);
    setPhoneDraft({});
    setPhonePhotoFiles([]);
  }

  async function uploadPhonePhotosForId(phoneId: string, files: File[]) {
    if (!files.length) return;
    const fd = new FormData();
    for (const f of files) fd.append("photos", f);
    const res = await fetch(`/api/admin/marketing/phones/${encodeURIComponent(phoneId)}/photos`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async function savePhoneFromModal(e: React.FormEvent) {
    e.preventDefault();
    const deviceName = phoneDraft.device_name?.trim() ?? "";
    if (!deviceName) {
      setError("Device name is required.");
      return;
    }
    setError(null);
    const body = {
      device_name: deviceName,
      icloud_email: (phoneDraft.icloud_email ?? "").trim(),
      icloud_password: phoneDraft.icloud_password ?? "",
      recovery_email: (phoneDraft.recovery_email ?? "").trim(),
      recovery_phone: (phoneDraft.recovery_phone ?? "").trim(),
      assigned_va_id: phoneDraft.assigned_va_id ?? "",
      notes: (phoneDraft.notes ?? "").trim(),
      active: phoneDraft.active !== false,
    };
    setBusy(editingPhoneId ? `phone-${editingPhoneId}` : "phone-add");
    try {
      if (editingPhoneId) {
        const res = await fetch(`/api/admin/marketing/phones/${encodeURIComponent(editingPhoneId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        if (phonePhotoFiles.length) await uploadPhonePhotosForId(editingPhoneId, phonePhotoFiles);
        const listRes = await fetch("/api/admin/marketing/phones", { credentials: "include" });
        const listData = (await listRes.json()) as { phones?: Phone[] };
        setPhones(listData.phones ?? []);
        if (phoneDetail?.id === editingPhoneId) await loadPhoneDetail(editingPhoneId);
      } else {
        const res = await fetch("/api/admin/marketing/phones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { phone: Phone };
        if (phonePhotoFiles.length) await uploadPhonePhotosForId(data.phone.id, phonePhotoFiles);
        const listRes = await fetch("/api/admin/marketing/phones", { credentials: "include" });
        const listData = (await listRes.json()) as { phones?: Phone[] };
        setPhones(listData.phones ?? []);
      }
      closePhoneModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save phone");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeletePhone(id: string) {
    const prevPhones = phones;
    const prevAccounts = accounts;
    const prevPhoneDetail = phoneDetail;
    setPhones((prev) => prev.filter((p) => p.id !== id));
    setAccounts((prev) =>
      prev.map((a) =>
        a.linked_phone_id === id ? { ...a, linked_phone_id: "", linked_phone_name: "" } : a,
      ),
    );
    if (phoneDetail?.id === id) setPhoneDetail(null);
    setDeletePhoneBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketing/phones/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        let message = "Delete failed";
        try {
          const data = (await res.json()) as { error?: string };
          message = data.error ?? message;
        } catch {
          message = (await res.text()) || message;
        }
        throw new Error(message);
      }
      addToast(localToast(`phone-del-${Date.now()}`, "Phone deleted", "Phone removed from Airtable.", "normal"));
      setDeletePhoneId(null);
    } catch (err) {
      setPhones(prevPhones);
      setAccounts(prevAccounts);
      setPhoneDetail(prevPhoneDetail);
      addToast(
        localToast(
          `phone-del-err-${Date.now()}`,
          "Delete failed",
          err instanceof Error ? err.message : "Could not delete phone",
          "high",
        ),
      );
    } finally {
      setDeletePhoneBusy(false);
    }
  }

  async function handleUnlinkAccount(accountId: string) {
    setError(null);
    setBusy(`unlink-${accountId}`);
    try {
      const res = await fetch(`/api/admin/marketing/accounts/${encodeURIComponent(accountId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ linked_phone_id: "" }),
      });
      if (!res.ok) throw new Error(await res.text());
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? { ...a, linked_phone_id: "", linked_phone_name: "" } : a)),
      );
      if (phoneDetail) await loadPhoneDetail(phoneDetail.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlink failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleLinkAccountToPhone(accountId: string, phoneId: string) {
    setError(null);
    setBusy(`link-${accountId}`);
    try {
      const res = await fetch(`/api/admin/marketing/accounts/${encodeURIComponent(accountId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ linked_phone_id: phoneId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const phoneName = phoneNameById[phoneId] ?? "";
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === accountId ? { ...a, linked_phone_id: phoneId, linked_phone_name: phoneName } : a,
        ),
      );
      const listRes = await fetch("/api/admin/marketing/phones", { credentials: "include" });
      const listData = (await listRes.json()) as { phones?: Phone[] };
      setPhones(listData.phones ?? []);
      if (phoneDetail?.id === phoneId) await loadPhoneDetail(phoneId);
      setLinkAccountModalOpen(false);
      setLinkAccountTargetId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Link failed");
    } finally {
      setBusy(null);
    }
  }

  function navigateToAccount(accountId: string) {
    setTab("accounts");
    setPhoneDetail(null);
    setHighlightAccountId(accountId);
    window.setTimeout(() => {
      const el = document.getElementById(`account-card-${accountId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    window.setTimeout(() => setHighlightAccountId(null), 3000);
    const acc = accounts.find((a) => a.id === accountId);
    if (acc) openEditAccount(acc);
  }

  // —— Platforms ——
  const [pName, setPName] = React.useState("");
  const [pIcon, setPIcon] = React.useState("");
  const [pColor, setPColor] = React.useState("#ec4899");
  const [pSort, setPSort] = React.useState(99);
  const [editPlatform, setEditPlatform] = React.useState<MarketingPlatform | null>(null);

  async function addPlatform(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy("platform-add");
    try {
      const res = await fetch("/api/admin/marketing/platforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: pName.trim(), icon: pIcon, color: pColor, sort_order: pSort }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { platform: MarketingPlatform };
      setPlatforms((prev) => [...prev, data.platform].sort((a, b) => a.sort_order - b.sort_order));
      setPName("");
      setPIcon("");
      setPColor("#ec4899");
      setPSort(99);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add platform");
    } finally {
      setBusy(null);
    }
  }

  async function patchPlatform(id: string, body: Partial<MarketingPlatform>) {
    setError(null);
    setBusy(`platform-${id}`);
    try {
      const res = await fetch(`/api/admin/marketing/platforms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, ...body } : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  // —— Accounts ——
  const [searchAccounts, setSearchAccounts] = React.useState("");
  const [filterModel, setFilterModel] = React.useState("");
  const [filterPlatform, setFilterPlatform] = React.useState("");
  const [filterVA, setFilterVA] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [accountModalOpen, setAccountModalOpen] = React.useState(false);
  const [editingAccountId, setEditingAccountId] = React.useState<string | null>(null);
  const [accountDraft, setAccountDraft] = React.useState<Partial<SocialAccount>>({});
  const [reports, setReports] = React.useState<ShadowbanReport[]>(initialReports);
  const [reportsLoading, setReportsLoading] = React.useState(false);
  const [filterReportStatus, setFilterReportStatus] = React.useState<"" | ShadowbanReportStatus>("");
  const [filterReportType, setFilterReportType] = React.useState<"" | ShadowbanReportType>("");
  const [filterReportPlatform, setFilterReportPlatform] = React.useState("");
  const [filterReportVA, setFilterReportVA] = React.useState("");
  const [filterReportCreator, setFilterReportCreator] = React.useState("");
  const [filterReportDateRange, setFilterReportDateRange] = React.useState<ReportDateRange>("all");
  const [filterReportDateFrom, setFilterReportDateFrom] = React.useState("");
  const [filterReportDateTo, setFilterReportDateTo] = React.useState("");
  const [deleteReportId, setDeleteReportId] = React.useState<string | null>(null);
  const [deleteReportBusy, setDeleteReportBusy] = React.useState(false);
  const [screenshotPreview, setScreenshotPreview] = React.useState<string | null>(null);
  const [shadowbanReportTarget, setShadowbanReportTarget] = React.useState<SocialAccount | null>(null);
  const [shadowbanFile, setShadowbanFile] = React.useState<File | null>(null);
  const [shadowbanNotes, setShadowbanNotes] = React.useState("");
  const [shadowbanSubmitting, setShadowbanSubmitting] = React.useState(false);
  const shadowbanProofRef = React.useRef<HTMLInputElement>(null);
  const shadowbanPreviewUrl = React.useMemo(
    () => (shadowbanFile ? URL.createObjectURL(shadowbanFile) : null),
    [shadowbanFile],
  );
  React.useEffect(() => {
    return () => {
      if (shadowbanPreviewUrl) URL.revokeObjectURL(shadowbanPreviewUrl);
    };
  }, [shadowbanPreviewUrl]);

  React.useEffect(() => {
    let cancelled = false;
    setReportsLoading(true);
    fetch("/api/admin/marketing/shadowban-reports", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { reports?: ShadowbanReport[] }) => {
        if (!cancelled) setReports(d.reports ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReportsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!shadowbanReportTarget) return;
      const found = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (found) {
        const f = found.getAsFile();
        if (f) setShadowbanFile(f);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [shadowbanReportTarget]);

  const platformColorByName = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of platforms) {
      if (p.name) m[p.name] = p.color;
    }
    return m;
  }, [platforms]);

  const filteredAccounts = React.useMemo(() => {
    const q = searchAccounts.trim().toLowerCase();
    return accounts.filter((a) => {
      if (filterModel && a.model_id !== filterModel) return false;
      if (filterVA && a.assigned_va_id !== filterVA) return false;
      if (filterPlatform && a.platform !== filterPlatform) return false;
      if (filterStatus && (a.account_status ?? "active") !== filterStatus) return false;
      if (!q) return true;
      return `${a.model_name} ${a.platform} ${a.username} ${a.account_link} ${a.notes}`.toLowerCase().includes(q);
    });
  }, [accounts, searchAccounts, filterModel, filterVA, filterPlatform, filterStatus]);

  const reportPlatformOptions = React.useMemo(
    () => [...new Set(reports.map((r) => r.platform).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [reports],
  );

  const reportVaOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reports) {
      if (r.reported_by_id) map.set(r.reported_by_id, r.reported_by_name || r.reported_by_id);
    }
    return [...map.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [reports]);

  const reportCreatorOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reports) {
      if (r.model_id) map.set(r.model_id, r.model_name || r.model_id);
    }
    for (const m of models) {
      if (m.id) map.set(m.id, m.model_name || m.model_id || m.id);
    }
    return [...map.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [reports, models]);

  const filteredReports = React.useMemo(() => {
    return reports.filter((r) => {
      if (filterReportStatus && r.status !== filterReportStatus) return false;
      if (filterReportType && r.report_type !== filterReportType) return false;
      if (filterReportPlatform && r.platform !== filterReportPlatform) return false;
      if (filterReportVA && r.reported_by_id !== filterReportVA) return false;
      if (filterReportCreator && r.model_id !== filterReportCreator) return false;
      if (!reportInDateRange(r.created_at, filterReportDateRange, filterReportDateFrom, filterReportDateTo)) {
        return false;
      }
      return true;
    });
  }, [
    reports,
    filterReportStatus,
    filterReportType,
    filterReportPlatform,
    filterReportVA,
    filterReportCreator,
    filterReportDateRange,
    filterReportDateFrom,
    filterReportDateTo,
  ]);

  const reportStats = React.useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const pending = reports.filter((r) => r.status === "pending").length;
    const bannedThisWeek = reports.filter(
      (r) => r.report_type === "banned" && r.created_at && new Date(r.created_at).getTime() >= weekAgo,
    ).length;
    const shadowbannedThisWeek = reports.filter(
      (r) =>
        r.report_type === "shadowbanned" && r.created_at && new Date(r.created_at).getTime() >= weekAgo,
    ).length;
    return { pending, bannedThisWeek, shadowbannedThisWeek };
  }, [reports]);

  const pendingLiftedReportByAccountId = React.useMemo(() => {
    const map = new Map<string, ShadowbanReport>();
    for (const r of reports) {
      if (r.status === "pending" && r.report_type === "lifted") {
        map.set(r.account_id, r);
      }
    }
    return map;
  }, [reports]);

  const hasReportFilters =
    !!filterReportStatus ||
    !!filterReportType ||
    !!filterReportPlatform ||
    !!filterReportVA ||
    !!filterReportCreator ||
    filterReportDateRange !== "all";

  const clearReportFilters = React.useCallback(() => {
    setFilterReportStatus("");
    setFilterReportType("");
    setFilterReportPlatform("");
    setFilterReportVA("");
    setFilterReportCreator("");
    setFilterReportDateRange("all");
    setFilterReportDateFrom("");
    setFilterReportDateTo("");
  }, []);

  const accountsByModel = React.useMemo(() => {
    const groups = new Map<string, { model_id: string; model_name: string; accounts: SocialAccount[] }>();
    for (const a of filteredAccounts) {
      const mid = a.model_id;
      const name = a.model_name || modelNameById[mid] || mid || "Unknown";
      let g = groups.get(mid);
      if (!g) {
        g = { model_id: mid, model_name: name, accounts: [] };
        groups.set(mid, g);
      }
      g.accounts.push(a);
    }
    return Array.from(groups.values()).sort((x, y) => x.model_name.localeCompare(y.model_name));
  }, [filteredAccounts, modelNameById]);

  function openNewAccount(preset?: { model_id?: string; model_name?: string; linked_phone_id?: string }) {
    setEditingAccountId(null);
    const mid = preset?.model_id ?? "";
    setAccountDraft({
      model_id: mid,
      model_name: preset?.model_name ?? (mid ? (modelNameById[mid] ?? "") : ""),
      platform: "",
      username: "",
      account_link: "",
      account_type: "main",
      region: "Global",
      assigned_va_id: "",
      assigned_va_name: "",
      notes: "",
      active: true,
      password: "",
      linked_phone_id: preset?.linked_phone_id ?? "",
    });
    setAccountModalOpen(true);
  }

  function openEditAccount(acc: SocialAccount) {
    setEditingAccountId(acc.id);
    setAccountDraft({ ...acc });
    setAccountModalOpen(true);
  }

  function closeAccountModal() {
    setAccountModalOpen(false);
    setEditingAccountId(null);
    setAccountDraft({});
  }

  async function saveAccountFromModal(e: React.FormEvent) {
    e.preventDefault();
    const modelId = accountDraft.model_id?.trim() ?? "";
    const platform = accountDraft.platform?.trim() ?? "";
    const username = accountDraft.username?.trim() ?? "";
    if (!modelId || !platform || !username) {
      setError("Model, platform, and username are required.");
      return;
    }
    setError(null);
    const va = vaUsers.find((u) => u.id === (accountDraft.assigned_va_id ?? ""));
    const body = {
      model_id: modelId,
      model_name: accountDraft.model_name?.trim() || modelNameById[modelId] || "",
      platform,
      account_link: (accountDraft.account_link ?? "").trim(),
      username,
      account_type: (accountDraft.account_type === "secondary" ? "secondary" : "main") as "main" | "secondary",
      region: (accountDraft.region === "USA" || accountDraft.region === "Greek" ? accountDraft.region : "Global") as SocialAccount["region"],
      assigned_va_id: accountDraft.assigned_va_id ?? "",
      assigned_va_name: va?.full_name?.trim() || va?.email || accountDraft.assigned_va_name || "",
      notes: (accountDraft.notes ?? "").trim(),
      password: accountDraft.password ?? "",
      linked_phone_id: accountDraft.linked_phone_id ?? "",
    };
    setBusy(editingAccountId ? `account-${editingAccountId}` : "account-add");
    try {
      if (editingAccountId) {
        const res = await fetch(`/api/admin/marketing/accounts/${editingAccountId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        setAccounts((prev) => prev.map((a) => (a.id === editingAccountId ? { ...a, ...body } : a)));
      } else {
        const res = await fetch("/api/admin/marketing/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { account: SocialAccount };
        setAccounts((prev) => [data.account, ...prev]);
      }
      closeAccountModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save account");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm("Permanently delete this account?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketing/accounts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      if (editingAccountId === id) closeAccountModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function patchAccount(id: string, body: Partial<SocialAccount>) {
    setError(null);
    setBusy(`account-${id}`);
    try {
      const res = await fetch(`/api/admin/marketing/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...body } : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleUpdateAccountStatus(accountId: string, status: SocialAccountStatus) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketing/accounts/${encodeURIComponent(accountId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ account_status: status }),
      });
      if (!res.ok) throw new Error(await res.text());
      setAccounts((prev) => prev.map((a) => (a.id === accountId ? { ...a, account_status: status } : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
    }
  }

  async function handleDeleteReport(id: string) {
    const prev = reports;
    setReports((r) => r.filter((x) => x.id !== id));
    setDeleteReportBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketing/shadowban-reports/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      addToast(localToast(`sbr-del-${Date.now()}`, "Report deleted", "Shadowban report removed.", "normal"));
      setDeleteReportId(null);
    } catch (err) {
      setReports(prev);
      addToast(
        localToast(
          `sbr-del-err-${Date.now()}`,
          "Delete failed",
          err instanceof Error ? err.message : "Could not delete report",
          "high",
        ),
      );
    } finally {
      setDeleteReportBusy(false);
    }
  }

  async function handleReviewReport(reportId: string, action: "approve" | "dismiss") {
    const reportBefore = reports.find((r) => r.id === reportId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketing/shadowban-reports/${encodeURIComponent(reportId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await res.text());
      const listRes = await fetch("/api/admin/marketing/shadowban-reports", { credentials: "include" });
      const listData = (await listRes.json()) as { reports?: ShadowbanReport[] };
      setReports(listData.reports ?? []);
      if (action === "approve" && reportBefore) {
        if (reportBefore.report_type === "lifted") {
          setAccounts((prev) =>
            prev.map((a) =>
              a.account_id === reportBefore.account_id ? { ...a, account_status: "active" } : a,
            ),
          );
        } else {
          const newStatus: SocialAccountStatus =
            reportBefore.report_type === "banned" ? "banned" : "shadowbanned";
          setAccounts((prev) =>
            prev.map((a) =>
              a.account_id === reportBefore.account_id ? { ...a, account_status: newStatus } : a,
            ),
          );
        }
      }
      const handle = reportBefore?.username ? `@${reportBefore.username}` : "Account";
      if (action === "approve") {
        if (reportBefore?.report_type === "lifted") {
          addToast(
            localToast(`sbr-rev-${Date.now()}`, "Account marked active", `${handle} is active again. The VA has been notified.`, "normal"),
          );
        } else {
          const label = reportBefore?.report_type === "banned" ? "banned" : "shadowbanned";
          addToast(
            localToast(`sbr-rev-${Date.now()}`, `Account marked ${label}`, `${handle} was set to ${label}. The reporter has been notified.`, "normal"),
          );
        }
      } else {
        addToast(
          localToast(`sbr-rev-${Date.now()}`, "Report dismissed", `${handle} status is unchanged. The reporter has been notified.`, "normal"),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
      addToast(
        localToast(
          `sbr-rev-err-${Date.now()}`,
          "Review failed",
          err instanceof Error ? err.message : "Could not update the report",
          "high",
        ),
      );
    }
  }

  async function handleSubmitShadowbanReportAdmin() {
    if (!shadowbanReportTarget || !shadowbanFile) return;
    setShadowbanSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("account_id", shadowbanReportTarget.account_id);
      fd.append("model_id", shadowbanReportTarget.model_id);
      fd.append("model_name", shadowbanReportTarget.model_name);
      fd.append("platform", shadowbanReportTarget.platform);
      fd.append("username", shadowbanReportTarget.username);
      fd.append("report_type", "shadowbanned");
      fd.append("notes", shadowbanNotes);
      fd.append("screenshot", shadowbanFile);
      const res = await fetch("/api/va/marketing/report-shadowban", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const listRes = await fetch("/api/admin/marketing/shadowban-reports", { credentials: "include" });
      const listData = (await listRes.json()) as { reports?: ShadowbanReport[] };
      setReports(listData.reports ?? []);
      setShadowbanReportTarget(null);
      setShadowbanFile(null);
      setShadowbanNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report failed");
    } finally {
      setShadowbanSubmitting(false);
    }
  }

  // —— Funnels ——
  const [fModelId, setFModelId] = React.useState("");
  const [fLabel, setFLabel] = React.useState("");
  const [fUrl, setFUrl] = React.useState("");
  const [fPlatform, setFPlatform] = React.useState("");
  const [fRegion, setFRegion] = React.useState<(typeof REGIONS)[number]>("Global");
  const [editFunnel, setEditFunnel] = React.useState<FunnelLink | null>(null);

  async function addFunnel(e: React.FormEvent) {
    e.preventDefault();
    if (!fModelId || !fLabel.trim() || !fUrl.trim()) {
      setError("Model, label, and URL are required.");
      return;
    }
    setError(null);
    setBusy("funnel-add");
    try {
      const res = await fetch("/api/admin/marketing/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: fModelId,
          model_name: modelNameById[fModelId] ?? "",
          label: fLabel.trim(),
          url: fUrl.trim(),
          platform: fPlatform.trim(),
          region: fRegion,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { funnel: FunnelLink };
      setFunnels((prev) => [data.funnel, ...prev]);
      setFLabel("");
      setFUrl("");
      setFPlatform("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add funnel");
    } finally {
      setBusy(null);
    }
  }

  async function patchFunnel(id: string, body: Partial<FunnelLink>) {
    setError(null);
    setBusy(`funnel-${id}`);
    try {
      const res = await fetch(`/api/admin/marketing/funnels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setFunnels((prev) => prev.map((f) => (f.id === id ? { ...f, ...body } : f)));
      setEditFunnel((c) => (c?.id === id ? { ...c, ...body } : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function removeFunnel(id: string) {
    if (!confirm("Deactivate this funnel link?")) return;
    setError(null);
    setBusy(`funnel-del-${id}`);
    try {
      const res = await fetch(`/api/admin/marketing/funnels/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setFunnels((prev) => prev.map((f) => (f.id === id ? { ...f, active: false } : f)));
      setEditFunnel((c) => (c?.id === id ? null : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  const selectClass = cn(ADMIN_FILTER_INPUT, "rounded-xl");

  const pendingCount = reportStats.pending;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Marketing</h1>
        <p className="mt-1 text-sm text-[#B8B4B8]/55">Control room for platforms, social accounts, funnel links, and shadowban reports.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        <button type="button" className={pill(tab === "accounts")} onClick={() => setTab("accounts")}>
          Social accounts
        </button>
        <button type="button" className={pill(tab === "phones")} onClick={() => { setTab("phones"); setPhoneDetail(null); }}>
          Phones
        </button>
        <button type="button" className={pill(tab === "reports")} onClick={() => setTab("reports")}>
          Shadowban reports
          {pendingCount > 0 ? (
            <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/30">
              {pendingCount}
            </span>
          ) : null}
        </button>
        <button type="button" className={pill(tab === "funnels")} onClick={() => setTab("funnels")}>
          Funnel links
        </button>
        <button type="button" className={pill(tab === "platforms")} onClick={() => setTab("platforms")}>
          Platforms
        </button>
      </div>

      {tab === "platforms" ? (
        <div className="space-y-6">
          <form
            onSubmit={addPlatform}
            className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Add platform</h2>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-white/50">
                Name
                <input
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className={selectClass}
                  placeholder="Instagram"
                  required
                />
              </label>
              <label className="flex w-24 flex-col gap-1 text-xs text-white/50">
                Icon
                <input value={pIcon} onChange={(e) => setPIcon(e.target.value)} className={selectClass} />
              </label>
              <label className="flex w-28 flex-col gap-1 text-xs text-white/50">
                Color
                <input
                  type="color"
                  value={pColor}
                  onChange={(e) => setPColor(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-xl border border-white/15 bg-black/40"
                />
              </label>
              <label className="flex w-24 flex-col gap-1 text-xs text-white/50">
                Sort
                <input
                  type="number"
                  value={pSort}
                  onChange={(e) => setPSort(Number(e.target.value))}
                  className={selectClass}
                />
              </label>
              <button
                type="submit"
                disabled={busy === "platform-add"}
                className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition hover:bg-pink-400 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-950/40">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Icon</th>
                  <th className="px-4 py-3">Color</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3 w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/85">
                {platforms.map((p) => (
                  <React.Fragment key={p.id}>
                    <tr>
                      <td className="px-4 py-3 tabular-nums">{p.sort_order}</td>
                      <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                      <td className="px-4 py-3">
                        <PlatformIconBadge platform={p.name} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-5 w-5 rounded border border-white/20"
                            style={{ backgroundColor: p.color }}
                          />
                          <span className="font-mono text-xs text-white/55">{p.color}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => patchPlatform(p.id, { active: !p.active })}
                          disabled={busy === `platform-${p.id}`}
                          className={cn(
                            "rounded-lg px-2 py-1 text-xs font-medium",
                            p.active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50",
                          )}
                        >
                          {p.active ? "On" : "Off"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setEditPlatform((cur) => (cur?.id === p.id ? null : p))}
                          className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    {editPlatform?.id === p.id ? (
                      <tr className="bg-white/[0.03]">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="flex flex-wrap items-end gap-3">
                            <label className="flex min-w-[120px] flex-1 flex-col gap-1 text-xs text-white/50">
                              Name
                              <input
                                value={editPlatform.name}
                                onChange={(e) => setEditPlatform({ ...editPlatform, name: e.target.value })}
                                className={selectClass}
                              />
                            </label>
                            <label className="flex w-24 flex-col gap-1 text-xs text-white/50">
                              Icon
                              <input
                                value={editPlatform.icon}
                                onChange={(e) => setEditPlatform({ ...editPlatform, icon: e.target.value })}
                                className={selectClass}
                              />
                            </label>
                            <label className="flex w-28 flex-col gap-1 text-xs text-white/50">
                              Color
                              <input
                                type="color"
                                value={editPlatform.color}
                                onChange={(e) => setEditPlatform({ ...editPlatform, color: e.target.value })}
                                className="h-10 w-full cursor-pointer rounded-xl border border-white/15"
                              />
                            </label>
                            <label className="flex w-24 flex-col gap-1 text-xs text-white/50">
                              Sort
                              <input
                                type="number"
                                value={editPlatform.sort_order}
                                onChange={(e) =>
                                  setEditPlatform({ ...editPlatform, sort_order: Number(e.target.value) })
                                }
                                className={selectClass}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={async () => {
                                await patchPlatform(editPlatform.id, {
                                  name: editPlatform.name,
                                  icon: editPlatform.icon,
                                  color: editPlatform.color,
                                  sort_order: editPlatform.sort_order,
                                });
                                setEditPlatform(null);
                              }}
                              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                            >
                              Save
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "accounts" ? (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Social Accounts</h2>
              <p className="mt-0.5 text-sm text-white/40">
                {accounts.length} accounts across {[...new Set(accounts.map((a) => a.model_id))].length} models
              </p>
            </div>
            <button
              type="button"
              onClick={() => openNewAccount()}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-pink-500/25 transition-all hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add Account
            </button>
          </div>

          <div className="mb-6 flex flex-wrap gap-3 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0D0B0D]/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8B4B8]/30" />
              <input
                placeholder="Search username, model..."
                value={searchAccounts}
                onChange={(e) => setSearchAccounts(e.target.value)}
                className={cn(ADMIN_FILTER_INPUT, "w-full pl-9")}
              />
            </div>
            <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)} className={ADMIN_SELECT}>
              <option value="">All creators</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.model_name || m.model_id}
                </option>
              ))}
            </select>
            <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} className={ADMIN_SELECT}>
              <option value="">All platforms</option>
              {[...new Set(accounts.map((a) => a.platform).filter(Boolean))].sort().map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select value={filterVA} onChange={(e) => setFilterVA(e.target.value)} className={ADMIN_SELECT}>
              <option value="">All VAs</option>
              {vaUsers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.full_name || v.email}
                </option>
              ))}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={ADMIN_SELECT}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="shadowbanned">Shadowbanned</option>
              <option value="banned">Banned</option>
            </select>
            {(searchAccounts || filterModel || filterPlatform || filterVA || filterStatus) && (
              <button
                type="button"
                onClick={() => {
                  setSearchAccounts("");
                  setFilterModel("");
                  setFilterPlatform("");
                  setFilterVA("");
                  setFilterStatus("");
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-[#B8B4B8]/50 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {accountsByModel.length === 0 ? (
            <div className={cn(VA_CARD, "py-20 text-center")}>
              <p className="mb-4 flex justify-center">
                <Smartphone className="h-12 w-12 text-[#D4AF8C]/35" aria-hidden />
              </p>
              <p className="text-lg text-[#B8B4B8]/70">No social accounts yet</p>
              <p className="mt-1 text-sm text-[#B8B4B8]/40">Add the first account to get started</p>
            </div>
          ) : (
            accountsByModel.map((group) => (
              <div key={group.model_id} className="mb-10">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-pink-500/20 bg-gradient-to-br from-pink-500/20 to-rose-500/20 text-lg font-bold text-pink-400">
                    {(group.model_name || "?")[0]}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-white">{group.model_name}</h3>
                    <p className="text-xs text-white/30">
                      {group.accounts.length} account{group.accounts.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openNewAccount({ model_id: group.model_id, model_name: group.model_name })
                    }
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/40 transition-all hover:bg-white/10 hover:text-white"
                  >
                    <Plus className="h-3 w-3" /> Add account
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.accounts.map((acc) => {
                    const color = platformColorByName[acc.platform] ?? getSocialColor(acc.platform);
                    const st: SocialAccountStatus = acc.account_status ?? "active";
                    const statusCfg = STATUS_CONFIG[st];
                    const pendingLiftedReport = pendingLiftedReportByAccountId.get(acc.account_id);

                    return (
                      <div
                        key={acc.id}
                        id={`account-card-${acc.id}`}
                        className={cn(
                          "group relative overflow-hidden rounded-xl border bg-[#0D0B0D]/80 p-4 transition duration-200",
                          "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_4px_16px_-8px_rgba(0,0,0,0.5)]",
                          statusCfg.cardClass,
                          statusCfg.glowClass,
                          !acc.active && "opacity-60",
                          highlightAccountId === acc.id && "ring-2 ring-[#FF1493]/50 ring-offset-2 ring-offset-[#0D0B0D]",
                        )}
                      >
                        <div className="h-1 w-full rounded-t-xl" style={{ backgroundColor: `${color}99` }} />

                        <div>
                          <div className="mb-3 flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <PlatformIconBadge platform={acc.platform} />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-white">@{acc.username}</p>
                                <p className="text-xs text-[#B8B4B8]/45">{acc.platform}</p>
                              </div>
                            </div>

                            <div className="flex shrink-0 gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
                              {acc.account_link ? (
                                <a
                                  href={acc.account_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-lg p-1.5 text-white/30 transition-all hover:bg-white/10 hover:text-white"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => openEditAccount(acc)}
                                className="rounded-lg p-1.5 text-white/30 transition-all hover:bg-white/10 hover:text-white"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteAccount(acc.id)}
                                className="rounded-lg p-1.5 text-white/30 transition-all hover:bg-red-500/10 hover:text-red-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="mb-3 flex flex-wrap gap-1.5">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                                acc.account_type === "main"
                                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                  : "border-blue-500/20 bg-blue-500/10 text-blue-400",
                              )}
                            >
                              {acc.account_type === "main" ? (
                                <>
                                  <Star className="h-3 w-3" aria-hidden /> Main
                                </>
                              ) : (
                                "2nd"
                              )}
                            </span>
                            <span className={VA_MODEL_TAG}>{acc.region}</span>
                          </div>

                          {acc.assigned_va_name ? (
                            <div className="mb-3 flex items-center gap-1.5">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-400">
                                {acc.assigned_va_name[0]}
                              </div>
                              <span className="text-xs text-white/40">{acc.assigned_va_name}</span>
                            </div>
                          ) : null}

                          {acc.password ? (
                            <div className="mb-3">
                              <p className="mb-1 text-[10px] uppercase tracking-widest text-white/30">Password</p>
                              <MaskedDisplay value={acc.password} />
                            </div>
                          ) : null}

                          {acc.linked_phone_id ? (
                            <button
                              type="button"
                              onClick={() => openPhonesTab(acc.linked_phone_id)}
                              className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF8C]/25 bg-[#D4AF8C]/8 px-2.5 py-1 text-xs text-[#D4AF8C] transition hover:bg-[#D4AF8C]/15"
                            >
                              <Smartphone className="h-3 w-3" aria-hidden />
                              {acc.linked_phone_name || phoneNameById[acc.linked_phone_id] || "Linked phone"}
                            </button>
                          ) : null}

                          <div className="mb-3">
                            <button
                              type="button"
                              onClick={() => void patchAccount(acc.id, { active: !acc.active })}
                              disabled={busy === `account-${acc.id}`}
                              className={cn(
                                "rounded-lg px-2 py-1 text-xs font-medium",
                                acc.active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50",
                              )}
                            >
                              Active: {acc.active ? "On" : "Off"}
                            </button>
                          </div>

                          {pendingLiftedReport ? (
                            <div className="mb-3 space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-3">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                VA reports restriction lifted
                              </span>
                              {pendingLiftedReport.notes ? (
                                <p className="text-xs text-[#B8B4B8]/55">{pendingLiftedReport.notes}</p>
                              ) : null}
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleReviewReport(pendingLiftedReport.id, "approve")}
                                  className="rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
                                >
                                  Confirm — set active
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleReviewReport(pendingLiftedReport.id, "dismiss")}
                                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[#B8B4B8]/60 hover:bg-white/10"
                                >
                                  Dismiss
                                </button>
                              </div>
                            </div>
                          ) : null}

                          <div className="group/status relative mt-auto">
                            <button
                              type="button"
                              className={cn(
                                "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
                                statusCfg.bg,
                                statusCfg.border,
                              )}
                            >
                              <div
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  statusCfg.dot,
                                  statusCfg.pulse ? "animate-pulse motion-reduce:animate-none" : "",
                                )}
                              />
                              <span className={statusCfg.color}>{statusCfg.label}</span>
                              <ChevronDown className={cn("ml-auto h-3 w-3 opacity-50", statusCfg.color)} />
                            </button>

                            <div className="absolute bottom-full left-0 z-30 mb-1 hidden min-w-[11rem] rounded-xl border border-white/15 bg-[#0f0f1a] p-1.5 shadow-2xl group-hover/status:block">
                              {(["active", "shadowbanned", "banned"] as const).map((status) => {
                                const cfg = STATUS_CONFIG[status];
                                return (
                                  <button
                                    key={status}
                                    type="button"
                                    onClick={() => void handleUpdateAccountStatus(acc.id, status)}
                                    className={cn(
                                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all hover:bg-white/5",
                                      cfg.color,
                                      acc.account_status === status ? "bg-white/5" : "",
                                    )}
                                  >
                                    <div className={cn("h-2 w-2 rounded-full", cfg.dot)} />
                                    {cfg.label}
                                    {acc.account_status === status ? (
                                      <Check className="ml-auto h-3 w-3 opacity-60" />
                                    ) : null}
                                  </button>
                                );
                              })}
                              <div className="my-1 h-px bg-white/[0.08]" />
                              <button
                                type="button"
                                onClick={() => {
                                  setShadowbanReportTarget(acc);
                                  setShadowbanFile(null);
                                  setShadowbanNotes("");
                                }}
                                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-amber-400 transition-all hover:bg-amber-500/10"
                              >
                                Report shadowban
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "phones" ? (
        <div>
          {phoneDetail ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPhoneDetail(null)}
                  className="text-sm text-[#D4AF8C]/70 hover:text-[#D4AF8C]"
                >
                  ← Back to phones
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEditPhone(phoneDetail)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletePhoneId(phoneDetail.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/25 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>

              {phoneDetailLoading ? (
                <div className={cn(VA_CARD, "flex items-center justify-center gap-2 py-16 text-[#B8B4B8]/50")}>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  Loading…
                </div>
              ) : (
                <>
                  <article className={cn(VA_CARD, "p-5")}>
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-white">{phoneDetail.device_name}</h2>
                        <p className="mt-1 text-sm text-[#B8B4B8]/45">
                          {phoneDetail.created_at ? formatDateTimeAthens(phoneDetail.created_at) : "—"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          VA_STATUS_BADGE,
                          phoneDetail.active
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-white/15 bg-white/5 text-[#B8B4B8]/50",
                        )}
                      >
                        {phoneDetail.active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className={cn(VA_CHAMPAGNE_DIVIDER, "my-4")} />

                    <dl className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-[10px] uppercase tracking-widest text-white/35">iCloud email</dt>
                        <dd className="mt-1">
                          <MaskedDisplay value={phoneDetail.icloud_email} mode="email" />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-widest text-white/35">iCloud password</dt>
                        <dd className="mt-1">
                          <MaskedDisplay value={phoneDetail.icloud_password} />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-widest text-white/35">Recovery email</dt>
                        <dd className="mt-1">
                          <MaskedDisplay value={phoneDetail.recovery_email} mode="email" />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-widest text-white/35">Recovery phone</dt>
                        <dd className="mt-1 text-sm text-[#B8B4B8]/80">{phoneDetail.recovery_phone || "—"}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-[10px] uppercase tracking-widest text-white/35">Assigned VA</dt>
                        <dd className="mt-1 text-sm text-white/80">{phoneDetail.assigned_va_name || "—"}</dd>
                      </div>
                      {phoneDetail.notes ? (
                        <div className="sm:col-span-2">
                          <dt className="text-[10px] uppercase tracking-widest text-white/35">Notes</dt>
                          <dd className="mt-1 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-[#B8B4B8]/70">
                            {phoneDetail.notes}
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    {phoneDetail.phone_photos.length > 0 ? (
                      <div className="mt-5">
                        <p className="mb-2 text-[10px] uppercase tracking-widest text-white/35">Photos</p>
                        <div className="flex flex-wrap gap-2">
                          {phoneDetail.phone_photos.map((ph, i) => (
                            <a
                              key={`${ph.url}-${i}`}
                              href={ph.url}
                              target="_blank"
                              rel="noreferrer"
                              className="overflow-hidden rounded-xl border border-white/10 transition hover:border-[#D4AF8C]/30"
                            >
                              <img src={ph.url} alt="" className="h-20 w-20 object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </article>

                  <section className={cn(VA_CARD, "p-5")}>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-white">Linked accounts</h3>
                        <p className="text-xs text-[#B8B4B8]/40">
                          {phoneDetail.linked_accounts.length} social account
                          {phoneDetail.linked_accounts.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setLinkAccountTargetId("");
                          setLinkAccountModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-pink-500/20"
                      >
                        <Link2 className="h-3.5 w-3.5" /> Link account
                      </button>
                    </div>

                    {phoneDetail.linked_accounts.length === 0 ? (
                      <p className="py-8 text-center text-sm text-[#B8B4B8]/45">No linked social accounts yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {phoneDetail.linked_accounts.map((acc) => (
                          <div
                            key={acc.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3"
                          >
                            <button
                              type="button"
                              onClick={() => navigateToAccount(acc.id)}
                              className="flex min-w-0 flex-1 items-center gap-2.5 text-left hover:opacity-90"
                            >
                              <PlatformIconBadge platform={acc.platform} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">@{acc.username}</p>
                                <p className="text-xs text-[#B8B4B8]/45">
                                  {acc.platform} · {acc.model_name}
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleUnlinkAccount(acc.id)}
                              disabled={busy === `unlink-${acc.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-[#B8B4B8]/60 hover:bg-white/5 hover:text-white"
                            >
                              <Unlink className="h-3 w-3" aria-hidden />
                              Unlink
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Phones</h2>
                  <p className="mt-0.5 text-sm text-white/40">Device + iCloud tracking for marketing accounts</p>
                </div>
                <button
                  type="button"
                  onClick={openNewPhone}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-pink-500/25 transition-all hover:opacity-90"
                >
                  <Plus className="h-4 w-4" /> Add phone
                </button>
              </div>

              <div className="mb-6 flex flex-wrap gap-3 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#0D0B0D]/60 p-4">
                <div className="relative min-w-48 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8B4B8]/30" />
                  <input
                    placeholder="Search device, email, VA…"
                    value={searchPhones}
                    onChange={(e) => setSearchPhones(e.target.value)}
                    className={cn(ADMIN_FILTER_INPUT, "w-full pl-9")}
                  />
                </div>
              </div>

              {filteredPhones.length === 0 ? (
                <div className={cn(VA_CARD, "py-20 text-center")}>
                  <p className="mb-4 flex justify-center">
                    <Smartphone className="h-12 w-12 text-[#D4AF8C]/35" aria-hidden />
                  </p>
                  <p className="text-lg text-[#B8B4B8]/70">No phones yet</p>
                  <p className="mt-1 text-sm text-[#B8B4B8]/40">Add a device to track iCloud credentials</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredPhones.map((phone) => (
                    <button
                      key={phone.id}
                      type="button"
                      onClick={() => void loadPhoneDetail(phone.id)}
                      className={cn(
                        VA_CARD,
                        "group w-full p-4 text-left transition hover:border-[#D4AF8C]/25 hover:shadow-[0_0_24px_-8px_rgba(212,175,140,0.2)]",
                        !phone.active && "opacity-60",
                      )}
                    >
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-pink-500/20 bg-gradient-to-br from-pink-500/15 to-rose-500/15">
                            <Smartphone className="h-5 w-5 text-pink-400" aria-hidden />
                          </div>
                          <div>
                            <p className="font-bold text-white">{phone.device_name}</p>
                            <p className="text-xs text-[#B8B4B8]/40">{phone.assigned_va_name || "Unassigned"}</p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            phone.active
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-white/10 text-white/40",
                          )}
                        >
                          {phone.active ? "Active" : "Off"}
                        </span>
                      </div>
                      <div className="mb-3">
                        <p className="mb-0.5 text-[10px] uppercase tracking-widest text-white/30">iCloud</p>
                        <MaskedDisplay value={phone.icloud_email} mode="email" />
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#B8B4B8]/45">
                        <span className="inline-flex items-center gap-1">
                          <Link2 className="h-3 w-3" aria-hidden />
                          {phone.linked_account_count} linked
                        </span>
                        <span className="text-[#D4AF8C]/60 opacity-0 transition group-hover:opacity-100">View →</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {tab === "reports" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Shadowban reports</h2>
              <p className="text-sm text-[#B8B4B8]/45">Submitted by VAs — review, approve, or dismiss</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className={cn(VA_STATUS_BADGE, "border-amber-500/30 bg-amber-500/10 text-amber-300")}>
                {reportStats.pending} pending
              </span>
              <span className={cn(VA_STATUS_BADGE, "border-red-500/30 bg-red-500/10 text-red-300")}>
                {reportStats.bannedThisWeek} banned (7d)
              </span>
              <span className={cn(VA_STATUS_BADGE, "border-amber-500/25 bg-amber-500/8 text-amber-200/80")}>
                {reportStats.shadowbannedThisWeek} shadowbanned (7d)
              </span>
            </div>
          </div>

          <div className={cn(VA_CARD, "space-y-3 p-4")}>
            <div className="flex flex-wrap gap-2">
              <select
                value={filterReportStatus}
                onChange={(e) => setFilterReportStatus(e.target.value as "" | ShadowbanReportStatus)}
                className={ADMIN_SELECT}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="dismissed">Dismissed</option>
              </select>
              <select
                value={filterReportType}
                onChange={(e) => setFilterReportType(e.target.value as "" | ShadowbanReportType)}
                className={ADMIN_SELECT}
              >
                <option value="">All types</option>
                <option value="shadowbanned">Shadowbanned</option>
                <option value="banned">Banned</option>
                <option value="lifted">Restriction lifted</option>
              </select>
              <select
                value={filterReportPlatform}
                onChange={(e) => setFilterReportPlatform(e.target.value)}
                className={ADMIN_SELECT}
              >
                <option value="">All platforms</option>
                {reportPlatformOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <SearchablePicker
                value={filterReportVA}
                onChange={setFilterReportVA}
                items={reportVaOptions}
                placeholder="Search VA…"
                emptyLabel="All reporters"
              />
              <SearchablePicker
                value={filterReportCreator}
                onChange={setFilterReportCreator}
                items={reportCreatorOptions}
                placeholder="Search creator…"
                emptyLabel="All creators"
              />
              <select
                value={filterReportDateRange}
                onChange={(e) => setFilterReportDateRange(e.target.value as ReportDateRange)}
                className={ADMIN_SELECT}
              >
                <option value="all">All time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="custom">Custom range</option>
              </select>
              {filterReportDateRange === "custom" ? (
                <>
                  <input
                    type="date"
                    value={filterReportDateFrom}
                    onChange={(e) => setFilterReportDateFrom(e.target.value)}
                    className={ADMIN_SELECT}
                    aria-label="From date"
                  />
                  <input
                    type="date"
                    value={filterReportDateTo}
                    onChange={(e) => setFilterReportDateTo(e.target.value)}
                    className={ADMIN_SELECT}
                    aria-label="To date"
                  />
                </>
              ) : null}
            </div>
            {hasReportFilters ? (
              <div className="flex flex-wrap items-center gap-2">
                {filterReportStatus ? (
                  <FilterChip label={`Status: ${filterReportStatus}`} onRemove={() => setFilterReportStatus("")} />
                ) : null}
                {filterReportType ? (
                  <FilterChip label={`Type: ${filterReportType}`} onRemove={() => setFilterReportType("")} />
                ) : null}
                {filterReportPlatform ? (
                  <FilterChip label={`Platform: ${filterReportPlatform}`} onRemove={() => setFilterReportPlatform("")} />
                ) : null}
                {filterReportVA ? (
                  <FilterChip
                    label={`VA: ${reportVaOptions.find((v) => v.id === filterReportVA)?.label ?? filterReportVA}`}
                    onRemove={() => setFilterReportVA("")}
                  />
                ) : null}
                {filterReportCreator ? (
                  <FilterChip
                    label={`Creator: ${reportCreatorOptions.find((c) => c.id === filterReportCreator)?.label ?? filterReportCreator}`}
                    onRemove={() => setFilterReportCreator("")}
                  />
                ) : null}
                {filterReportDateRange !== "all" ? (
                  <FilterChip
                    label={`Date: ${filterReportDateRange === "custom" ? `${filterReportDateFrom || "…"} – ${filterReportDateTo || "…"}` : filterReportDateRange}`}
                    onRemove={() => {
                      setFilterReportDateRange("all");
                      setFilterReportDateFrom("");
                      setFilterReportDateTo("");
                    }}
                  />
                ) : null}
                <button type="button" onClick={clearReportFilters} className="text-xs text-[#D4AF8C]/70 hover:text-[#D4AF8C]">
                  Clear all
                </button>
              </div>
            ) : null}
          </div>

          {reportsLoading ? (
            <div className={cn(VA_CARD, "flex items-center justify-center gap-2 py-16 text-[#B8B4B8]/50")}>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Loading reports…
            </div>
          ) : filteredReports.length === 0 ? (
            <div className={cn(VA_CARD, "py-16 text-center")}>
              <p className="mb-3 flex justify-center">
                <ShieldAlert className="h-10 w-10 text-[#D4AF8C]/35" aria-hidden />
              </p>
              <p className="text-[#B8B4B8]/70">{reports.length === 0 ? "No shadowban reports" : "No reports match filters"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => {
                const shotUrl = report.screenshot?.[0]?.url;
                return (
                  <article
                    key={report.id}
                    className={cn(
                      VA_CARD,
                      "overflow-hidden p-0",
                      report.status === "pending"
                        ? report.report_type === "lifted"
                          ? "border-emerald-500/25"
                          : "border-amber-500/25"
                        : report.status === "approved"
                          ? "border-red-500/20 opacity-90"
                          : "border-white/8 opacity-75",
                    )}
                  >
                    <div className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <PlatformIconBadge platform={report.platform} size="sm" />
                            <div className="min-w-0">
                              <p className="font-bold text-white">@{report.username}</p>
                              <p className="text-xs text-[#B8B4B8]/45">{report.platform}</p>
                            </div>
                            <ReportTypeBadge type={report.report_type} />
                            <span
                              className={cn(
                                VA_STATUS_BADGE,
                                "ml-auto normal-case tracking-normal",
                                report.status === "pending"
                                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                  : report.status === "approved"
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                    : "border-white/15 bg-white/5 text-[#B8B4B8]/50",
                              )}
                            >
                              {report.status}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className={VA_MODEL_TAG}>{report.model_name || "Unknown creator"}</span>
                            <span className="text-xs text-[#B8B4B8]/35">·</span>
                            <span className="text-sm text-[#B8B4B8]/70">
                              Reported by <span className="font-medium text-white/90">{report.reported_by_name || "—"}</span>
                            </span>
                          </div>

                          <p
                            className="text-xs text-[#B8B4B8]/45"
                            title={report.created_at ? formatDateTimeAthens(report.created_at) : undefined}
                          >
                            {report.created_at ? formatRelativeTime(report.created_at) : "—"}
                            {report.created_at ? (
                              <span className="ml-1 text-[#B8B4B8]/30">({formatDateTimeAthens(report.created_at)})</span>
                            ) : null}
                          </p>

                          {report.notes ? (
                            <p className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-[#B8B4B8]/65">
                              {report.notes}
                            </p>
                          ) : null}

                          {shotUrl ? (
                            <button
                              type="button"
                              onClick={() => setScreenshotPreview(shotUrl)}
                              className="inline-flex items-center gap-1.5 text-xs text-[#D4AF8C] hover:text-[#D4AF8C]/80"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden />
                              View screenshot
                            </button>
                          ) : null}

                          {report.status !== "pending" ? (
                            <div className={cn(VA_CHAMPAGNE_DIVIDER, "my-2")} />
                          ) : null}
                          {report.status !== "pending" ? (
                            <div className="text-xs text-[#B8B4B8]/45">
                              <span className="font-medium text-[#B8B4B8]/70">Resolution: </span>
                              {report.status === "approved" ? "Approved" : "Dismissed"}
                              {report.reviewed_by ? (
                                <>
                                  {" "}
                                  by <span className="text-white/70">{report.reviewed_by}</span>
                                </>
                              ) : null}
                              {report.reviewed_at ? (
                                <span title={formatDateTimeAthens(report.reviewed_at)}>
                                  {" "}
                                  · {formatRelativeTime(report.reviewed_at)}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {shotUrl ? (
                          <button
                            type="button"
                            onClick={() => setScreenshotPreview(shotUrl)}
                            className="shrink-0 overflow-hidden rounded-xl border border-white/10 transition hover:border-[#D4AF8C]/30"
                          >
                            <img src={shotUrl} alt="" className="h-20 w-28 object-cover" />
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/8 pt-4">
                        {report.status === "pending" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleReviewReport(report.id, "approve")}
                              className={cn(
                                "flex-1 rounded-xl border py-2.5 text-sm font-semibold transition",
                                report.report_type === "lifted"
                                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                                  : "border-red-500/30 bg-red-500/15 text-red-300 hover:bg-red-500/25",
                              )}
                            >
                              {report.report_type === "lifted"
                                ? "Confirm — set active"
                                : `Approve — mark ${report.report_type === "banned" ? "banned" : "shadowbanned"}`}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleReviewReport(report.id, "dismiss")}
                              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-[#B8B4B8]/60 hover:bg-white/10"
                            >
                              Dismiss
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setDeleteReportId(report.id)}
                          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 px-3 py-2 text-xs text-red-400/80 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === "funnels" ? (
        <div className="space-y-6">
          <form
            onSubmit={addFunnel}
            className="rounded-2xl border border-white/10 bg-zinc-950/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Add funnel link</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Model
                <select value={fModelId} onChange={(e) => setFModelId(e.target.value)} className={selectClass} required>
                  <option value="">Select…</option>
                  {assignmentModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.model_name || m.model_id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Label
                <input value={fLabel} onChange={(e) => setFLabel(e.target.value)} className={selectClass} required />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2 lg:col-span-3">
                URL
                <input value={fUrl} onChange={(e) => setFUrl(e.target.value)} className={selectClass} required />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Platform
                <input
                  value={fPlatform}
                  onChange={(e) => setFPlatform(e.target.value)}
                  className={selectClass}
                  list="platform-name-list-funnel"
                />
                <datalist id="platform-name-list-funnel">
                  {platformNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Region
                <select value={fRegion} onChange={(e) => setFRegion(e.target.value as (typeof REGIONS)[number])} className={selectClass}>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4">
              <button
                type="submit"
                disabled={busy === "funnel-add"}
                className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 hover:bg-pink-400 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add funnel
              </button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-950/40">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-3 py-3">Model</th>
                  <th className="px-3 py-3">Label</th>
                  <th className="px-3 py-3">URL</th>
                  <th className="px-3 py-3">Platform</th>
                  <th className="px-3 py-3">Region</th>
                  <th className="px-3 py-3">Active</th>
                  <th className="px-3 py-3 w-24"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/85">
                {funnels.map((f) => (
                  <React.Fragment key={f.id}>
                    <tr className={!f.active ? "opacity-50" : undefined}>
                      <td className="px-3 py-2.5">{f.model_name || modelNameById[f.model_id] || f.model_id}</td>
                      <td className="px-3 py-2.5 font-medium text-white">{f.label}</td>
                      <td className="max-w-[220px] truncate px-3 py-2.5">
                        <a href={f.url} className="text-pink-300 hover:underline" target="_blank" rel="noreferrer">
                          {f.url}
                        </a>
                      </td>
                      <td className="px-3 py-2.5">
                        {f.platform ? (
                          <span className="inline-flex items-center gap-2">
                            <PlatformIconBadge platform={f.platform} size="sm" />
                            {f.platform}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5">{f.region}</td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => patchFunnel(f.id, { active: !f.active })}
                          disabled={busy === `funnel-${f.id}`}
                          className={cn(
                            "rounded-lg px-2 py-1 text-xs font-medium",
                            f.active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/50",
                          )}
                        >
                          {f.active ? "On" : "Off"}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setEditFunnel((c) => (c?.id === f.id ? null : f))}
                            className="rounded-lg p-2 text-white/60 hover:bg-white/10"
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFunnel(f.id)}
                            className="rounded-lg p-2 text-red-400/80 hover:bg-red-500/10"
                            aria-label="Deactivate"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editFunnel?.id === f.id ? (
                      <tr className="bg-white/[0.03]">
                        <td colSpan={7} className="px-3 py-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1 text-xs text-white/50">
                              Label
                              <input
                                value={editFunnel.label}
                                onChange={(e) => setEditFunnel({ ...editFunnel, label: e.target.value })}
                                className={selectClass}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                              URL
                              <input
                                value={editFunnel.url}
                                onChange={(e) => setEditFunnel({ ...editFunnel, url: e.target.value })}
                                className={selectClass}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-white/50">
                              Platform
                              <input
                                value={editFunnel.platform}
                                onChange={(e) => setEditFunnel({ ...editFunnel, platform: e.target.value })}
                                className={selectClass}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-white/50">
                              Region
                              <select
                                value={editFunnel.region}
                                onChange={(e) =>
                                  setEditFunnel({ ...editFunnel, region: e.target.value as FunnelLink["region"] })
                                }
                                className={selectClass}
                              >
                                {REGIONS.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await patchFunnel(editFunnel.id, {
                                  label: editFunnel.label,
                                  url: editFunnel.url,
                                  platform: editFunnel.platform,
                                  region: editFunnel.region,
                                });
                                setEditFunnel(null);
                              }}
                              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditFunnel(null)}
                              className="rounded-xl px-4 py-2 text-sm text-white/60 hover:bg-white/5"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {accountModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{editingAccountId ? "Edit account" : "Add social account"}</h3>
              <button
                type="button"
                onClick={closeAccountModal}
                className="rounded-lg px-2 py-1 text-sm text-white/50 hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>
            <form onSubmit={saveAccountFromModal} className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                Model
                <select
                  value={accountDraft.model_id ?? ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    setAccountDraft((d) => ({
                      ...d,
                      model_id: id,
                      model_name: id ? modelNameById[id] ?? "" : "",
                    }));
                  }}
                  className={selectClass}
                  required
                >
                  <option value="">Select…</option>
                  {assignmentModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.model_name || m.model_id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-xs uppercase tracking-widest text-white/40">Platform *</label>
                <div className="flex flex-wrap gap-2">
                  {[...platforms]
                    .filter((p) => p.active)
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((p) => {
                      const selected = accountDraft.platform === p.name;
                      const col = p.color ?? "#888888";
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setAccountDraft((prev) => ({ ...prev, platform: p.name }))}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all",
                            selected
                              ? "scale-105 text-white"
                              : "border-white/10 bg-white/5 text-white/40 hover:bg-white/[0.08]",
                          )}
                          style={
                            selected
                              ? {
                                  backgroundColor: `${col}33`,
                                  borderColor: `${col}80`,
                                  color: col,
                                  boxShadow: `0 0 12px ${col}40`,
                                }
                              : undefined
                          }
                        >
                          <PlatformIconBadge platform={p.name} size="sm" />
                          {p.name}
                        </button>
                      );
                    })}
                </div>
                {accountDraft.platform ? (
                  <p className="mt-2 flex items-center gap-2 text-xs text-[#B8B4B8]/35">
                    Selected:
                    <PlatformIconBadge platform={accountDraft.platform} size="sm" />
                    {accountDraft.platform}
                  </p>
                ) : null}
              </div>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Username
                <input
                  value={accountDraft.username ?? ""}
                  onChange={(e) => setAccountDraft((d) => ({ ...d, username: e.target.value }))}
                  className={selectClass}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Account password
                <MaskedSecretInput
                  value={accountDraft.password ?? ""}
                  onChange={(v) => setAccountDraft((d) => ({ ...d, password: v }))}
                  className={selectClass}
                  placeholder="••••••••"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                Link
                <input
                  value={accountDraft.account_link ?? ""}
                  onChange={(e) => setAccountDraft((d) => ({ ...d, account_link: e.target.value }))}
                  className={selectClass}
                  placeholder="https://…"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Type
                <select
                  value={accountDraft.account_type ?? "main"}
                  onChange={(e) =>
                    setAccountDraft((d) => ({
                      ...d,
                      account_type: e.target.value as "main" | "secondary",
                    }))
                  }
                  className={selectClass}
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Region
                <select
                  value={accountDraft.region ?? "Global"}
                  onChange={(e) =>
                    setAccountDraft((d) => ({
                      ...d,
                      region: e.target.value as SocialAccount["region"],
                    }))
                  }
                  className={selectClass}
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                Assigned VA
                <select
                  value={accountDraft.assigned_va_id ?? ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    const u = vaUsers.find((x) => x.id === id);
                    setAccountDraft((d) => ({
                      ...d,
                      assigned_va_id: id,
                      assigned_va_name: u?.full_name?.trim() || u?.email || "",
                    }));
                  }}
                  className={selectClass}
                >
                  <option value="">—</option>
                  {vaUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                Linked phone
                <SearchablePicker
                  value={accountDraft.linked_phone_id ?? ""}
                  onChange={(id) => setAccountDraft((d) => ({ ...d, linked_phone_id: id }))}
                  items={phonePickerItems}
                  placeholder="Search device…"
                  emptyLabel="No linked phone"
                  className="w-full"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                Notes
                <input
                  value={accountDraft.notes ?? ""}
                  onChange={(e) => setAccountDraft((d) => ({ ...d, notes: e.target.value }))}
                  className={selectClass}
                />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={busy === "account-add" || (!!editingAccountId && busy === `account-${editingAccountId}`)}
                  className="rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 hover:bg-pink-400 disabled:opacity-50"
                >
                  {editingAccountId ? "Save changes" : "Add account"}
                </button>
                <button
                  type="button"
                  onClick={closeAccountModal}
                  className="rounded-xl px-4 py-2.5 text-sm text-white/60 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {phoneModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{editingPhoneId ? "Edit phone" : "Add phone"}</h3>
              <button
                type="button"
                onClick={closePhoneModal}
                className="rounded-lg px-2 py-1 text-sm text-white/50 hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>
            <form onSubmit={savePhoneFromModal} className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                Device name *
                <input
                  value={phoneDraft.device_name ?? ""}
                  onChange={(e) => setPhoneDraft((d) => ({ ...d, device_name: e.target.value }))}
                  className={selectClass}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                iCloud email
                <input
                  type="email"
                  value={phoneDraft.icloud_email ?? ""}
                  onChange={(e) => setPhoneDraft((d) => ({ ...d, icloud_email: e.target.value }))}
                  className={selectClass}
                  autoComplete="off"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                iCloud password
                <MaskedSecretInput
                  value={phoneDraft.icloud_password ?? ""}
                  onChange={(v) => setPhoneDraft((d) => ({ ...d, icloud_password: v }))}
                  className={selectClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Recovery email
                <input
                  type="email"
                  value={phoneDraft.recovery_email ?? ""}
                  onChange={(e) => setPhoneDraft((d) => ({ ...d, recovery_email: e.target.value }))}
                  className={selectClass}
                  autoComplete="off"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50">
                Recovery phone
                <input
                  value={phoneDraft.recovery_phone ?? ""}
                  onChange={(e) => setPhoneDraft((d) => ({ ...d, recovery_phone: e.target.value }))}
                  className={selectClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                Assigned VA
                <SearchablePicker
                  value={phoneDraft.assigned_va_id ?? ""}
                  onChange={(id) => setPhoneDraft((d) => ({ ...d, assigned_va_id: id }))}
                  items={vaUsers.map((u) => ({ id: u.id, label: u.full_name || u.email || u.id }))}
                  placeholder="Search VA…"
                  emptyLabel="No VA assigned"
                  className="w-full"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/50 sm:col-span-2">
                Notes
                <textarea
                  value={phoneDraft.notes ?? ""}
                  onChange={(e) => setPhoneDraft((d) => ({ ...d, notes: e.target.value }))}
                  rows={2}
                  className={cn(selectClass, "resize-none")}
                />
              </label>
              <div className="sm:col-span-2">
                <p className="mb-2 text-xs uppercase tracking-widest text-white/40">Phone photos</p>
                <button
                  type="button"
                  onClick={() => phonePhotoRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 px-4 py-5 text-sm text-white/40 transition hover:border-pink-500/35 hover:bg-pink-500/5"
                >
                  <ImageIcon className="h-5 w-5" aria-hidden />
                  {phonePhotoFiles.length
                    ? `${phonePhotoFiles.length} file(s) selected`
                    : "Tap to add photos"}
                </button>
                <input
                  ref={phonePhotoRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => setPhonePhotoFiles(Array.from(e.target.files ?? []))}
                />
              </div>
              {editingPhoneId ? (
                <label className="flex items-center gap-2 text-sm text-white/60 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={phoneDraft.active !== false}
                    onChange={(e) => setPhoneDraft((d) => ({ ...d, active: e.target.checked }))}
                    className="rounded border-white/20"
                  />
                  Active
                </label>
              ) : null}
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={busy === "phone-add" || (!!editingPhoneId && busy === `phone-${editingPhoneId}`)}
                  className="rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 hover:bg-pink-400 disabled:opacity-50"
                >
                  {editingPhoneId ? "Save changes" : "Add phone"}
                </button>
                <button
                  type="button"
                  onClick={closePhoneModal}
                  className="rounded-xl px-4 py-2.5 text-sm text-white/60 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {linkAccountModalOpen && phoneDetail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-white">Link social account</h3>
            <p className="mb-4 text-sm text-[#B8B4B8]/50">Link an existing account to {phoneDetail.device_name}</p>
            <SearchablePicker
              value={linkAccountTargetId}
              onChange={setLinkAccountTargetId}
              items={accounts
                .filter((a) => a.active && a.linked_phone_id !== phoneDetail.id)
                .map((a) => ({
                  id: a.id,
                  label: `@${a.username} · ${a.platform} · ${a.model_name}`,
                }))}
              placeholder="Search account…"
              emptyLabel="Select account"
              className="mb-4 w-full"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!linkAccountTargetId || busy === `link-${linkAccountTargetId}`}
                onClick={() => void handleLinkAccountToPhone(linkAccountTargetId, phoneDetail.id)}
                className="flex-1 rounded-xl bg-pink-500 py-2.5 text-sm font-semibold text-white hover:bg-pink-400 disabled:opacity-40"
              >
                Link account
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkAccountModalOpen(false);
                  setLinkAccountTargetId("");
                }}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shadowbanReportTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-white">Report shadowban</h3>
            <div className="mb-5 flex items-center gap-2">
              <PlatformIconBadge platform={shadowbanReportTarget.platform} size="sm" />
              <p className="text-sm text-[#B8B4B8]/55">
                @{shadowbanReportTarget.username} · {shadowbanReportTarget.platform}
              </p>
            </div>
            <div className="mb-4">
              <label className="mb-2 block text-xs uppercase tracking-widest text-white/40">
                Screenshot <span className="text-amber-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => shadowbanProofRef.current?.click()}
                className={cn(
                  "w-full cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-all",
                  shadowbanFile ? "border-amber-500/40 bg-amber-500/5" : "border-white/15 hover:border-amber-500/40 hover:bg-amber-500/5",
                )}
              >
                {shadowbanPreviewUrl ? (
                  <img
                    src={shadowbanPreviewUrl}
                    alt=""
                    className="mx-auto max-h-28 rounded-xl object-contain"
                  />
                ) : (
                  <>
                    <p className="mb-1 flex justify-center"><ClipboardList className="h-8 w-8 text-white/30" aria-hidden /></p>
                    <p className="text-sm text-white/40">Paste (Ctrl+V) or tap</p>
                  </>
                )}
              </button>
              <input
                ref={shadowbanProofRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setShadowbanFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="mb-5">
              <label className="mb-2 block text-xs uppercase tracking-widest text-white/40">Notes</label>
              <textarea
                value={shadowbanNotes}
                onChange={(e) => setShadowbanNotes(e.target.value)}
                rows={2}
                placeholder="What did you notice?"
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleSubmitShadowbanReportAdmin()}
                disabled={!shadowbanFile || shadowbanSubmitting}
                className="flex-1 rounded-2xl border border-amber-500/30 bg-amber-500/20 py-3 font-bold text-amber-400 hover:bg-amber-500/30 disabled:opacity-40"
              >
                {shadowbanSubmitting ? "Submitting…" : "Submit report"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShadowbanReportTarget(null);
                  setShadowbanFile(null);
                  setShadowbanNotes("");
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-white/50 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteModal
        open={deleteReportId != null}
        title="Delete shadowban report?"
        description="This permanently removes the report from Airtable. The social account status will not change."
        confirmLabel="Delete report"
        confirming={deleteReportBusy}
        onClose={() => {
          if (!deleteReportBusy) setDeleteReportId(null);
        }}
        onConfirm={() => {
          if (deleteReportId) void handleDeleteReport(deleteReportId);
        }}
      />

      <ConfirmDeleteModal
        open={deletePhoneId != null}
        title="Delete phone?"
        description="This permanently removes the phone from Airtable. Linked social accounts will be unlinked."
        confirmLabel="Delete phone"
        confirming={deletePhoneBusy}
        onClose={() => {
          if (!deletePhoneBusy) setDeletePhoneId(null);
        }}
        onConfirm={() => {
          if (deletePhoneId) void handleDeletePhone(deletePhoneId);
        }}
      />

      {screenshotPreview ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close screenshot"
            onClick={() => setScreenshotPreview(null)}
          />
          <div className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-[#0D0B0D] p-2 shadow-2xl">
            <button
              type="button"
              onClick={() => setScreenshotPreview(null)}
              className="absolute right-3 top-3 rounded-lg bg-black/60 p-2 text-white/80 hover:bg-black/80"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <img src={screenshotPreview} alt="Report screenshot" className="max-h-[85vh] w-full object-contain" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
