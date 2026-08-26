"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Check,
  Globe,
  Instagram,
  KeyRound,
  Link2,
  SkipForward,
  Trophy,
  Users,
  UserPlus,
} from "lucide-react";
import { createModel, updateModel, getModelById } from "@/services/modelss";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { btnSecondaryClass, formSpace, selectOptionClass } from "@/components/ui/form";
import {
  DEFAULT_MODEL_WINNER_THRESHOLDS,
  WINNER_VIEW_THRESHOLD,
  SUPER_WINNER_VIEW_THRESHOLD,
} from "@/lib/winner-sourcing-helpers";

const STEPS = [
  { key: "basic", label: "Basic info", icon: UserPlus },
  { key: "infloww", label: "Infloww", icon: Link2 },
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "thresholds", label: "Winner thresholds", icon: Trophy },
  { key: "passwords", label: "Password Library", icon: KeyRound },
  { key: "team", label: "Team", icon: Users },
  { key: "story", label: "Story CTA", icon: Globe },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const PLATFORMS = ["onlyfans", "fanvue", "other"] as const;
const STATUS_OPTIONS = ["active", "inactive"] as const;

function progressKey(modelId: string) {
  return `model-onboarding:${modelId}`;
}

function loadSkipped(modelId: string): StepKey[] {
  try {
    const raw = localStorage.getItem(progressKey(modelId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { skipped?: StepKey[]; step?: number };
    return Array.isArray(parsed.skipped) ? parsed.skipped : [];
  } catch {
    return [];
  }
}

function saveProgress(modelId: string, step: number, skipped: StepKey[]) {
  try {
    localStorage.setItem(progressKey(modelId), JSON.stringify({ step, skipped }));
  } catch {
    // ignore
  }
}

export function ModelOnboardingWizard({
  initialModelId,
  initialStep = 0,
}: {
  initialModelId?: string;
  initialStep?: number;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(initialStep);
  const [modelId, setModelId] = React.useState(initialModelId ?? "");
  const [modelName, setModelName] = React.useState("");
  const [skipped, setSkipped] = React.useState<StepKey[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form fields
  const [platform, setPlatform] = React.useState("onlyfans");
  const [status, setStatus] = React.useState("active");
  const [notes, setNotes] = React.useState("");
  const [inflowwId, setInflowwId] = React.useState("");
  const [igAccounts, setIgAccounts] = React.useState("");
  const [winnerViews, setWinnerViews] = React.useState(String(WINNER_VIEW_THRESHOLD));
  const [superWinnerViews, setSuperWinnerViews] = React.useState(
    String(SUPER_WINNER_VIEW_THRESHOLD),
  );
  const [credCategory, setCredCategory] = React.useState("OnlyFans");
  const [credLabel, setCredLabel] = React.useState("");
  const [credUsername, setCredUsername] = React.useState("");
  const [credPassword, setCredPassword] = React.useState("");
  const [team, setTeam] = React.useState<"gunzo_team" | "chatting_agency">("gunzo_team");
  const [linkA, setLinkA] = React.useState("");
  const [linkB, setLinkB] = React.useState("");

  React.useEffect(() => {
    if (!initialModelId) return;
    setSkipped(loadSkipped(initialModelId));
    void (async () => {
      try {
        const m = await getModelById(initialModelId);
        if (!m) return;
        setModelName(m.model_name || "");
        setInflowwId(m.infloww_creator_id?.trim() || "");
        setTeam(m.team === "chatting_agency" ? "chatting_agency" : "gunzo_team");
        setPlatform(m.platform || "onlyfans");
        setStatus(m.status || "active");
      } catch {
        // ignore
      }
    })();
  }, [initialModelId]);

  function goNext() {
    const next = Math.min(step + 1, STEPS.length - 1);
    setStep(next);
    if (modelId) saveProgress(modelId, next, skipped);
  }

  function skipStep() {
    const key = STEPS[step]!.key;
    const nextSkipped = skipped.includes(key) ? skipped : [...skipped, key];
    setSkipped(nextSkipped);
    if (modelId) saveProgress(modelId, step + 1, nextSkipped);
    if (step >= STEPS.length - 1) {
      finish();
      return;
    }
    setStep(step + 1);
  }

  function finish() {
    if (modelId) {
      try {
        localStorage.removeItem(progressKey(modelId));
      } catch {
        // ignore
      }
      router.push(ROUTES.admin.modelDetail(modelId));
    } else {
      router.push(ROUTES.accountsModelss);
    }
    router.refresh();
  }

  async function submitBasic(e: React.FormEvent) {
    e.preventDefault();
    const name = modelName.trim();
    if (!name) return;
    setPending(true);
    setError(null);
    try {
      if (modelId) {
        await updateModel(modelId, {
          model_name: name,
          platform,
          status,
          notes,
        });
      } else {
        const created = await createModel({
          model_name: name,
          platform,
          status,
          notes,
        });
        setModelId(created.id);
        saveProgress(created.id, 1, []);
      }
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create model");
    } finally {
      setPending(false);
    }
  }

  async function submitInfloww(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId) return;
    setPending(true);
    setError(null);
    try {
      await updateModel(modelId, {
        infloww_creator_id: inflowwId.trim() || null,
      });
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Infloww link");
    } finally {
      setPending(false);
    }
  }

  async function submitInstagram(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId) return;
    setPending(true);
    setError(null);
    try {
      const lines = igAccounts
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const accounts = lines.map((ig_user_id, i) => ({
        clariosuite_ig_user_id: ig_user_id,
        account_label: lines.length > 1 ? `Account ${i + 1}` : "Primary",
        is_primary: i === 0,
      }));
      if (accounts.length > 0) {
        const res = await fetch(`/api/admin/models/${encodeURIComponent(modelId)}/clariosuite-accounts`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accounts }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to save IG accounts");
      }
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Instagram");
    } finally {
      setPending(false);
    }
  }

  async function submitThresholds(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/models/${encodeURIComponent(modelId)}/winner-thresholds`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winner_threshold_views: Number(winnerViews) || DEFAULT_MODEL_WINNER_THRESHOLDS.winner_threshold_views,
          super_winner_threshold_views:
            Number(superWinnerViews) ||
            DEFAULT_MODEL_WINNER_THRESHOLDS.super_winner_threshold_views,
        }),
      });
      if (!res.ok) {
        // Fallback: try upsert via a soft skip if endpoint missing
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status !== 404) throw new Error(data.error || "Failed to save thresholds");
      }
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save thresholds");
    } finally {
      setPending(false);
    }
  }

  async function submitPasswords(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId) return;
    setPending(true);
    setError(null);
    try {
      if (credLabel.trim()) {
        const res = await fetch("/api/admin/credentials", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model_id: modelId,
            category: credCategory.trim() || "OnlyFans",
            label: credLabel.trim(),
            data: {
              username: credUsername.trim() || undefined,
              password: credPassword.trim() || undefined,
            },
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to add credential");
        // Clear secrets from local state immediately
        setCredPassword("");
        setCredUsername("");
      }
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save credential");
    } finally {
      setPending(false);
    }
  }

  async function submitTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId) return;
    setPending(true);
    setError(null);
    try {
      await updateModel(modelId, { team });
      goNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save team");
    } finally {
      setPending(false);
    }
  }

  async function submitStory(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/models/${encodeURIComponent(modelId)}/story-link-config`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          link_a_url: linkA.trim() || null,
          link_b_url: linkB.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to save story links");
      finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save story links");
    } finally {
      setPending(false);
    }
  }

  const current = STEPS[step]!;
  const pct = Math.round(((step + (modelId ? 1 : 0)) / STEPS.length) * 100);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e91e8c]/80">
          Model onboarding
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">
          {modelName ? modelName : "New model"}
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Step {step + 1} of {STEPS.length} — {current.label}
        </p>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#e91e8c] to-[#ff6bb5] transition-all"
          style={{ width: `${Math.min(100, Math.max(8, pct))}%` }}
        />
      </div>

      <ol className="flex flex-wrap gap-1.5">
        {STEPS.map((s, i) => {
          const done = i < step || skipped.includes(s.key);
          const active = i === step;
          return (
            <li
              key={s.key}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                active && "bg-[#e91e8c]/25 text-pink-100",
                done && !active && "bg-white/10 text-white/50",
                !done && !active && "bg-white/5 text-white/30",
              )}
            >
              {done && !active ? <Check className="mr-0.5 inline h-2.5 w-2.5" /> : null}
              {s.label}
            </li>
          );
        })}
      </ol>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        {error ? (
          <p className="mb-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        {current.key === "basic" ? (
          <form onSubmit={submitBasic} className={cn(formSpace, "space-y-4")}>
            <FormField label="Model name" icon={<UserPlus />} htmlFor="ob_name" required>
              <FormInput
                id="ob_name"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                required
                placeholder="Display name"
              />
            </FormField>
            <FormField label="Platform" icon={<Globe />} htmlFor="ob_platform">
              <FormSelect
                id="ob_platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p} className={selectOptionClass}>
                    {p}
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Status" icon={<Activity />} htmlFor="ob_status">
              <FormSelect id="ob_status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} className={selectOptionClass}>
                    {s}
                  </option>
                ))}
              </FormSelect>
            </FormField>
            <FormField label="Notes" htmlFor="ob_notes" description="Optional" icon={<Globe />}>
              <FormTextarea
                id="ob_notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </FormField>
            <FormSubmitButton disabled={pending} loading={pending} className="w-full">
              {modelId ? "Save & continue" : "Create model & continue"}
            </FormSubmitButton>
          </form>
        ) : null}

        {current.key === "infloww" ? (
          <form onSubmit={submitInfloww} className="space-y-4">
            <p className="text-sm text-white/55">
              Link the Infloww creator id so earnings sync attaches to this model.
            </p>
            <FormField label="Infloww creator ID" htmlFor="ob_infloww" icon={<Link2 />}>
              <FormInput
                id="ob_infloww"
                value={inflowwId}
                onChange={(e) => setInflowwId(e.target.value)}
                placeholder="e.g. creator uuid from Infloww"
              />
            </FormField>
            <FormSubmitButton disabled={pending} loading={pending} className="w-full">
              Save & continue
            </FormSubmitButton>
          </form>
        ) : null}

        {current.key === "instagram" ? (
          <form onSubmit={submitInstagram} className="space-y-4">
            <p className="text-sm text-white/55">
              Add ClarioSuite Instagram user ids (one per line). Multi-account supported.
            </p>
            <FormField label="IG user IDs" htmlFor="ob_ig" icon={<Instagram />}>
              <FormTextarea
                id="ob_ig"
                rows={3}
                value={igAccounts}
                onChange={(e) => setIgAccounts(e.target.value)}
                placeholder={"17841…\n17842…"}
              />
            </FormField>
            <FormSubmitButton disabled={pending} loading={pending} className="w-full">
              Save & continue
            </FormSubmitButton>
          </form>
        ) : null}

        {current.key === "thresholds" ? (
          <form onSubmit={submitThresholds} className="space-y-4">
            <p className="text-sm text-white/55">
              Defaults are {WINNER_VIEW_THRESHOLD.toLocaleString()} /{" "}
              {SUPER_WINNER_VIEW_THRESHOLD.toLocaleString()} views.
            </p>
            <FormField label="Winner threshold (views)" htmlFor="ob_win" icon={<Trophy />}>
              <FormInput
                id="ob_win"
                type="number"
                value={winnerViews}
                onChange={(e) => setWinnerViews(e.target.value)}
              />
            </FormField>
            <FormField label="Super Winner threshold (views)" htmlFor="ob_super" icon={<Trophy />}>
              <FormInput
                id="ob_super"
                type="number"
                value={superWinnerViews}
                onChange={(e) => setSuperWinnerViews(e.target.value)}
              />
            </FormField>
            <FormSubmitButton disabled={pending} loading={pending} className="w-full">
              Save & continue
            </FormSubmitButton>
          </form>
        ) : null}

        {current.key === "passwords" ? (
          <form onSubmit={submitPasswords} className="space-y-4">
            <p className="text-sm text-white/55">
              Quick-add one Password Library entry. Secrets are encrypted server-side — never
              stored in notes or URLs.
            </p>
            <FormField label="Category" htmlFor="ob_cat" icon={<KeyRound />}>
              <FormInput
                id="ob_cat"
                value={credCategory}
                onChange={(e) => setCredCategory(e.target.value)}
              />
            </FormField>
            <FormField label="Label" htmlFor="ob_cred_label" icon={<KeyRound />}>
              <FormInput
                id="ob_cred_label"
                value={credLabel}
                onChange={(e) => setCredLabel(e.target.value)}
                placeholder="e.g. Main OF login"
              />
            </FormField>
            <FormField label="Username" htmlFor="ob_user" icon={<KeyRound />}>
              <FormInput
                id="ob_user"
                value={credUsername}
                onChange={(e) => setCredUsername(e.target.value)}
                autoComplete="off"
              />
            </FormField>
            <FormField label="Password" htmlFor="ob_pass" icon={<KeyRound />}>
              <FormInput
                id="ob_pass"
                type="password"
                value={credPassword}
                onChange={(e) => setCredPassword(e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
            <FormSubmitButton disabled={pending} loading={pending} className="w-full">
              {credLabel.trim() ? "Save credential & continue" : "Continue without credential"}
            </FormSubmitButton>
          </form>
        ) : null}

        {current.key === "team" ? (
          <form onSubmit={submitTeam} className="space-y-4">
            <FormField label="Team assignment" htmlFor="ob_team" icon={<Users />}>
              <FormSelect
                id="ob_team"
                value={team}
                onChange={(e) =>
                  setTeam(e.target.value === "chatting_agency" ? "chatting_agency" : "gunzo_team")
                }
              >
                <option value="gunzo_team" className={selectOptionClass}>
                  Gunzo team
                </option>
                <option value="chatting_agency" className={selectOptionClass}>
                  Chatting agency
                </option>
              </FormSelect>
            </FormField>
            <FormSubmitButton disabled={pending} loading={pending} className="w-full">
              Save & continue
            </FormSubmitButton>
          </form>
        ) : null}

        {current.key === "story" ? (
          <form onSubmit={submitStory} className="space-y-4">
            <p className="text-sm text-white/55">Story CTA Link A/B for Instagram stories.</p>
            <FormField label="Link A URL" htmlFor="ob_a" icon={<Link2 />}>
              <FormInput
                id="ob_a"
                value={linkA}
                onChange={(e) => setLinkA(e.target.value)}
                placeholder="https://"
              />
            </FormField>
            <FormField label="Link B URL" htmlFor="ob_b" icon={<Link2 />}>
              <FormInput
                id="ob_b"
                value={linkB}
                onChange={(e) => setLinkB(e.target.value)}
                placeholder="https://"
              />
            </FormField>
            <FormSubmitButton disabled={pending} loading={pending} className="w-full">
              Finish onboarding
            </FormSubmitButton>
          </form>
        ) : null}

        {current.key !== "basic" ? (
          <button
            type="button"
            onClick={skipStep}
            disabled={pending}
            className={cn(
              btnSecondaryClass,
              "mt-3 flex w-full items-center justify-center gap-2",
            )}
          >
            <SkipForward className="h-4 w-4" />
            I&apos;ll do this later
          </button>
        ) : null}
      </div>

      <div className="flex justify-between text-sm">
        <Link href={ROUTES.accountsModelss} className="text-white/45 hover:text-white/80">
          ← Back to accounts
        </Link>
        {modelId ? (
          <Link
            href={ROUTES.admin.modelDetail(modelId)}
            className="text-pink-300/80 hover:underline"
          >
            Open model
          </Link>
        ) : null}
      </div>
    </div>
  );
}
