"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  Info,
  Lock,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  PERSONA_AI_FEED_HINTS,
  PERSONA_DESCRIPTIVE_HINT,
  PERSONA_SECTION_LABELS,
  PERSONA_SECTIONS,
  SENSITIVE_PERSONA_SECTIONS,
  MAX_ACTIVE_LIVE_UPDATES,
  type PersonaAiContextFlags,
  type PersonaSectionData,
  type PersonaSectionKey,
  type ModelPersonaLiveUpdate,
} from "@/lib/persona-types";
import { ROUTES } from "@/lib/routes";
import { VA_BTN_PRIMARY, VA_BTN_SECONDARY, VA_CARD, VA_FILTER_INPUT, VA_TASKS } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

type Props = {
  modelId: string;
  modelName: string;
  personaId: string;
  initialSections: PersonaSectionData;
  aiContextFlags: PersonaAiContextFlags;
  lastUpdatedAt: string;
  lastUpdatedByName: string;
  liveUpdates: ModelPersonaLiveUpdate[];
  revisions: Array<{ id: string; created_at: string; saved_by_name: string }>;
  personaTypes: string[];
  chattingStrategies: string[];
  canViewSensitive: boolean;
  canEditSensitive: boolean;
  canManage: boolean;
  readOnly: boolean;
};

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
        {children}
      </label>
      {hint ? (
        <span title={hint} className="text-white/30">
          <Info className="h-3 w-3" aria-hidden />
        </span>
      ) : null}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(VA_FILTER_INPUT, "w-full", props.className)}
      disabled={props.disabled}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        VA_FILTER_INPUT,
        "min-h-[88px] w-full resize-y whitespace-pre-wrap leading-relaxed",
        props.className,
      )}
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-[#B8B4B8]">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 rounded-full transition",
          checked ? "bg-[#FF1493]" : "bg-white/15",
          disabled && "opacity-40",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition",
            checked ? "left-4" : "left-0.5",
          )}
        />
      </button>
      {label}
    </label>
  );
}

function TagInput({
  values,
  onChange,
  placeholder,
  disabled,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = React.useState("");
  function add() {
    const t = draft.trim();
    if (!t || values.includes(t)) return;
    onChange([...values, t]);
    setDraft("");
  }
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-md border border-[#D4AF8C]/35 bg-[#D4AF8C]/[0.06] px-2 py-0.5 text-xs text-[#D4AF8C]"
          >
            {v}
            {!disabled && (
              <button
                type="button"
                className="text-[#D4AF8C]/70 hover:text-white"
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <Input
            value={draft}
            placeholder={placeholder ?? "Add…"}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <button type="button" className={cn(VA_BTN_SECONDARY, "px-3 py-0")} onClick={add}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function completenessForSection(
  key: PersonaSectionKey,
  sections: PersonaSectionData,
  liveCount: number,
): number {
  if (key === "live_updates") return liveCount > 0 ? 1 : 0;
  if (key === "bio") return sections.bio.trim() ? 1 : 0;

  const obj =
    key === "personal_info"
      ? sections.personal_info
      : key === "chatting"
        ? sections.chatting
        : key === "lifestyle"
          ? sections.lifestyle
          : key === "physique"
            ? sections.physique
            : key === "content"
              ? sections.content
              : key === "intimate_details"
                ? sections.intimate_details
                : sections.socials;

  const entries = Object.entries(obj as Record<string, unknown>).filter(([, v]) => {
    if (v == null || v === "") return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "boolean") return true;
    return String(v).trim().length > 0;
  });
  // Heuristic: ~8 meaningful fields ≈ complete
  return Math.min(1, entries.length / 8);
}

function CompletenessRing({ value, size = 36 }: { value: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.round(value * 100);
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90" aria-label={`${pct}% complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#D4AF8C"
        strokeWidth={3}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PersonaEditorClient(props: Props) {
  const [sections, setSections] = React.useState<PersonaSectionData>(props.initialSections);
  const [flags, setFlags] = React.useState(props.aiContextFlags);
  const [active, setActive] = React.useState<PersonaSectionKey>("bio");
  const [live, setLive] = React.useState(props.liveUpdates);
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState(props.lastUpdatedAt);
  const [lastUpdatedByName, setLastUpdatedByName] = React.useState(props.lastUpdatedByName);
  const [showInactiveLive, setShowInactiveLive] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const draftTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = React.useRef(false);

  const visibleSections = PERSONA_SECTIONS.filter((k) => {
    if (SENSITIVE_PERSONA_SECTIONS.includes(k as (typeof SENSITIVE_PERSONA_SECTIONS)[number])) {
      return props.canViewSensitive;
    }
    return true;
  });

  const scores = visibleSections.map((k) =>
    completenessForSection(k, sections, live.filter((l) => l.is_live).length),
  );
  const overall = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const patchSection = React.useCallback(
    <K extends keyof PersonaSectionData>(key: K, value: PersonaSectionData[K]) => {
      dirty.current = true;
      setSections((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Autosave draft
  React.useEffect(() => {
    if (props.readOnly || !dirty.current) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      void persist({ draftOnly: true });
    }, 1800);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, flags]);

  async function persist(opts: { draftOnly?: boolean; explicitSave?: boolean }) {
    if (props.readOnly) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/personas/${encodeURIComponent(props.modelId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sections,
          ai_context_flags: flags,
          draftOnly: opts.draftOnly === true,
          explicitSave: opts.explicitSave === true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        persona?: { updated_at?: string; last_updated_by_name?: string };
      };
      if (!res.ok) {
        setSaveMsg(data.error ?? "Save failed");
        return;
      }
      if (opts.explicitSave) {
        dirty.current = false;
        setSaveMsg("Saved");
        if (data.persona?.updated_at) setLastUpdatedAt(data.persona.updated_at);
        if (data.persona?.last_updated_by_name) setLastUpdatedByName(data.persona.last_updated_by_name);
      } else if (opts.draftOnly) {
        setSaveMsg("Draft autosaved");
      }
    } catch {
      setSaveMsg("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function addLiveUpdate(form: {
    content: string;
    status: string;
    starts_at: string;
    ends_at: string;
  }) {
    const res = await fetch(`/api/personas/${encodeURIComponent(props.modelId)}/live-updates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      liveUpdate?: ModelPersonaLiveUpdate;
    };
    if (!res.ok) {
      setSaveMsg(data.error ?? "Could not add live update");
      return;
    }
    if (data.liveUpdate) setLive((prev) => [data.liveUpdate!, ...prev]);
  }

  async function patchLive(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/personas/${encodeURIComponent(props.modelId)}/live-updates`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      liveUpdate?: ModelPersonaLiveUpdate;
      ok?: boolean;
    };
    if (patch.delete) {
      setLive((prev) => prev.filter((l) => l.id !== id));
      return;
    }
    if (data.liveUpdate) {
      setLive((prev) => prev.map((l) => (l.id === id ? data.liveUpdate! : l)));
    }
  }

  const pi = sections.personal_info;
  const ch = sections.chatting;
  const life = sections.lifestyle;
  const phy = sections.physique;
  const content = sections.content;
  const intimate = sections.intimate_details;
  const socials = sections.socials;

  const filteredLive = showInactiveLive ? live : live.filter((l) => l.is_live);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 md:flex-row md:px-6 md:py-6">
      {/* Section nav */}
      <aside className="md:w-52 md:shrink-0">
        <Link
          href={ROUTES.personas}
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-[#D4AF8C]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All personas
        </Link>
        <div className="mb-3 flex items-center gap-3">
          <CompletenessRing value={overall} size={44} />
          <div>
            <p className="text-sm font-medium text-white">{props.modelName}</p>
            <p className="text-[11px]" style={{ color: VA_TASKS.bodyMuted }}>
              {Math.round(overall * 100)}% complete
            </p>
          </div>
        </div>

        {/* Mobile chips */}
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
          {visibleSections.map((k, i) => (
            <button
              key={k}
              type="button"
              onClick={() => setActive(k)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium",
                active === k
                  ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-white"
                  : "border-white/10 text-white/55",
              )}
            >
              {PERSONA_SECTION_LABELS[k]}
              <span className="ml-1 text-white/35">{Math.round(scores[i]! * 100)}</span>
            </button>
          ))}
        </div>

        <nav className="hidden space-y-0.5 md:block">
          {visibleSections.map((k, i) => {
            const sensitive = SENSITIVE_PERSONA_SECTIONS.includes(
              k as (typeof SENSITIVE_PERSONA_SECTIONS)[number],
            );
            return (
              <button
                key={k}
                type="button"
                onClick={() => setActive(k)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition",
                  active === k ? "bg-white/[0.06] text-white" : "text-white/50 hover:text-white/80",
                )}
              >
                <CompletenessRing value={scores[i]!} size={22} />
                <span className="flex-1 truncate">{PERSONA_SECTION_LABELS[k]}</span>
                {sensitive && <Lock className="h-3 w-3 text-white/30" aria-label="Sensitive" />}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Editor pane */}
      <main className="min-w-0 flex-1">
        <div className={cn(VA_CARD, "p-4 md:p-6")}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-white">
                  {PERSONA_SECTION_LABELS[active]}
                </h1>
                {SENSITIVE_PERSONA_SECTIONS.includes(
                  active as (typeof SENSITIVE_PERSONA_SECTIONS)[number],
                ) && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">
                    <Lock className="h-3 w-3" /> Sensitive
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs" style={{ color: VA_TASKS.bodyMuted }}>
                {PERSONA_DESCRIPTIVE_HINT}
                {PERSONA_AI_FEED_HINTS[active] ? ` · ${PERSONA_AI_FEED_HINTS[active]}` : ""}
              </p>
              {(lastUpdatedAt || lastUpdatedByName) && (
                <p className="mt-1 text-[11px] text-white/30">
                  Last updated {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : "—"}
                  {lastUpdatedByName ? ` by ${lastUpdatedByName}` : ""}
                </p>
              )}
            </div>
            {!props.readOnly && (
              <div className="flex items-center gap-2">
                {saveMsg && (
                  <span className="text-[11px] text-white/40">{saving ? "Saving…" : saveMsg}</span>
                )}
                <button
                  type="button"
                  className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-2 px-4 py-2.5")}
                  disabled={saving}
                  onClick={() => void persist({ explicitSave: true })}
                >
                  <Save className="h-4 w-4" /> Save
                </button>
              </div>
            )}
          </div>

          {active === "bio" && (
            <TextArea
              value={sections.bio}
              disabled={props.readOnly}
              placeholder="Short bio in her voice…"
              onChange={(e) => patchSection("bio", e.target.value)}
            />
          )}

          {active === "personal_info" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Name</FieldLabel>
                  <Input
                    value={pi.name ?? ""}
                    disabled={props.readOnly}
                    onChange={(e) =>
                      patchSection("personal_info", { ...pi, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <FieldLabel>Gender</FieldLabel>
                  <Input
                    value={pi.gender ?? ""}
                    disabled={props.readOnly}
                    onChange={(e) =>
                      patchSection("personal_info", { ...pi, gender: e.target.value })
                    }
                  />
                </div>
                <div>
                  <FieldLabel hint="Required · 18+ for AI generation">Birth date</FieldLabel>
                  <Input
                    type="date"
                    value={pi.birth_date ?? ""}
                    disabled={props.readOnly}
                    onChange={(e) =>
                      patchSection("personal_info", { ...pi, birth_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <FieldLabel>Timezone</FieldLabel>
                  <Input
                    value={pi.timezone ?? ""}
                    disabled={props.readOnly}
                    onChange={(e) =>
                      patchSection("personal_info", { ...pi, timezone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <FieldLabel>Country</FieldLabel>
                  <Input
                    value={pi.country ?? ""}
                    disabled={props.readOnly}
                    onChange={(e) =>
                      patchSection("personal_info", { ...pi, country: e.target.value })
                    }
                  />
                </div>
                <div>
                  <FieldLabel>City / area</FieldLabel>
                  <Input
                    value={pi.city_area ?? ""}
                    disabled={props.readOnly}
                    onChange={(e) =>
                      patchSection("personal_info", { ...pi, city_area: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Nicknames</FieldLabel>
                <TagInput
                  values={pi.nicknames ?? []}
                  disabled={props.readOnly}
                  onChange={(nicknames) => patchSection("personal_info", { ...pi, nicknames })}
                />
              </div>

              <Collapsible
                title="Relationship & beliefs (AI opt-in)"
                open={!collapsed.beliefs}
                onToggle={() => setCollapsed((c) => ({ ...c, beliefs: !c.beliefs }))}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Relationship status</FieldLabel>
                    <Input
                      value={pi.relationship_status ?? ""}
                      disabled={props.readOnly}
                      onChange={(e) =>
                        patchSection("personal_info", {
                          ...pi,
                          relationship_status: e.target.value,
                        })
                      }
                    />
                    <div className="mt-2">
                      <Toggle
                        checked={flags.relationship}
                        disabled={props.readOnly}
                        label="Usable for AI"
                        onChange={(v) => setFlags((f) => ({ ...f, relationship: v }))}
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Orientation</FieldLabel>
                    <Input
                      value={pi.orientation ?? ""}
                      disabled={props.readOnly}
                      onChange={(e) =>
                        patchSection("personal_info", { ...pi, orientation: e.target.value })
                      }
                    />
                    <div className="mt-2">
                      <Toggle
                        checked={flags.orientation}
                        disabled={props.readOnly}
                        label="Usable for AI"
                        onChange={(v) => setFlags((f) => ({ ...f, orientation: v }))}
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Religious beliefs</FieldLabel>
                    <TextArea
                      value={pi.religious_beliefs ?? ""}
                      disabled={props.readOnly}
                      className="min-h-[64px]"
                      onChange={(e) =>
                        patchSection("personal_info", {
                          ...pi,
                          religious_beliefs: e.target.value,
                        })
                      }
                    />
                    <div className="mt-2">
                      <Toggle
                        checked={flags.religion}
                        disabled={props.readOnly}
                        label="Usable for AI"
                        onChange={(v) => setFlags((f) => ({ ...f, religion: v }))}
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Ideological beliefs</FieldLabel>
                    <TextArea
                      value={pi.ideological_beliefs ?? ""}
                      disabled={props.readOnly}
                      className="min-h-[64px]"
                      onChange={(e) =>
                        patchSection("personal_info", {
                          ...pi,
                          ideological_beliefs: e.target.value,
                        })
                      }
                    />
                    <div className="mt-2">
                      <Toggle
                        checked={flags.ideology}
                        disabled={props.readOnly}
                        label="Usable for AI"
                        onChange={(v) => setFlags((f) => ({ ...f, ideology: v }))}
                      />
                    </div>
                  </div>
                </div>
              </Collapsible>

              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["travelling_now", "Travelling now", "boolean"],
                    ["travelling_where", "Travelling where", "text"],
                    ["grew_up", "Grew up", "text"],
                    ["current_work", "Current work", "text"],
                    ["previous_jobs", "Previous jobs", "area"],
                    ["education", "Education", "text"],
                    ["children", "Children", "text"],
                    ["pets", "Pets", "text"],
                    ["siblings", "Siblings", "text"],
                    ["online_persona_description", "Online persona description", "area"],
                    ["anything_else", "Anything else", "area"],
                  ] as const
                ).map(([key, label, kind]) => (
                  <div key={key} className={kind === "area" ? "sm:col-span-2" : undefined}>
                    <FieldLabel>{label}</FieldLabel>
                    {kind === "boolean" ? (
                      <Toggle
                        checked={Boolean(pi.travelling_now)}
                        disabled={props.readOnly}
                        label={pi.travelling_now ? "Yes" : "No"}
                        onChange={(v) =>
                          patchSection("personal_info", { ...pi, travelling_now: v })
                        }
                      />
                    ) : kind === "area" ? (
                      <TextArea
                        value={String(pi[key as keyof typeof pi] ?? "")}
                        disabled={props.readOnly}
                        onChange={(e) =>
                          patchSection("personal_info", { ...pi, [key]: e.target.value })
                        }
                      />
                    ) : (
                      <Input
                        value={String(pi[key as keyof typeof pi] ?? "")}
                        disabled={props.readOnly}
                        onChange={(e) =>
                          patchSection("personal_info", { ...pi, [key]: e.target.value })
                        }
                      />
                    )}
                  </div>
                ))}
              </div>

              <div>
                <FieldLabel>Languages</FieldLabel>
                <TagInput
                  values={(pi.languages ?? []).map(
                    (l) =>
                      [l.language, l.level, l.dialect].filter(Boolean).join(" · ") || l.language,
                  )}
                  disabled={props.readOnly}
                  placeholder="e.g. English · fluent · US"
                  onChange={(tags) =>
                    patchSection("personal_info", {
                      ...pi,
                      languages: tags.map((t) => {
                        const [language, level, dialect] = t.split("·").map((s) => s.trim());
                        return { language: language ?? t, level, dialect };
                      }),
                    })
                  }
                />
              </div>
            </div>
          )}

          {active === "chatting" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel>Persona type</FieldLabel>
                  <select
                    className={cn(VA_FILTER_INPUT, "w-full")}
                    value={ch.persona_type ?? ""}
                    disabled={props.readOnly}
                    onChange={(e) =>
                      patchSection("chatting", { ...ch, persona_type: e.target.value })
                    }
                  >
                    <option value="">Select…</option>
                    {props.personaTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>Chatting strategy</FieldLabel>
                  <select
                    className={cn(VA_FILTER_INPUT, "w-full")}
                    value={ch.chatting_strategy ?? ""}
                    disabled={props.readOnly}
                    onChange={(e) =>
                      patchSection("chatting", { ...ch, chatting_strategy: e.target.value })
                    }
                  >
                    <option value="">Select…</option>
                    {props.chattingStrategies.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel hint="Chatting only — never raises social AI output">
                    Explicitness level
                  </FieldLabel>
                  <Input
                    value={ch.explicitness_level ?? ""}
                    disabled={props.readOnly}
                    onChange={(e) =>
                      patchSection("chatting", { ...ch, explicitness_level: e.target.value })
                    }
                  />
                </div>
                <div>
                  <FieldLabel>Writing level</FieldLabel>
                  <Input
                    value={ch.writing_level ?? ""}
                    disabled={props.readOnly}
                    onChange={(e) =>
                      patchSection("chatting", { ...ch, writing_level: e.target.value })
                    }
                  />
                </div>
              </div>
              <Toggle
                checked={Boolean(ch.multilingual)}
                disabled={props.readOnly}
                label="Multilingual"
                onChange={(v) => patchSection("chatting", { ...ch, multilingual: v })}
              />
              {(
                [
                  ["punctuation_style", "Punctuation style"],
                  ["capitalisation_style", "Capitalisation style"],
                  ["laughter_writing", "Laughter writing"],
                  ["slang", "Slang"],
                  ["info_to_collect_about_fans", "Info to collect about fans"],
                  ["topics_to_avoid", "Topics to avoid"],
                  ["topics_to_care", "Topics to care about"],
                  ["topics_she_loves", "Topics she loves"],
                  ["how_fans_should_feel", "How fans should feel"],
                  ["not_creator_claim_replies", 'Replies for "not talking to the creator"'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <FieldLabel>{label}</FieldLabel>
                  <TextArea
                    className="min-h-[64px]"
                    value={String(ch[key] ?? "")}
                    disabled={props.readOnly}
                    onChange={(e) => patchSection("chatting", { ...ch, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <FieldLabel>Favourite emojis</FieldLabel>
                <TagInput
                  values={ch.favourite_emojis ?? []}
                  disabled={props.readOnly}
                  onChange={(favourite_emojis) =>
                    patchSection("chatting", { ...ch, favourite_emojis })
                  }
                />
              </div>
              <div>
                <FieldLabel>Nicknames for fans</FieldLabel>
                <TagInput
                  values={ch.nicknames_for_fans ?? []}
                  disabled={props.readOnly}
                  onChange={(nicknames_for_fans) =>
                    patchSection("chatting", { ...ch, nicknames_for_fans })
                  }
                />
              </div>
              <div>
                <FieldLabel hint="AI outputs containing these are dropped & regenerated">
                  Words / phrases to avoid
                </FieldLabel>
                <TagInput
                  values={ch.words_phrases_to_avoid ?? []}
                  disabled={props.readOnly}
                  onChange={(words_phrases_to_avoid) =>
                    patchSection("chatting", { ...ch, words_phrases_to_avoid })
                  }
                />
              </div>
            </div>
          )}

          {active === "lifestyle" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["dreams_goals", "Dreams / goals"],
                  ["hobbies", "Hobbies"],
                  ["workout", "Workout"],
                  ["typical_day", "Typical day"],
                  ["morning_routine", "Morning routine"],
                  ["night_routine", "Night routine"],
                  ["weekends", "Weekends"],
                  ["fav_foods", "Favourite foods"],
                  ["fav_drinks", "Favourite drinks"],
                  ["fav_color", "Favourite color"],
                  ["fav_music", "Favourite music"],
                  ["fav_books", "Favourite books"],
                  ["fav_movies", "Favourite movies"],
                  ["drinking", "Drinking"],
                  ["smoking", "Smoking"],
                  ["funny_story", "Funny story"],
                  ["unexpected_facts", "Unexpected facts"],
                  ["sports_watched", "Sports watched"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="sm:col-span-2">
                  <FieldLabel>{label}</FieldLabel>
                  <TextArea
                    className="min-h-[64px]"
                    value={String(life[key] ?? "")}
                    disabled={props.readOnly}
                    onChange={(e) =>
                      patchSection("lifestyle", { ...life, [key]: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {active === "physique" && props.canViewSensitive && (
            <div className="space-y-3">
              <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/80">
                Never sent to AI. Requires personas:view_sensitive.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["body_type", "Body type"],
                    ["ethnic_background", "Ethnic background"],
                    ["hair", "Hair"],
                    ["eyes", "Eyes"],
                    ["height", "Height"],
                    ["weight", "Weight"],
                    ["cup_size", "Cup size (optional)"],
                    ["notes", "Notes"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <FieldLabel>{label}</FieldLabel>
                    <Input
                      value={String(phy[key] ?? "")}
                      disabled={props.readOnly || !props.canEditSensitive}
                      onChange={(e) =>
                        patchSection("physique", { ...phy, [key]: e.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
              <Toggle
                checked={Boolean(phy.tattoos)}
                disabled={props.readOnly || !props.canEditSensitive}
                label="Tattoos"
                onChange={(v) => patchSection("physique", { ...phy, tattoos: v })}
              />
              {phy.tattoos && (
                <Input
                  placeholder="Where?"
                  value={phy.tattoos_where ?? ""}
                  disabled={props.readOnly || !props.canEditSensitive}
                  onChange={(e) =>
                    patchSection("physique", { ...phy, tattoos_where: e.target.value })
                  }
                />
              )}
              <Toggle
                checked={Boolean(phy.piercings)}
                disabled={props.readOnly || !props.canEditSensitive}
                label="Piercings"
                onChange={(v) => patchSection("physique", { ...phy, piercings: v })}
              />
              {phy.piercings && (
                <Input
                  placeholder="Where?"
                  value={phy.piercings_where ?? ""}
                  disabled={props.readOnly || !props.canEditSensitive}
                  onChange={(e) =>
                    patchSection("physique", { ...phy, piercings_where: e.target.value })
                  }
                />
              )}
            </div>
          )}

          {active === "content" && (
            <div className="space-y-4">
              <div>
                <FieldLabel>Niche (2–3 sentences)</FieldLabel>
                <TextArea
                  value={content.niche ?? ""}
                  disabled={props.readOnly}
                  onChange={(e) => patchSection("content", { ...content, niche: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    ["custom_gfe", "GFE"],
                    ["custom_ratings", "Ratings"],
                    ["custom_customs", "Customs"],
                    ["custom_vip", "VIP"],
                    ["custom_wall_post_campaigns", "Wall-post / feed campaigns"],
                    ["custom_physical_goods", "Physical goods"],
                  ] as const
                ).map(([key, label]) => (
                  <Toggle
                    key={key}
                    checked={Boolean(content[key])}
                    disabled={props.readOnly}
                    label={label}
                    onChange={(v) => patchSection("content", { ...content, [key]: v })}
                  />
                ))}
              </div>
              <div>
                <FieldLabel>Content offered</FieldLabel>
                <TextArea
                  value={content.content_offered ?? ""}
                  disabled={props.readOnly}
                  onChange={(e) =>
                    patchSection("content", { ...content, content_offered: e.target.value })
                  }
                />
              </div>
              <div>
                <FieldLabel hint="Feeds AI red-line filter">Red lines</FieldLabel>
                <TextArea
                  value={content.red_lines ?? ""}
                  disabled={props.readOnly}
                  onChange={(e) =>
                    patchSection("content", { ...content, red_lines: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {active === "intimate_details" && props.canViewSensitive && (
            <div className="space-y-3">
              <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/80">
                Never sent to AI. Requires personas:view_sensitive.
              </p>
              {(
                [
                  ["why_started", "Why she started"],
                  ["attraction_who_why", "Attraction — who / why"],
                  ["turn_ons", "Turn-ons"],
                  ["fetishes", "Fetishes"],
                  ["experiences", "Experiences"],
                  ["open_relationships_view", "Open relationships view"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <FieldLabel>{label}</FieldLabel>
                  <TextArea
                    value={String(intimate[key] ?? "")}
                    disabled={props.readOnly || !props.canEditSensitive}
                    onChange={(e) =>
                      patchSection("intimate_details", { ...intimate, [key]: e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {active === "socials" && (
            <div className="space-y-4">
              <div>
                <FieldLabel>Other NSFW platforms</FieldLabel>
                <TextArea
                  value={socials.other_nsfw_platforms ?? ""}
                  disabled={props.readOnly}
                  onChange={(e) =>
                    patchSection("socials", { ...socials, other_nsfw_platforms: e.target.value })
                  }
                />
              </div>
              <div>
                <FieldLabel>Social platforms</FieldLabel>
                <TextArea
                  value={socials.social_platforms ?? ""}
                  disabled={props.readOnly}
                  onChange={(e) =>
                    patchSection("socials", { ...socials, social_platforms: e.target.value })
                  }
                />
              </div>
              <div>
                <FieldLabel>Handles</FieldLabel>
                <TagInput
                  values={(socials.handles ?? []).map((h) => `${h.platform}: ${h.handle}`)}
                  disabled={props.readOnly}
                  placeholder="Instagram: @handle"
                  onChange={(tags) =>
                    patchSection("socials", {
                      ...socials,
                      handles: tags.map((t) => {
                        const idx = t.indexOf(":");
                        if (idx < 0) return { platform: "Other", handle: t };
                        return {
                          platform: t.slice(0, idx).trim(),
                          handle: t.slice(idx + 1).trim(),
                        };
                      }),
                    })
                  }
                />
              </div>
              <div>
                <FieldLabel>Unavailable social content</FieldLabel>
                <TextArea
                  value={socials.unavailable_social_content ?? ""}
                  disabled={props.readOnly}
                  onChange={(e) =>
                    patchSection("socials", {
                      ...socials,
                      unavailable_social_content: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <FieldLabel>Example reply</FieldLabel>
                <TextArea
                  value={socials.unavailable_example_reply ?? ""}
                  disabled={props.readOnly}
                  onChange={(e) =>
                    patchSection("socials", {
                      ...socials,
                      unavailable_example_reply: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}

          {active === "live_updates" && (
            <LiveUpdatesPanel
              items={filteredLive}
              showInactive={showInactiveLive}
              onToggleShowInactive={setShowInactiveLive}
              readOnly={props.readOnly}
              activeCount={live.filter((l) => l.is_live).length}
              onAdd={addLiveUpdate}
              onPatch={patchLive}
            />
          )}
        </div>

        {props.revisions.length > 0 && (
          <div className={cn(VA_CARD, "mt-4 p-4")}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Recent saves
            </p>
            <ul className="space-y-1.5 text-xs text-white/45">
              {props.revisions.map((r) => (
                <li key={r.id}>
                  {new Date(r.created_at).toLocaleString()}
                  {r.saved_by_name ? ` · ${r.saved_by_name}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

function Collapsible({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-white/80"
      >
        {title}
        <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-white/[0.06] px-3 py-3">{children}</div>}
    </div>
  );
}

function LiveUpdatesPanel({
  items,
  showInactive,
  onToggleShowInactive,
  readOnly,
  activeCount,
  onAdd,
  onPatch,
}: {
  items: ModelPersonaLiveUpdate[];
  showInactive: boolean;
  onToggleShowInactive: (v: boolean) => void;
  readOnly: boolean;
  activeCount: number;
  onAdd: (f: {
    content: string;
    status: string;
    starts_at: string;
    ends_at: string;
  }) => Promise<void>;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  const [content, setContent] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [endsAt, setEndsAt] = React.useState("");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-white/45">
          Active {activeCount}/{MAX_ACTIVE_LIVE_UPDATES} · auto-expire at end time · feed AI when
          active
        </p>
        <Toggle
          checked={showInactive}
          onChange={onToggleShowInactive}
          label="Show inactive"
        />
      </div>

      {!readOnly && (
        <div className="space-y-2 rounded-xl border border-dashed border-white/10 p-3">
          <FieldLabel>New live update</FieldLabel>
          <TextArea
            value={content}
            placeholder="What's happening right now…"
            className="min-h-[64px]"
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Status (optional)"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={cn(VA_BTN_SECONDARY, "inline-flex items-center gap-1.5 px-3 py-2 text-xs")}
            disabled={!content.trim() || !endsAt || activeCount >= MAX_ACTIVE_LIVE_UPDATES}
            onClick={() => {
              const ends = new Date(endsAt).toISOString();
              void onAdd({
                content: content.trim(),
                status: status.trim(),
                starts_at: new Date().toISOString(),
                ends_at: ends,
              }).then(() => {
                setContent("");
                setStatus("");
                setEndsAt("");
              });
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "rounded-xl border px-3 py-2.5",
              item.is_live ? "border-[#D4AF8C]/25 bg-[#D4AF8C]/[0.04]" : "border-white/5 opacity-60",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="whitespace-pre-wrap text-sm text-white/85">{item.content}</p>
                <p className="mt-1 text-[11px] text-white/35">
                  {item.status ? `${item.status} · ` : ""}
                  {new Date(item.starts_at).toLocaleString()} →{" "}
                  {new Date(item.ends_at).toLocaleString()}
                  {item.is_live ? " · live" : " · expired"}
                </p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  className="text-white/30 hover:text-red-300"
                  aria-label="Delete"
                  onClick={() => void onPatch(item.id, { delete: true })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-6 text-center text-sm text-white/35">No live updates</li>
        )}
      </ul>
    </div>
  );
}
