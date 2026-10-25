"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  Eye,
  History,
  Lock,
  Plus,
  Save,
  Trash2,
  UserRound,
  Heart,
  MessageCircle,
  Sparkles,
  Activity,
  Share2,
  FileText,
  Shirt,
  Flame,
} from "lucide-react";
import {
  PERSONA_AI_FEED_HINTS,
  PERSONA_DESCRIPTIVE_HINT,
  PERSONA_SECTION_LABELS,
  SENSITIVE_PERSONA_SECTIONS,
  MAX_ACTIVE_LIVE_UPDATES,
  type PersonaAiContextFlags,
  type PersonaSectionData,
  type PersonaSectionKey,
  type ModelPersonaLiveUpdate,
  type ModelPersona,
} from "@/lib/persona-types";
import {
  completenessForSection,
  formatRelativeShort,
  isBirthDateAdult,
  overallCompleteness,
  visiblePersonaSections,
} from "@/lib/persona-completeness";
import { buildPersonaAiContext } from "@/lib/persona-ai-context";
import { ROUTES } from "@/lib/routes";
import {
  CharGuidance,
  CompletenessRing,
  EmojiPickerRow,
  FiltersSheet,
  LiveBadge,
  LockedBadge,
  ModelAvatar,
  PsFieldLabel as FieldLabel,
  PsInput as Input,
  PsTagInput as TagInput,
  PsTextArea as TextArea,
  PsToggle as Toggle,
  SaveStatusPill,
  SegmentedControl,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_FILTER_INPUT,
  VA_TASKS,
  cn,
} from "@/components/personas-studio/shared";

const SECTION_ICONS: Record<
  PersonaSectionKey,
  React.ComponentType<{ className?: string }>
> = {
  bio: FileText,
  personal_info: UserRound,
  chatting: MessageCircle,
  lifestyle: Sparkles,
  physique: Shirt,
  content: Heart,
  intimate_details: Flame,
  socials: Share2,
  live_updates: Activity,
};

const LIVE_TEMPLATES = [
  "Travelling right now",
  "On set / filming today",
  "Feeling under the weather",
  "New content dropping soon",
  "Birthday week ✨",
  "Unavailable for a few days",
];

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

export function PersonaEditorClient(props: Props) {
  const [sections, setSections] = React.useState<PersonaSectionData>(props.initialSections);
  const [flags, setFlags] = React.useState(props.aiContextFlags);
  const [active, setActive] = React.useState<PersonaSectionKey>("bio");
  const [live, setLive] = React.useState(props.liveUpdates);
  const [saving, setSaving] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<"saved" | "saving" | "unsaved" | "error" | null>(
    null,
  );
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState(props.lastUpdatedAt);
  const [lastUpdatedByName, setLastUpdatedByName] = React.useState(props.lastUpdatedByName);
  const [showInactiveLive, setShowInactiveLive] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [sectionSheet, setSectionSheet] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [revisionsOpen, setRevisionsOpen] = React.useState(false);
  const draftTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = React.useRef(false);

  const visibleSections = visiblePersonaSections(props.canViewSensitive);
  const liveCount = live.filter((l) => l.is_live).length;
  const scores = visibleSections.map((k) => completenessForSection(k, sections, liveCount));
  const overall = overallCompleteness(sections, liveCount, props.canViewSensitive);
  const birthOk = isBirthDateAdult(sections.personal_info);

  const patchSection = React.useCallback(
    <K extends keyof PersonaSectionData>(key: K, value: PersonaSectionData[K]) => {
      dirty.current = true;
      setSaveStatus("unsaved");
      setSections((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

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

  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty.current || props.readOnly) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [props.readOnly]);

  async function persist(opts: { draftOnly?: boolean; explicitSave?: boolean }) {
    if (props.readOnly) return;
    setSaving(true);
    setSaveStatus("saving");
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
        setSaveStatus("error");
        return;
      }
      if (opts.explicitSave) {
        dirty.current = false;
        setSaveStatus("saved");
        if (data.persona?.updated_at) setLastUpdatedAt(data.persona.updated_at);
        if (data.persona?.last_updated_by_name) {
          setLastUpdatedByName(data.persona.last_updated_by_name);
        }
      } else if (opts.draftOnly) {
        setSaveStatus(dirty.current ? "unsaved" : "saved");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  const aiPreviewText = React.useMemo(() => {
    const persona = {
      id: props.personaId,
      model_id: props.modelId,
      ...sections,
      // Sensitive never reaches AI builder allowlist; strip for display safety
      physique: {},
      intimate_details: {},
      ai_context_flags: flags,
      draft: null,
      last_updated_by: "",
      last_updated_by_name: lastUpdatedByName,
      created_at: "",
      updated_at: lastUpdatedAt,
    } as ModelPersona;
    const bundle = buildPersonaAiContext(
      persona,
      live.filter((l) => l.is_live),
    );
    return bundle.contextText || "Fill allowlisted fields to see how the AI sees her.";
  }, [
    sections,
    flags,
    live,
    props.personaId,
    props.modelId,
    lastUpdatedAt,
    lastUpdatedByName,
  ]);

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
      setSaveStatus("error");
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
  const ActiveIcon = SECTION_ICONS[active];
  const sectionNav = (
    <nav className="space-y-0.5">
      {visibleSections.map((k, i) => {
        const sensitive = SENSITIVE_PERSONA_SECTIONS.includes(
          k as (typeof SENSITIVE_PERSONA_SECTIONS)[number],
        );
        const Icon = SECTION_ICONS[k];
        return (
          <button
            key={k}
            type="button"
            onClick={() => {
              setActive(k);
              setSectionSheet(false);
            }}
            className={cn(
              "flex w-full min-h-11 items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition",
              active === k ? "bg-white/[0.08] text-white" : "text-white/50",
            )}
          >
            <CompletenessRing value={scores[i]!} size={26} stroke={2.5} />
            <Icon className="h-3.5 w-3.5 shrink-0 text-[#D4AF8C]/70" aria-hidden />
            <span className="flex-1 truncate">{PERSONA_SECTION_LABELS[k]}</span>
            {sensitive && <Lock className="h-3 w-3 text-white/30" aria-label="Sensitive" />}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 md:px-6 md:pb-10 md:pt-6">
      {/* Sticky identity header */}
      <div
        className={cn(
          VA_CARD,
          "sticky top-0 z-20 mb-4 border border-white/[0.08] bg-[#121014]/95 p-3 backdrop-blur-md md:p-4",
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={ROUTES.personas}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 text-white/50"
            aria-label="All personas"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <ModelAvatar name={props.modelName} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-base font-semibold text-white md:text-lg">
                {props.modelName}
              </p>
              {!props.canViewSensitive ? <LockedBadge /> : null}
              {liveCount > 0 ? <LiveBadge /> : null}
            </div>
            <p className="text-[11px] text-white/35">
              {Math.round(overall * 100)}% complete
              {lastUpdatedAt
                ? ` · Updated ${formatRelativeShort(lastUpdatedAt)}${
                    lastUpdatedByName ? ` by ${lastUpdatedByName}` : ""
                  }`
                : ""}
              {!birthOk ? " · Birth date / 18+ needed for AI" : ""}
            </p>
          </div>
          <CompletenessRing value={overall} size={48} />
          <div className="flex flex-wrap items-center gap-2">
            <SaveStatusPill status={saving ? "saving" : saveStatus} />
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "inline-flex min-h-11 items-center gap-1.5 px-3")}
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">AI preview</span>
            </button>
            {props.revisions.length > 0 && (
              <button
                type="button"
                className={cn(VA_BTN_SECONDARY, "inline-flex min-h-11 items-center gap-1.5 px-3")}
                onClick={() => setRevisionsOpen(true)}
              >
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
              </button>
            )}
            {!props.readOnly && (
              <button
                type="button"
                className={cn(VA_BTN_PRIMARY, "inline-flex min-h-11 items-center gap-2 px-4")}
                disabled={saving}
                onClick={() => void persist({ explicitSave: true })}
              >
                <Save className="h-4 w-4" /> Save
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <aside className="hidden md:block md:w-56 md:shrink-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Sections
          </p>
          {sectionNav}
        </aside>

        {/* Mobile section chips */}
        <div className="mb-1 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
          {visibleSections.map((k, i) => {
            const Icon = SECTION_ICONS[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setActive(k)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2.5 text-[11px] font-medium",
                  active === k
                    ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-white"
                    : "border-white/10 text-white/55",
                )}
              >
                <Icon className="h-3 w-3" aria-hidden />
                {PERSONA_SECTION_LABELS[k]}
                <span className="text-white/35">{Math.round(scores[i]! * 100)}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSectionSheet(true)}
            className="inline-flex shrink-0 items-center rounded-full border border-white/10 px-3 py-2.5 text-[11px] text-white/55"
          >
            All
          </button>
        </div>

        <main className="min-w-0 flex-1">
          <div className={cn(VA_CARD, "p-4 md:p-6")}>
            <div className="mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <ActiveIcon className="h-5 w-5 text-[#D4AF8C]" aria-hidden />
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
            </div>

            {active === "bio" && (
              <div>
                <TextArea
                  value={sections.bio}
                  disabled={props.readOnly}
                  placeholder="Short bio in her voice…"
                  onChange={(e) => patchSection("bio", e.target.value)}
                />
                <CharGuidance value={sections.bio} soft={280} max={600} />
              </div>
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
                  <SegmentedControl
                    value={(ch.writing_level as "simple" | "natural" | "polished") || ""}
                    disabled={props.readOnly}
                    options={[
                      { value: "simple", label: "Simple" },
                      { value: "natural", label: "Natural" },
                      { value: "polished", label: "Polished" },
                    ]}
                    onChange={(v) => patchSection("chatting", { ...ch, writing_level: v })}
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
                <FieldLabel hint="Feeds AI voice">Favourite emojis</FieldLabel>
                <EmojiPickerRow
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
              activeCount={liveCount}
              onAdd={addLiveUpdate}
              onPatch={patchLive}
            />
          )}
          </div>
        </main>
      </div>

      <FiltersSheet open={sectionSheet} onClose={() => setSectionSheet(false)} title="Sections">
        {sectionNav}
      </FiltersSheet>

      {/* AI preview — allowlisted fields only, never sensitive */}
      <FiltersSheet
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="How the AI sees her"
        allBreakpoints
      >
        <p className="mb-3 text-xs text-white/45">
          Allowlisted fields only. Physique, Intimate Details, explicitness, and NSFW platforms
          never appear here.
        </p>
        <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-white/[0.08] bg-black/40 p-3 font-sans text-xs leading-relaxed text-white/80 md:max-h-[calc(100vh-8rem)]">
          {aiPreviewText}
        </pre>
      </FiltersSheet>

      {/* Revision history — read-only; restore not available */}
      <FiltersSheet
        open={revisionsOpen}
        onClose={() => setRevisionsOpen(false)}
        title="Revision history"
        allBreakpoints
      >
        <ul className="space-y-2">
          {props.revisions.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-3 text-sm text-white/70"
            >
              <p className="font-medium text-white/90">
                {new Date(r.created_at).toLocaleString()}
              </p>
              <p className="mt-0.5 text-[11px] text-white/40">
                {r.saved_by_name ? `Saved by ${r.saved_by_name}` : "Saved"}
                {" · snapshot on file (read-only)"}
              </p>
            </li>
          ))}
          {props.revisions.length === 0 && (
            <li className="py-6 text-center text-sm text-white/35">No revisions yet</li>
          )}
        </ul>
      </FiltersSheet>
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
          Active {activeCount}/{MAX_ACTIVE_LIVE_UPDATES} · auto-expire at end · feed AI when live
        </p>
        <Toggle
          checked={showInactive}
          onChange={onToggleShowInactive}
          label="Show inactive"
        />
      </div>

      {!readOnly && (
        <div className="space-y-3 rounded-xl border border-dashed border-[#D4AF8C]/25 bg-[#D4AF8C]/[0.04] p-4">
          <FieldLabel>New live update</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {LIVE_TEMPLATES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setContent(t)}
                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/50 active:border-[#D4AF8C]/40 active:text-[#D4AF8C]"
              >
                {t}
              </button>
            ))}
          </div>
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
              aria-label="Expires at"
            />
          </div>
          <button
            type="button"
            className={cn(
              VA_BTN_SECONDARY,
              "inline-flex min-h-11 items-center gap-1.5 px-4 text-xs",
            )}
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
            <Plus className="h-3.5 w-3.5" /> Add live update
          </button>
        </div>
      )}

      <ol className="relative space-y-0 border-l border-white/10 pl-4">
        {items.map((item) => (
          <li key={item.id} className="relative pb-4 last:pb-0">
            <span
              className={cn(
                "absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full border-2",
                item.is_live
                  ? "border-emerald-300 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                  : "border-white/20 bg-white/10",
              )}
            />
            <div
              className={cn(
                "rounded-xl border px-3 py-2.5",
                item.is_live
                  ? "border-[#D4AF8C]/25 bg-[#D4AF8C]/[0.04]"
                  : "border-white/5 opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {item.is_live ? <LiveBadge className="mb-1.5" /> : null}
                  <p className="whitespace-pre-wrap text-sm text-white/85">{item.content}</p>
                  <p className="mt-1 text-[11px] text-white/35">
                    {item.status ? `${item.status} · ` : ""}
                    Expires {new Date(item.ends_at).toLocaleString()}
                    {item.is_live ? "" : " · inactive"}
                  </p>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    className="inline-flex min-h-11 min-w-11 items-center justify-center text-white/30"
                    aria-label="Delete"
                    onClick={() => void onPatch(item.id, { delete: true })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-6 text-center text-sm text-white/35">No live updates</li>
        )}
      </ol>
    </div>
  );
}
