"use client";

import * as React from "react";
import {
  ExternalLink,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  RefreshCw,
  Smartphone,
  UserCheck,
} from "lucide-react";
import {
  FindingCard,
  ReviewFieldLabel,
  ReviewPageEyebrow,
  ReviewSectionHeader,
} from "@/components/manager-review-ui";
import { PlatformIconBadge } from "@/components/social-platform-icon";
import { copyTextToClipboard } from "@/lib/winner-videos-copy";
import { WinnerVideoCopyButton } from "@/components/winner-videos-shared";
import type { Phone, SocialAccount, SocialAccountStatus } from "@/services/marketing";
import type { ModelProfileGroup, MyProfilesData } from "@/services/my-profiles";
import {
  VA_CARD,
  VA_CHAMPAGNE_DIVIDER,
  VA_MODEL_TAG,
  VA_STATUS_BADGE,
} from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<
  SocialAccountStatus,
  { badgeClass: string; label: string }
> = {
  active: {
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    label: "Active",
  },
  shadowbanned: {
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    label: "Shadowbanned",
  },
  banned: {
    badgeClass: "border-red-500/30 bg-red-500/10 text-red-300",
    label: "Banned",
  },
};

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

function MaskedCredential({
  value,
  mode = "secret",
  label,
}: {
  value: string;
  mode?: "secret" | "email";
  label: string;
}) {
  const [revealed, setRevealed] = React.useState(false);
  const display = !value ? "—" : revealed ? value : mode === "email" ? maskEmail(value) : maskSecret(value);

  async function handleCopy() {
    if (!value) return;
    await copyTextToClipboard(value);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <ReviewFieldLabel className="text-[10px] uppercase tracking-widest">{label}</ReviewFieldLabel>
        <p className="mt-1 break-all font-mono text-sm text-[#B8B4B8]/85">{display}</p>
      </div>
      {value ? (
        <div className="flex shrink-0 items-center gap-1">
          <WinnerVideoCopyButton onClick={() => void handleCopy()} label={`Copy ${label.toLowerCase()}`} />
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-[#0D0B0D]/60 p-1.5 text-[#B8B4B8]/55 transition hover:border-[#D4AF8C]/30 hover:bg-[#D4AF8C]/8 hover:text-[#D4AF8C]"
            aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FileLinkChip({ href, index }: { href: string; index: number }) {
  const label = `Link ${index + 1}`;
  let host = href;
  try {
    host = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw */
  }

  async function handleCopy() {
    await copyTextToClipboard(href);
  }

  return (
    <div className="flex items-center gap-1.5">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#D4AF8C]/25 bg-[#D4AF8C]/8 px-2.5 py-1.5 text-xs font-medium text-[#D4AF8C] transition hover:border-[#D4AF8C]/40 hover:bg-[#D4AF8C]/12"
        title={href}
      >
        <Link2 className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
        <span className="truncate text-[#D4AF8C]/55">· {host}</span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
      </a>
      <WinnerVideoCopyButton onClick={() => void handleCopy()} label={`Copy ${label}`} />
    </div>
  );
}

function SocialAccountRow({ account }: { account: SocialAccount }) {
  const status = STATUS_STYLES[account.account_status];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0D0B0D]/50 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <PlatformIconBadge platform={account.platform} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">@{account.username || "—"}</p>
            <p className="text-xs text-[#B8B4B8]/45">{account.platform}</p>
          </div>
        </div>
        <span className={cn(VA_STATUS_BADGE, status.badgeClass)}>{status.label}</span>
      </div>
      <div className="space-y-3">
        {account.password ? <MaskedCredential value={account.password} label="Password" /> : null}
        {account.account_link ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ReviewFieldLabel className="text-[10px] uppercase tracking-widest">Profile link</ReviewFieldLabel>
            <div className="flex items-center gap-1">
              <a
                href={account.account_link}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#D4AF8C] hover:underline"
              >
                Open
              </a>
              <WinnerVideoCopyButton
                onClick={() => void copyTextToClipboard(account.account_link)}
                label="Copy profile link"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ModelCard({ group }: { group: ModelProfileGroup }) {
  return (
    <FindingCard>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className={VA_MODEL_TAG}>{group.model_name}</span>
          <p className="mt-2 text-xs text-[#B8B4B8]/45">
            {group.accounts.length} social account{group.accounts.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className={cn(VA_CHAMPAGNE_DIVIDER, "mb-4")} />
      <div className="space-y-2">
        {group.accounts.map((account) => (
          <SocialAccountRow key={account.id} account={account} />
        ))}
      </div>
    </FindingCard>
  );
}

function PhoneCard({ phone }: { phone: Phone }) {
  return (
    <FindingCard>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-pink-500/20 bg-gradient-to-br from-pink-500/15 to-rose-500/15">
            <Smartphone className="h-5 w-5 text-pink-400" aria-hidden />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{phone.device_name || "Device"}</h3>
            <p className="text-xs text-[#B8B4B8]/45">Assigned phone</p>
          </div>
        </div>
        <span
          className={cn(
            VA_STATUS_BADGE,
            phone.active
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-white/15 bg-white/5 text-[#B8B4B8]/50",
          )}
        >
          {phone.active ? "Active" : "Inactive"}
        </span>
      </div>
      <div className={cn(VA_CHAMPAGNE_DIVIDER, "mb-4")} />
      <div className="space-y-4">
        <MaskedCredential value={phone.icloud_email} mode="email" label="iCloud email" />
        <MaskedCredential value={phone.icloud_password} label="iCloud password" />
        {phone.file_links.length > 0 ? (
          <div>
            <ReviewFieldLabel className="text-[10px] uppercase tracking-widest">File links</ReviewFieldLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {phone.file_links.map((link, index) => (
                <FileLinkChip key={`${link}-${index}`} href={link} index={index} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </FindingCard>
  );
}

export function MyProfilesClient({ initialData }: { initialData: MyProfilesData }) {
  const [data, setData] = React.useState(initialData);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/my-profiles", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const next = (await res.json()) as MyProfilesData;
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh profiles");
    } finally {
      setLoading(false);
    }
  }

  const empty = data.models.length === 0 && data.phones.length === 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <ReviewPageEyebrow>Virtual assistant</ReviewPageEyebrow>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">My Profiles</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#B8B4B8]/60">
            Your assigned creators, social logins, and devices — everything you need in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[#B8B4B8]/75 transition hover:border-[#D4AF8C]/25 hover:text-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {empty ? (
        <div className={cn(VA_CARD, "py-16 text-center")}>
          <p className="mb-4 flex justify-center">
            <UserCheck className="h-12 w-12 text-[#D4AF8C]/35" aria-hidden />
          </p>
          <p className="text-lg text-[#B8B4B8]/75">Nothing assigned yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#B8B4B8]/45">
            When your manager assigns models, social accounts, or phones to you, they&apos;ll show up here with
            credentials ready to copy.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {data.models.length > 0 ? (
            <section className="space-y-4">
              <ReviewSectionHeader>Assigned models</ReviewSectionHeader>
              <div className="grid gap-4 md:grid-cols-2">
                {data.models.map((group) => (
                  <ModelCard key={group.model_id} group={group} />
                ))}
              </div>
            </section>
          ) : null}

          {data.phones.length > 0 ? (
            <section className="space-y-4">
              <ReviewSectionHeader>Assigned phones</ReviewSectionHeader>
              <div className="grid gap-4 md:grid-cols-2">
                {data.phones.map((phone) => (
                  <PhoneCard key={phone.id} phone={phone} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
