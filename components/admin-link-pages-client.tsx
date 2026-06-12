"use client";

import * as React from "react";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FlaskConical,
  Globe,
  GripVertical,
  Link2,
  Loader2,
  Minus,
  Monitor,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Trash2,
  Upload,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import { useToast } from "@/contexts/toast-context";
import { FormInput } from "@/components/ui/form-input";
import { Label, Textarea } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LINK_PAGE_FONTS, LINK_PAGE_PLATFORMS } from "@/lib/link-pages-schema";
import { buildRedirectPublicUrl } from "@/lib/link-redirects-schema";
import {
  GRADIENT_PRESETS,
  PATTERN_PRESETS,
  getBackgroundCss,
  parseImageBackgroundValue,
  serializeImageBackgroundValue,
  PLATFORM_BRANDING,
  detectLinkPlatform,
  fontFamilyMap,
  fontLabels,
  getRecommendedBlockStyle,
  GOOGLE_FONTS_STYLESHEET,
} from "@/lib/link-page-styles";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type {
  AppNotification,
  AbTestResults,
  AnalyticsSummary,
  AnalyticsTrend,
  GlobalAnalyticsSummary,
  LinkPageBackgroundType,
  LinkPageBlockRecord,
  LinkPageBlockType,
  LinkPageRecord,
  LinkPageWithBlocks,
  LinkRedirectRecord,
  ModelRecord,
} from "@/types";

/* ── Design tokens ── */
const BG = "#050505";
const PANEL = "#0d0d0d";
const BORDER = "rgba(255,255,255,0.08)";
const ACCENT = "#ec4899";

const THEME_TEXT_COLOR: Record<LinkPageRecord["theme"], string> = {
  dark: "#fafafa",
  light: "#0f172a",
  minimal: "#f4f4f5",
  neon: "#ffffff",
  gold: "#fef3c7",
};
const PURPLE = "#8b5cf6";
const PIE_COLORS = ["#ec4899", "#8b5cf6", "#38bdf8", "#34d399", "#fbbf24", "#f97316"];

function localToast(title: string, body: string, priority: "normal" | "high"): AppNotification {
  const id = `toast-${Date.now()}`;
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

const COLOR_SWATCH_STYLE: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: "50%",
  border: "none",
  cursor: "pointer",
  padding: 0,
  background: "none",
};

type BackgroundTab = "color" | "gradient" | "pattern" | "image" | "animated";

const BACKGROUND_TABS: Array<{ id: BackgroundTab; label: string }> = [
  { id: "color", label: "Color" },
  { id: "gradient", label: "Gradient" },
  { id: "pattern", label: "Pattern" },
  { id: "image", label: "Image" },
  { id: "animated", label: "Animated" },
];

const GRADIENT_DIRECTIONS = [
  { value: "135deg", label: "↘ Diagonal" },
  { value: "180deg", label: "↓ Down" },
  { value: "90deg", label: "→ Right" },
  { value: "0deg", label: "↑ Up" },
  { value: "45deg", label: "↗ Angle" },
  { value: "270deg", label: "← Left" },
] as const;

const ANIMATED_SPEEDS = [
  { value: "slow", label: "Slow" },
  { value: "medium", label: "Medium" },
  { value: "fast", label: "Fast" },
] as const;

function backgroundTabFromType(type: LinkPageBackgroundType): BackgroundTab {
  if (type === "gradient" || type === "gradient_preset") return "gradient";
  if (type === "pattern") return "pattern";
  if (type === "image") return "image";
  if (type === "animated") return "animated";
  return "color";
}

function parseCustomGradient(value: string): { from: string; to: string; direction: string } {
  const fallback = { from: "#ec4899", to: "#a855f7", direction: "135deg" };
  const match = value.match(/linear-gradient\(([^,]+),\s*(#[0-9a-fA-F]{3,8}|[^,]+),\s*(#[0-9a-fA-F]{3,8}|[^)]+)\)/);
  if (!match) return fallback;
  return {
    direction: match[1].trim(),
    from: match[2].trim(),
    to: match[3].trim(),
  };
}

function buildCustomGradient(from: string, to: string, direction: string): string {
  return `linear-gradient(${direction}, ${from}, ${to})`;
}

function parsePatternValue(value: string): { patternId: string; baseColor: string } {
  const [patternId, baseColor] = (value || "dots,#0a0a0a").split(",");
  return { patternId: patternId?.trim() || "dots", baseColor: baseColor?.trim() || "#0a0a0a" };
}

function parseAnimatedValue(value: string): { colors: [string, string, string]; speed: string } {
  const parts = (value || "").split(",").map((s) => s.trim());
  return {
    colors: [parts[0] || "#ec4899", parts[1] || "#8b5cf6", parts[2] || "#3b82f6"],
    speed: parts[3] || "medium",
  };
}

function buildAnimatedValue(colors: [string, string, string], speed: string): string {
  return `${colors.join(",")},${speed}`;
}

function previewPageFromFields(
  page: Pick<
    LinkPageRecord,
    "background_type" | "background_value" | "theme" | "primary_color" | "accent_color" | "font"
  >
): LinkPageWithBlocks {
  return {
    page_id: "",
    id: "",
    model_id: "",
    slug: "",
    status: "draft",
    title: "",
    bio: "",
    profile_photo_url: "",
    background_type: page.background_type,
    background_value: page.background_value,
    theme: page.theme,
    primary_color: page.primary_color,
    accent_color: page.accent_color,
    font: page.font,
    custom_domain: "",
    show_powered_by: false,
    meta_description: "",
    verified: false,
    meta_pixel_id: "",
    tiktok_pixel_id: "",
    cookie_notice_enabled: true,
    cookie_notice_text: "",
    bio_color: "",
    name_color: "",
    ab_test_enabled: false,
    ab_variant_id: "",
    ab_test_name: "",
    ab_winner: "none",
    ab_started_at: null,
    created_at: "",
    updated_at: "",
    blocks: [],
  };
}

function BackgroundSection({
  page,
  onPatchImmediateField,
  onPatchTextField,
  onFieldBlur,
}: {
  page: Pick<LinkPageRecord, "background_type" | "background_value" | "theme">;
  onPatchImmediateField: (patch: Partial<SaveablePageFields>) => void;
  onPatchTextField: (patch: Partial<SaveablePageFields>) => void;
  onFieldBlur: () => void;
}) {
  const activeTab = backgroundTabFromType(page.background_type);
  const [gradientMode, setGradientMode] = React.useState<"presets" | "custom">(
    page.background_type === "gradient" ? "custom" : "presets"
  );

  React.useEffect(() => {
    setGradientMode(page.background_type === "gradient" ? "custom" : "presets");
  }, [page.background_type]);

  const customGradient = parseCustomGradient(page.background_value);
  const patternState = parsePatternValue(page.background_value);
  const imageState = parseImageBackgroundValue(page.background_value);
  const animatedState = parseAnimatedValue(page.background_value);

  const selectTab = (tab: BackgroundTab) => {
    if (tab === activeTab) return;
    switch (tab) {
      case "color":
        onPatchImmediateField({ background_type: "color", background_value: page.background_value || "#0a0a0a" });
        break;
      case "gradient":
        onPatchImmediateField({
          background_type: "gradient_preset",
          background_value: GRADIENT_PRESETS[0]?.id ?? "sunset",
        });
        break;
      case "pattern":
        onPatchImmediateField({ background_type: "pattern", background_value: "dots,#0a0a0a" });
        break;
      case "image":
        onPatchImmediateField({
          background_type: "image",
          background_value: serializeImageBackgroundValue({ url: "", overlay: 0.5, blur: 0 }),
        });
        break;
      case "animated":
        onPatchImmediateField({
          background_type: "animated",
          background_value: buildAnimatedValue(["#ec4899", "#8b5cf6", "#3b82f6"], "medium"),
        });
        break;
    }
  };

  const previewCss = getBackgroundCss(
    previewPageFromFields({
      ...page,
      primary_color: "#ec4899",
      accent_color: "#a855f7",
      font: "modern",
    })
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {BACKGROUND_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectTab(tab.id)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              activeTab === tab.id ? "text-pink-200" : "text-white/45 hover:text-white/70"
            )}
            style={{
              borderColor: activeTab === tab.id ? ACCENT : BORDER,
              background: activeTab === tab.id ? `${ACCENT}22` : BG,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "color" ? (
        <div className="flex items-center gap-3">
          <NativeColorSwatch
            value={page.background_value}
            fallback="#0a0a0a"
            onChange={(v) => onPatchImmediateField({ background_type: "color", background_value: v })}
          />
          <span className="text-xs text-white/40">{page.background_value || "#0a0a0a"}</span>
        </div>
      ) : null}

      {activeTab === "gradient" ? (
        <div className="space-y-3">
          <div className="flex gap-1">
            {(["presets", "custom"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setGradientMode(mode);
                  if (mode === "custom" && page.background_type !== "gradient") {
                    onPatchImmediateField({
                      background_type: "gradient",
                      background_value: buildCustomGradient(
                        customGradient.from,
                        customGradient.to,
                        customGradient.direction
                      ),
                    });
                  }
                  if (mode === "presets" && page.background_type !== "gradient_preset") {
                    const presetId =
                      GRADIENT_PRESETS.some((p) => p.id === page.background_value)
                        ? page.background_value
                        : GRADIENT_PRESETS[0]?.id ?? "sunset";
                    onPatchImmediateField({
                      background_type: "gradient_preset",
                      background_value: presetId,
                    });
                  }
                }}
                className={cn(
                  "rounded-md border px-2 py-1 text-[10px] uppercase tracking-wide transition-colors",
                  gradientMode === mode ? "text-pink-200" : "text-white/40 hover:text-white/65"
                )}
                style={{
                  borderColor: gradientMode === mode ? ACCENT : BORDER,
                  background: gradientMode === mode ? `${ACCENT}18` : "transparent",
                }}
              >
                {mode === "presets" ? "Presets" : "Custom"}
              </button>
            ))}
          </div>

          {gradientMode === "presets" ? (
            <div className="grid grid-cols-2 gap-2">
              {GRADIENT_PRESETS.map((preset) => {
                const selected =
                  page.background_type === "gradient_preset" && page.background_value === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onPatchImmediateField({
                        background_type: "gradient_preset",
                        background_value: preset.id,
                      })
                    }
                    className="group text-left"
                  >
                    <div
                      className="h-[60px] w-full rounded-lg border transition-all group-hover:brightness-110"
                      style={{
                        background: preset.value,
                        borderColor: selected ? ACCENT : BORDER,
                        boxShadow: selected ? `0 0 0 1px ${ACCENT}` : undefined,
                      }}
                    />
                    <span
                      className={cn(
                        "mt-1 block text-[10px]",
                        selected ? "text-pink-200" : "text-white/45"
                      )}
                    >
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Field label="From">
                  <NativeColorSwatch
                    value={customGradient.from}
                    fallback="#ec4899"
                    onChange={(from) =>
                      onPatchImmediateField({
                        background_type: "gradient",
                        background_value: buildCustomGradient(from, customGradient.to, customGradient.direction),
                      })
                    }
                  />
                </Field>
                <Field label="To">
                  <NativeColorSwatch
                    value={customGradient.to}
                    fallback="#a855f7"
                    onChange={(to) =>
                      onPatchImmediateField({
                        background_type: "gradient",
                        background_value: buildCustomGradient(customGradient.from, to, customGradient.direction),
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Direction">
                <select
                  value={customGradient.direction}
                  onChange={(e) =>
                    onPatchImmediateField({
                      background_type: "gradient",
                      background_value: buildCustomGradient(
                        customGradient.from,
                        customGradient.to,
                        e.target.value
                      ),
                    })
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm text-white"
                  style={{ background: BG, borderColor: BORDER }}
                >
                  {GRADIENT_DIRECTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div
                className="h-[60px] w-full rounded-lg border"
                style={{
                  background: buildCustomGradient(
                    customGradient.from,
                    customGradient.to,
                    customGradient.direction
                  ),
                  borderColor: BORDER,
                }}
              />
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "pattern" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {PATTERN_PRESETS.map((pattern) => {
              const selected =
                page.background_type === "pattern" && patternState.patternId === pattern.id;
              const previewCss = getBackgroundCss({
                background_type: "pattern",
                background_value: `${pattern.id},${patternState.baseColor}`,
                theme: page.theme,
              });
              return (
                <button
                  key={pattern.id}
                  type="button"
                  onClick={() =>
                    onPatchImmediateField({
                      background_type: "pattern",
                      background_value: `${pattern.id},${patternState.baseColor}`,
                    })
                  }
                  className="group text-left"
                >
                  <div
                    className="h-[60px] w-full rounded-lg border transition-all group-hover:brightness-110"
                    style={{
                      cssText: previewCss,
                      borderColor: selected ? ACCENT : BORDER,
                      boxShadow: selected ? `0 0 0 1px ${ACCENT}` : undefined,
                    } as React.CSSProperties}
                  />
                  <span
                    className={cn(
                      "mt-1 block text-[10px]",
                      selected ? "text-pink-200" : "text-white/45"
                    )}
                  >
                    {pattern.label}
                  </span>
                </button>
              );
            })}
          </div>
          <Field label="Base color">
            <NativeColorSwatch
              value={patternState.baseColor}
              fallback="#0a0a0a"
              onChange={(baseColor) =>
                onPatchImmediateField({
                  background_type: "pattern",
                  background_value: `${patternState.patternId},${baseColor}`,
                })
              }
            />
          </Field>
        </div>
      ) : null}

      {activeTab === "image" ? (
        <div className="space-y-3">
          <Field label="Image URL">
            <FormInput
              value={imageState.url}
              onChange={(e) =>
                onPatchTextField({
                  background_type: "image",
                  background_value: serializeImageBackgroundValue({
                    ...imageState,
                    url: e.target.value,
                  }),
                })
              }
              onBlur={onFieldBlur}
              placeholder="https://..."
            />
          </Field>
          {imageState.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageState.url}
              alt=""
              className="h-24 w-full rounded-lg border object-cover"
              style={{ borderColor: BORDER }}
            />
          ) : null}
          <Field label={`Overlay (${Math.round(imageState.overlay * 100)}%)`}>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(imageState.overlay * 100)}
              onChange={(e) =>
                onPatchImmediateField({
                  background_type: "image",
                  background_value: serializeImageBackgroundValue({
                    ...imageState,
                    overlay: Number(e.target.value) / 100,
                  }),
                })
              }
              className="w-full accent-pink-500"
            />
          </Field>
          <Field label={`Blur (${imageState.blur}px)`}>
            <input
              type="range"
              min={0}
              max={20}
              value={imageState.blur}
              onChange={(e) =>
                onPatchImmediateField({
                  background_type: "image",
                  background_value: serializeImageBackgroundValue({
                    ...imageState,
                    blur: Number(e.target.value),
                  }),
                })
              }
              className="w-full accent-pink-500"
            />
          </Field>
        </div>
      ) : null}

      {activeTab === "animated" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {animatedState.colors.map((color, i) => (
              <Field key={i} label={`Color ${i + 1}`}>
                <NativeColorSwatch
                  value={color}
                  fallback="#ec4899"
                  onChange={(next) => {
                    const colors = [...animatedState.colors] as [string, string, string];
                    colors[i] = next;
                    onPatchImmediateField({
                      background_type: "animated",
                      background_value: buildAnimatedValue(colors, animatedState.speed),
                    });
                  }}
                />
              </Field>
            ))}
          </div>
          <Field label="Speed">
            <div className="flex gap-1">
              {ANIMATED_SPEEDS.map((speed) => (
                <button
                  key={speed.value}
                  type="button"
                  onClick={() =>
                    onPatchImmediateField({
                      background_type: "animated",
                      background_value: buildAnimatedValue(animatedState.colors, speed.value),
                    })
                  }
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[10px] transition-colors",
                    animatedState.speed === speed.value ? "text-pink-200" : "text-white/40 hover:text-white/65"
                  )}
                  style={{
                    borderColor: animatedState.speed === speed.value ? ACCENT : BORDER,
                    background: animatedState.speed === speed.value ? `${ACCENT}18` : "transparent",
                  }}
                >
                  {speed.label}
                </button>
              ))}
            </div>
          </Field>
          <div
            className="h-[60px] w-full rounded-lg border"
            style={{
              borderColor: BORDER,
              background: `linear-gradient(270deg, ${animatedState.colors.join(", ")})`,
              backgroundSize: "400% 400%",
              animation: `gradientShiftPreview ${
                animatedState.speed === "slow" ? "12s" : animatedState.speed === "fast" ? "4s" : "8s"
              } ease infinite`,
            }}
          />
          <style>{`
            @keyframes gradientShiftPreview {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
          `}</style>
        </div>
      ) : null}

      <div
        className="pointer-events-none h-8 w-full rounded-md border opacity-60"
        style={{
          cssText: previewCss,
          borderColor: BORDER,
        } as React.CSSProperties}
        aria-hidden
      />
    </div>
  );
}

function toColorInputValue(hex: string | undefined, fallback: string): string {
  if (!hex) return fallback;
  const trimmed = hex.trim();
  const full = trimmed.match(/^#([0-9a-fA-F]{6})$/);
  if (full) return `#${full[1].toLowerCase()}`;
  const short = trimmed.match(/^#([0-9a-fA-F]{3})$/);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

function NativeColorSwatch({
  value,
  fallback,
  onChange,
}: {
  value: string | undefined;
  fallback: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="color"
      value={toColorInputValue(value, fallback)}
      onChange={(e) => onChange(e.target.value)}
      style={COLOR_SWATCH_STYLE}
    />
  );
}

function OptionalColorField({
  value,
  fallback,
  onSwatchChange,
  onHexChange,
  onHexBlur,
  onReset,
}: {
  value: string | undefined;
  fallback: string;
  onSwatchChange: (value: string) => void;
  onHexChange: (value: string) => void;
  onHexBlur: () => void;
  onReset: () => void;
}) {
  const hasCustom = !!value?.trim();
  return (
    <div className="flex items-center gap-2">
      <NativeColorSwatch value={hasCustom ? value : fallback} fallback={fallback} onChange={onSwatchChange} />
      <FormInput
        value={value ?? ""}
        onChange={(e) => onHexChange(e.target.value)}
        onBlur={onHexBlur}
        placeholder="Theme default"
        className="min-w-0 flex-1 font-mono text-xs"
      />
      {hasCustom ? (
        <button
          type="button"
          onClick={onReset}
          className="shrink-0 rounded-lg border px-2 py-1.5 text-[10px] text-white/50 transition-colors hover:text-white/80"
          style={{ borderColor: BORDER }}
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}

const PLATFORM_PRESETS = LINK_PAGE_PLATFORMS.filter((p) => p.id !== "custom");

function blockPlatform(block: LinkPageBlockRecord): string {
  return detectLinkPlatform(block);
}

const BLOCK_TYPES: Array<{ value: LinkPageBlockType; label: string; icon: string }> = [
  { value: "link", label: "Link", icon: "🔗" },
  { value: "heading", label: "Heading", icon: "H" },
  { value: "bio_text", label: "Bio text", icon: "¶" },
  { value: "photo_grid", label: "Photo grid", icon: "🖼" },
  { value: "countdown", label: "Countdown", icon: "⏱" },
  { value: "social_bar", label: "Social bar", icon: "◎" },
  { value: "spacer", label: "Spacer", icon: "↕" },
];

const STATUS_FILTERS = [
  { value: "all" as const, label: "All" },
  { value: "published" as const, label: "Published" },
  { value: "draft" as const, label: "Draft" },
  { value: "archived" as const, label: "Archived" },
];

type SaveablePageFields = Pick<
  LinkPageRecord,
  | "title"
  | "slug"
  | "model_id"
  | "meta_description"
  | "show_powered_by"
  | "bio"
  | "profile_photo_url"
  | "theme"
  | "font"
  | "background_type"
  | "background_value"
  | "primary_color"
  | "accent_color"
  | "verified"
  | "meta_pixel_id"
  | "tiktok_pixel_id"
  | "cookie_notice_enabled"
  | "cookie_notice_text"
  | "bio_color"
  | "name_color"
>;

type DomainDnsRecord = {
  type: string;
  name: string;
  value: string;
};

type DomainStatusResponse = {
  vercelConfigured?: boolean;
  domain?: string;
  verified?: boolean;
  records?: DomainDnsRecord[];
  error?: string;
  page?: LinkPageRecord;
};

function pickSaveableFields(page: LinkPageRecord): SaveablePageFields {
  return {
    title: page.title,
    slug: page.slug,
    model_id: page.model_id,
    meta_description: page.meta_description,
    show_powered_by: page.show_powered_by,
    bio: page.bio,
    profile_photo_url: page.profile_photo_url,
    theme: page.theme,
    font: page.font,
    background_type: page.background_type,
    background_value: page.background_value,
    primary_color: page.primary_color,
    accent_color: page.accent_color,
    verified: page.verified,
    meta_pixel_id: page.meta_pixel_id ?? "",
    tiktok_pixel_id: page.tiktok_pixel_id ?? "",
    cookie_notice_enabled: page.cookie_notice_enabled ?? true,
    cookie_notice_text: page.cookie_notice_text ?? "",
    bio_color: page.bio_color ?? "",
    name_color: page.name_color ?? "",
  };
}

function diffSaveableFields(baseline: SaveablePageFields, current: SaveablePageFields): Partial<LinkPageRecord> {
  const patch: Partial<LinkPageRecord> = {};
  (Object.keys(baseline) as Array<keyof SaveablePageFields>).forEach((key) => {
    if (current[key] !== baseline[key]) {
      patch[key] = current[key] as never;
    }
  });
  return patch;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function dedupeBlocks(blocks: LinkPageBlockRecord[]): LinkPageBlockRecord[] {
  const byKey = new Map<string, LinkPageBlockRecord>();
  for (const block of blocks) {
    const key = block.block_id || block.id;
    const existing = byKey.get(key);
    if (!existing || block.updated_at > existing.updated_at) {
      byKey.set(key, block);
    }
  }
  return [...byKey.values()].sort((a, b) => a.sort_order - b.sort_order);
}

type BlockPatch = Partial<
  Pick<
    LinkPageBlockRecord,
    | "label"
    | "url"
    | "platform"
    | "sublabel"
    | "style"
    | "custom_button_color"
    | "icon"
    | "is_visible"
    | "heading_text"
    | "countdown_target"
    | "photo_urls"
    | "block_type"
    | "sort_order"
  >
>;

function validateSlug(slug: string): string | null {
  if (!slug) return "Slug is required";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "Use lowercase letters, numbers, and hyphens only";
  }
  return null;
}

type Props = {
  initialPages: LinkPageRecord[];
  modelById: Record<string, string>;
  models: ModelRecord[];
};

type Tab = "editor" | "analytics" | "ab_test";

export function AdminLinkPagesClient({ initialPages, modelById, models }: Props) {
  const { addToast } = useToast();
  const [pages, setPages] = React.useState(initialPages);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialPages[0]?.id ?? null);
  const [selectedPage, setSelectedPage] = React.useState<LinkPageWithBlocks | null>(null);
  const [tab, setTab] = React.useState<Tab>("editor");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "draft" | "published" | "archived">("all");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [analytics, setAnalytics] = React.useState<AnalyticsSummary | null>(null);
  const [realtime, setRealtime] = React.useState(0);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [redirects, setRedirects] = React.useState<LinkRedirectRecord[]>([]);
  const [redirectFormOpen, setRedirectFormOpen] = React.useState(false);

  /* UI-only state */
  const [globalAnalyticsOpen, setGlobalAnalyticsOpen] = React.useState(false);
  const [globalAnalytics, setGlobalAnalytics] = React.useState<GlobalAnalyticsSummary | null>(null);
  const [globalAnalyticsLoading, setGlobalAnalyticsLoading] = React.useState(false);
  const [previewDevice, setPreviewDevice] = React.useState<"mobile" | "desktop">("mobile");
  const [previewKey, setPreviewKey] = React.useState(0);
  const [lastPreviewRefresh, setLastPreviewRefresh] = React.useState(0);
  const [draft, setDraft] = React.useState<SaveablePageFields | null>(null);
  const [saved, setSaved] = React.useState<SaveablePageFields | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [slugError, setSlugError] = React.useState<string | null>(null);
  const [showQr, setShowQr] = React.useState(false);
  const draftRef = React.useRef(draft);
  const savedRef = React.useRef(saved);

  draftRef.current = draft;
  savedRef.current = saved;
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    () => new Set(["identity", "profile", "appearance", "blocks", "redirects"])
  );
  const [pageStatsMap, setPageStatsMap] = React.useState<Record<string, { views: number; clicks: number }>>({});
  const [analyticsDays, setAnalyticsDays] = React.useState(1);
  const [globalAnalyticsDays, setGlobalAnalyticsDays] = React.useState(1);
  const [abTest, setAbTest] = React.useState<AbTestResults | null>(null);
  const [abTestLoading, setAbTestLoading] = React.useState(false);
  const [abSetupOpen, setAbSetupOpen] = React.useState(false);
  const [abTestName, setAbTestName] = React.useState("");
  const [abActionLoading, setAbActionLoading] = React.useState(false);

  React.useEffect(() => {
    const id = "link-page-google-fonts";
    if (document.getElementById(id)) return;
    const pre1 = document.createElement("link");
    pre1.rel = "preconnect";
    pre1.href = "https://fonts.googleapis.com";
    document.head.appendChild(pre1);
    const pre2 = document.createElement("link");
    pre2.rel = "preconnect";
    pre2.href = "https://fonts.gstatic.com";
    pre2.crossOrigin = "anonymous";
    document.head.appendChild(pre2);
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = GOOGLE_FONTS_STYLESHEET;
    document.head.appendChild(link);
  }, []);

  const blockClickMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const link of analytics?.topLinks ?? []) {
      map[link.block_id] = link.clicks;
    }
    return map;
  }, [analytics?.topLinks]);

  const filteredPages = pages.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q) ||
      (modelById[p.model_id] ?? "").toLowerCase().includes(q)
    );
  });

  const loadPage = React.useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(id)}`);
      const data = (await res.json()) as { page?: LinkPageWithBlocks; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load page");
      const page = data.page ?? null;
      if (page) {
        setSelectedPage({ ...page, blocks: dedupeBlocks(page.blocks) });
      } else {
        setSelectedPage(null);
      }
    } catch (err) {
      addToast(localToast("Load failed", err instanceof Error ? err.message : "Could not load page", "high"));
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    if (selectedId) void loadPage(selectedId);
    else setSelectedPage(null);
  }, [selectedId, loadPage]);

  React.useEffect(() => {
    if (!selectedPage) {
      setDraft(null);
      setSaved(null);
      setIsSaving(false);
      setSlugError(null);
      return;
    }
    const fields = pickSaveableFields(selectedPage);
    setDraft(fields);
    setSaved(fields);
    setIsSaving(false);
    setSlugError(null);
  }, [selectedPage?.id]);

  const hasUnsavedChanges = React.useMemo(() => {
    if (!draft || !saved) return false;
    return Object.keys(diffSaveableFields(saved, draft)).length > 0;
  }, [draft, saved]);

  const refreshPreview = React.useCallback(() => {
    const now = Date.now();
    if (now - lastPreviewRefresh < 10000) return;
    setLastPreviewRefresh(now);
    setTimeout(() => setPreviewKey((prev) => prev + 1), 2000);
  }, [lastPreviewRefresh]);

  const handleSave = React.useCallback(
    async (data?: SaveablePageFields) => {
      if (!selectedId || !selectedPage || !savedRef.current) return;

      const source = data ?? draftRef.current;
      if (!source) return;

      let currentDraft = { ...source };
      if ("slug" in diffSaveableFields(savedRef.current, currentDraft)) {
        const normalizedSlug = slugify(currentDraft.slug);
        const slugValidation = validateSlug(normalizedSlug);
        if (slugValidation) {
          setSlugError(slugValidation);
          addToast(localToast("Invalid slug", slugValidation, "high"));
          return;
        }
        currentDraft.slug = normalizedSlug;
        if (normalizedSlug !== source.slug) {
          setDraft(currentDraft);
        }
      }

      const patch = diffSaveableFields(savedRef.current, currentDraft);
      if (Object.keys(patch).length === 0) {
        setSlugError(null);
        return;
      }

      setSlugError(null);
      setIsSaving(true);
      try {
        const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const responseData = (await res.json()) as { page?: LinkPageRecord; error?: string };
        if (!res.ok) throw new Error(responseData.error ?? "Save failed");
        if (responseData.page) {
          const savedFields = pickSaveableFields(responseData.page);
          setSaved(savedFields);
          setDraft(savedFields);
          setPages((prev) =>
            prev.map((p) => (p.id === responseData.page!.id ? { ...p, ...responseData.page } : p))
          );
          setSelectedPage((prev) => (prev ? { ...prev, ...responseData.page! } : prev));
          refreshPreview();
        }
      } catch (err) {
        addToast(localToast("Save failed", err instanceof Error ? err.message : "Error", "high"));
      } finally {
        setIsSaving(false);
      }
    },
    [selectedId, selectedPage, addToast, refreshPreview]
  );

  const updateTextDraft = React.useCallback((patch: Partial<SaveablePageFields>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    if ("slug" in patch) {
      const normalized = slugify(patch.slug ?? "");
      setSlugError(validateSlug(normalized));
    }
  }, []);

  const updateImmediateField = React.useCallback(
    (patch: Partial<SaveablePageFields>) => {
      const next = draftRef.current ? { ...draftRef.current, ...patch } : null;
      if (!next) return;
      setDraft(next);
      void handleSave(next);
    },
    [handleSave]
  );

  const handleFieldBlur = React.useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const handleDomainUpdated = React.useCallback(
    (domain: string) => {
      if (!selectedId) return;
      setPages((prev) => prev.map((p) => (p.id === selectedId ? { ...p, custom_domain: domain } : p)));
      setSelectedPage((prev) => (prev ? { ...prev, custom_domain: domain } : prev));
    },
    [selectedId]
  );

  const loadAnalytics = React.useCallback(async (id: string, days = analyticsDays) => {
    try {
      const [aRes, rRes] = await Promise.all([
        fetch(`/api/admin/link-pages/${encodeURIComponent(id)}/analytics?days=${days}`),
        fetch(`/api/admin/link-pages/${encodeURIComponent(id)}/analytics/realtime`),
      ]);
      const aData = (await aRes.json()) as { summary?: AnalyticsSummary };
      const rData = (await rRes.json()) as { count?: number };
      setAnalytics(aData.summary ?? null);
      setRealtime(rData.count ?? 0);
    } catch {
      setAnalytics(null);
    }
  }, [analyticsDays]);

  React.useEffect(() => {
    if (selectedId) void loadAnalytics(selectedId, analyticsDays);
  }, [selectedId, analyticsDays, loadAnalytics]);

  const loadAbTest = React.useCallback(async (id: string) => {
    setAbTestLoading(true);
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(id)}/ab-test`);
      const data = (await res.json()) as { results?: AbTestResults; page?: LinkPageRecord; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load A/B test");
      setAbTest(data.results ?? null);
      if (data.page) {
        setSelectedPage((prev) => (prev ? { ...prev, ...data.page } : prev));
        setPages((prev) => prev.map((p) => (p.id === data.page!.id ? { ...p, ...data.page } : p)));
      }
    } catch (err) {
      addToast(localToast("A/B test load failed", err instanceof Error ? err.message : "Error", "high"));
    } finally {
      setAbTestLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    if (tab === "ab_test" && selectedId) void loadAbTest(selectedId);
  }, [tab, selectedId, loadAbTest]);

  React.useEffect(() => {
    if (tab !== "ab_test" || !selectedId) return;
    const t = setInterval(() => void loadAbTest(selectedId), 30_000);
    return () => clearInterval(t);
  }, [tab, selectedId, loadAbTest]);


  React.useEffect(() => {
    if (tab === "analytics" && selectedId) void loadAnalytics(selectedId, analyticsDays);
  }, [tab, selectedId, analyticsDays, loadAnalytics]);

  React.useEffect(() => {
    if (tab !== "analytics" || !selectedId) return;
    const t = setInterval(() => void loadAnalytics(selectedId, analyticsDays), 30_000);
    return () => clearInterval(t);
  }, [tab, selectedId, analyticsDays, loadAnalytics]);

  const loadGlobalAnalytics = React.useCallback(async (days = globalAnalyticsDays) => {
    setGlobalAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/admin/link-pages/analytics/global?days=${days}`);
      const data = (await res.json()) as { summary?: GlobalAnalyticsSummary; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load global analytics");
      setGlobalAnalytics(data.summary ?? null);
      if (data.summary) {
        const map: Record<string, { views: number; clicks: number }> = {};
        for (const row of data.summary.leaderboard) {
          map[row.page_id] = { views: row.views, clicks: row.clicks };
        }
        setPageStatsMap(map);
      }
    } catch (err) {
      addToast(
        localToast("Analytics failed", err instanceof Error ? err.message : "Could not load", "high")
      );
    } finally {
      setGlobalAnalyticsLoading(false);
    }
  }, [addToast, globalAnalyticsDays]);

  React.useEffect(() => {
    if (globalAnalyticsOpen) void loadGlobalAnalytics(globalAnalyticsDays);
  }, [globalAnalyticsOpen, globalAnalyticsDays, loadGlobalAnalytics]);

  async function createPage() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/link-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New link page" }),
      });
      const data = (await res.json()) as { page?: LinkPageRecord; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      if (data.page) {
        setPages((prev) => [data.page!, ...prev]);
        setSelectedId(data.page.id);
        setGlobalAnalyticsOpen(false);
        addToast(localToast("Page created", data.page.title, "normal"));
      }
    } catch (err) {
      addToast(localToast("Create failed", err instanceof Error ? err.message : "Error", "high"));
    } finally {
      setSaving(false);
    }
  }

  async function publish(action: "publish" | "unpublish" | "archive" = "publish") {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action === "publish" ? undefined : action }),
      });
      const data = (await res.json()) as { page?: LinkPageRecord; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      if (data.page) {
        setPages((prev) => prev.map((p) => (p.id === data.page!.id ? data.page! : p)));
        setSelectedPage((prev) => (prev ? { ...prev, ...data.page! } : prev));
        addToast(localToast("Updated", `Status: ${data.page.status}`, "normal"));
      }
    } catch (err) {
      addToast(localToast("Failed", err instanceof Error ? err.message : "Error", "high"));
    } finally {
      setSaving(false);
    }
  }

  async function deletePage() {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Delete failed");
      }
      setPages((prev) => prev.filter((p) => p.id !== selectedId));
      setSelectedId(pages.find((p) => p.id !== selectedId)?.id ?? null);
      addToast(localToast("Deleted", "Page removed", "normal"));
    } catch (err) {
      addToast(localToast("Delete failed", err instanceof Error ? err.message : "Error", "high"));
    }
    setDeleteOpen(false);
  }

  const refreshBlocks = React.useCallback(async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}/blocks`);
      const data = (await res.json()) as { blocks?: LinkPageBlockRecord[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to refresh blocks");
      if (data.blocks) {
        setSelectedPage((prev) => (prev ? { ...prev, blocks: dedupeBlocks(data.blocks!) } : prev));
      }
    } catch (err) {
      addToast(
        localToast("Block refresh failed", err instanceof Error ? err.message : "Could not refresh blocks", "high")
      );
    }
  }, [selectedId, addToast]);

  const refreshRedirects = React.useCallback(async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}/redirects`);
      const data = (await res.json()) as { redirects?: LinkRedirectRecord[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to refresh redirects");
      if (data.redirects) setRedirects(data.redirects);
    } catch (err) {
      addToast(
        localToast(
          "Redirect refresh failed",
          err instanceof Error ? err.message : "Could not refresh redirects",
          "high"
        )
      );
    }
  }, [selectedId, addToast]);

  React.useEffect(() => {
    if (selectedId) void refreshRedirects();
  }, [selectedId, refreshRedirects]);

  async function addBlock(type: LinkPageBlockType) {
    if (!selectedId || !selectedPage) return;
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_type: type,
          label: type === "heading" ? "Section title" : type === "link" ? "New link" : "",
          sort_order: selectedPage.blocks.length,
        }),
      });
      const data = (await res.json()) as { block?: LinkPageBlockRecord; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Add block failed");
      if (data.block) {
        await refreshBlocks();
      }
    } catch (err) {
      addToast(localToast("Add block failed", err instanceof Error ? err.message : "Error", "high"));
    }
  }

  async function updateBlock(blockId: string, patch: BlockPatch) {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/admin/link-pages/blocks/${encodeURIComponent(blockId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { block?: LinkPageBlockRecord; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      await refreshBlocks();
      return data.block;
    } catch (err) {
      addToast(localToast("Block save failed", err instanceof Error ? err.message : "Error", "high"));
    }
  }

  async function removeBlock(blockId: string) {
    try {
      const res = await fetch(`/api/admin/link-pages/blocks/${encodeURIComponent(blockId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setSelectedPage((prev) =>
        prev ? { ...prev, blocks: prev.blocks.filter((b) => b.id !== blockId) } : prev
      );
    } catch (err) {
      addToast(localToast("Delete block failed", err instanceof Error ? err.message : "Error", "high"));
    }
  }

  async function reorderBlocks(newBlocks: LinkPageBlockRecord[]) {
    if (!selectedId || !selectedPage) return;
    setSelectedPage({ ...selectedPage, blocks: newBlocks });
    try {
      await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}/blocks/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: newBlocks.map((b) => b.id) }),
      });
    } catch {
      addToast(localToast("Reorder failed", "Could not save order", "high"));
    }
  }

  function moveBlock(index: number, dir: -1 | 1) {
    if (!selectedPage) return;
    const next = [...selectedPage.blocks].sort((a, b) => a.sort_order - b.sort_order);
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void reorderBlocks(next);
  }

  async function createRedirect(input: { label: string; slug: string; destination_url: string }) {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}/redirects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as { redirect?: LinkRedirectRecord; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Create redirect failed");
      await refreshRedirects();
      setRedirectFormOpen(false);
      addToast(localToast("Redirect created", data.redirect?.label ?? "New redirect", "normal"));
    } catch (err) {
      addToast(localToast("Create redirect failed", err instanceof Error ? err.message : "Error", "high"));
    }
  }

  async function updateRedirectRow(redirectId: string, patch: Partial<LinkRedirectRecord>) {
    if (!selectedId) return;
    try {
      const res = await fetch(
        `/api/admin/link-pages/${encodeURIComponent(selectedId)}/redirects/${encodeURIComponent(redirectId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      );
      const data = (await res.json()) as { redirect?: LinkRedirectRecord; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      await refreshRedirects();
      return data.redirect;
    } catch (err) {
      addToast(localToast("Redirect save failed", err instanceof Error ? err.message : "Error", "high"));
    }
  }

  async function removeRedirect(redirectId: string) {
    if (!selectedId) return;
    try {
      const res = await fetch(
        `/api/admin/link-pages/${encodeURIComponent(selectedId)}/redirects/${encodeURIComponent(redirectId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      setRedirects((prev) => prev.filter((r) => r.id !== redirectId));
      addToast(localToast("Redirect deleted", "Short URL removed", "normal"));
    } catch (err) {
      addToast(localToast("Delete redirect failed", err instanceof Error ? err.message : "Error", "high"));
    }
  }

  function copyRedirectUrl(page: LinkPageRecord, redirectSlug: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://gunzoteam.com";
    const url = buildRedirectPublicUrl(page, redirectSlug, origin);
    void navigator.clipboard.writeText(url);
    addToast(localToast("Copied", "Short URL copied to clipboard", "normal"));
  }

  async function uploadPhoto(file: File, onUrl: (url: string) => void) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/link-pages/upload", { method: "POST", body: form });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");
    onUrl(data.url);
  }

  function patchBlockLocal(blockId: string, patch: Partial<LinkPageBlockRecord>) {
    setSelectedPage((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
      };
    });
  }

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function copyPublicUrl() {
    if (!publicUrl) return;
    void navigator.clipboard.writeText(publicUrl);
    addToast(localToast("Copied", "Link copied to clipboard", "normal"));
  }

  const editingPage = selectedPage && draft ? { ...selectedPage, ...draft } : selectedPage;

  const publicUrl = saved?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${ROUTES.linkPage(saved.slug)}`
    : "";

  const previewUrl = saved?.slug
    ? `${ROUTES.linkPage(saved.slug)}?preview=true&t=${previewKey}`
    : "";

  const qrUrl = publicUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(publicUrl)}`
    : "";

  const showPreview = !globalAnalyticsOpen && tab === "editor";
  const isWideTab = tab === "analytics" || tab === "ab_test";

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden" style={{ background: BG }}>
      {/* ── LEFT PANEL ── */}
      <aside
        className="flex shrink-0 flex-col border-r"
        style={{ width: 280, background: PANEL, borderColor: BORDER }}
      >
        <div className="border-b p-4" style={{ borderColor: BORDER }}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h1 className="text-base font-bold text-white">Link Pages</h1>
              <p className="mt-0.5 text-[11px] leading-snug text-white/40">Build link-in-bio pages for models</p>
            </div>
            <button
              type="button"
              onClick={() => void createPage()}
              disabled={saving}
              title="New page"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setGlobalAnalyticsOpen((v) => !v);
              if (!globalAnalyticsOpen) setTab("editor");
            }}
            className={cn(
              "mb-3 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              globalAnalyticsOpen
                ? "border-pink-500/40 bg-pink-500/10 text-pink-200"
                : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/80"
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            All pages analytics
          </button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pages…"
              className="w-full rounded-lg border py-2 pl-8 pr-3 text-xs text-white placeholder:text-white/30"
              style={{ background: BG, borderColor: BORDER }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors",
                  statusFilter === f.value
                    ? "text-white"
                    : "text-white/40 hover:text-white/70"
                )}
                style={
                  statusFilter === f.value
                    ? { background: `${ACCENT}22`, color: ACCENT, border: `1px solid ${ACCENT}44` }
                    : { border: `1px solid ${BORDER}` }
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filteredPages.map((p) => {
            const stats = pageStatsMap[p.page_id];
            const isSelected = selectedId === p.id && !globalAnalyticsOpen;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedId(p.id);
                  setGlobalAnalyticsOpen(false);
                }}
                className={cn(
                  "mb-1.5 flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all",
                  isSelected ? "border-pink-500/50 bg-pink-500/[0.08]" : "border-transparent hover:border-white/10 hover:bg-white/[0.03]"
                )}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 text-sm font-bold text-white/60"
                  style={{ borderColor: isSelected ? ACCENT : "rgba(255,255,255,0.12)", background: "#141414" }}
                >
                  {p.profile_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.profile_photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (p.title || "?").charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <span className="truncate text-sm font-medium text-white">{p.title || "Untitled"}</span>
                    <StatusPill status={p.status} />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-white/35">/{p.slug}</p>
                  {p.model_id ? (
                    <p className="mt-0.5 truncate text-[10px] text-white/25">{modelById[p.model_id] ?? "Model"}</p>
                  ) : null}
                  {stats ? (
                    <div className="mt-1.5 flex gap-3 text-[10px] tabular-nums text-white/40">
                      <span>{stats.views.toLocaleString()} views</span>
                      <span>{stats.clicks.toLocaleString()} clicks</span>
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
          {filteredPages.length === 0 ? (
            <p className="py-12 text-center text-xs text-white/30">No pages found</p>
          ) : null}
        </div>
      </aside>

      {/* ── GLOBAL ANALYTICS (full width) ── */}
      {globalAnalyticsOpen ? (
        <main className="flex flex-1 flex-col overflow-hidden" style={{ background: BG }}>
          <GlobalAnalyticsPanel
            summary={globalAnalytics}
            loading={globalAnalyticsLoading}
            pages={pages}
            days={globalAnalyticsDays}
            onDaysChange={setGlobalAnalyticsDays}
            onSelectPage={(id) => {
              setSelectedId(id);
              setGlobalAnalyticsOpen(false);
            }}
            onRefresh={() => void loadGlobalAnalytics(globalAnalyticsDays)}
          />
        </main>
      ) : (
        <>
          {/* ── CENTER PANEL ── */}
          <section
            className="flex shrink-0 flex-col overflow-hidden border-r"
            style={{ width: isWideTab ? undefined : 400, flex: isWideTab ? 1 : undefined, background: PANEL, borderColor: BORDER }}
          >
            {!selectedPage && !loading ? (
              <EmptyState message="Select or create a page" />
            ) : loading ? (
              <LoadingState />
            ) : selectedPage ? (
              <>
                {/* Tab bar + actions */}
                <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: BORDER }}>
                  <div
                    className="flex shrink-0 items-center gap-0.5 rounded-full border p-0.5"
                    style={{ borderColor: BORDER, background: BG }}
                  >
                    <TabBtn active={tab === "editor"} onClick={() => setTab("editor")}>
                      Editor
                    </TabBtn>
                    <TabBtn active={tab === "analytics"} onClick={() => setTab("analytics")}>
                      <BarChart3 className="mr-1 inline h-3.5 w-3.5" />
                      Analytics
                    </TabBtn>
                    <TabBtn active={tab === "ab_test"} onClick={() => setTab("ab_test")}>
                      <FlaskConical className="mr-1 inline h-3.5 w-3.5" />
                      A/B Test
                    </TabBtn>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          selectedPage.status === "published" ? "text-emerald-400/90" : "text-white/45"
                        )}
                      >
                        {selectedPage.status === "published" ? "Published" : "Draft"}
                      </span>
                      <StatusToggle
                        status={selectedPage.status}
                        onPublish={() => void publish("publish")}
                        onUnpublish={() => void publish("unpublish")}
                        disabled={saving}
                      />
                    </div>

                    <div className="h-4 w-px shrink-0 bg-white/10" aria-hidden />

                    {selectedPage.status === "published" ? (
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-white/55 transition-colors hover:text-white/90"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Live
                      </a>
                    ) : null}

                    {tab === "editor" ? (
                      <>
                        <SaveStatusIndicator isSaving={isSaving} hasUnsavedChanges={hasUnsavedChanges} />
                        {hasUnsavedChanges ? (
                          <button
                            type="button"
                            onClick={() => void handleSave()}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                            style={{ background: ACCENT }}
                          >
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            Save
                          </button>
                        ) : null}
                      </>
                    ) : null}

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => void publish("archive")}
                        className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/[0.04] hover:text-white/60"
                        title="Archive"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteOpen(true)}
                        className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-rose-500/10 hover:text-rose-400/80"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {tab === "editor" ? (
                    <EditorPanel
                      page={editingPage!}
                      pageId={selectedId!}
                      models={models}
                      expandedSections={expandedSections}
                      onToggleSection={toggleSection}
                      onPatchTextField={updateTextDraft}
                      onPatchImmediateField={updateImmediateField}
                      onFieldBlur={handleFieldBlur}
                      slugError={slugError}
                      onDomainUpdated={handleDomainUpdated}
                      onAddBlock={(t) => void addBlock(t)}
                      onUpdateBlock={updateBlock}
                      onRemoveBlock={(id) => void removeBlock(id)}
                      onMoveBlock={moveBlock}
                      onUpload={uploadPhoto}
                      patchBlock={patchBlockLocal}
                      dragIndex={dragIndex}
                      setDragIndex={setDragIndex}
                      onReorder={(blocks) => void reorderBlocks(blocks)}
                      blockClickMap={blockClickMap}
                      redirects={redirects}
                      redirectFormOpen={redirectFormOpen}
                      onToggleRedirectForm={() => setRedirectFormOpen((v) => !v)}
                      onCreateRedirect={(input) => void createRedirect(input)}
                      onUpdateRedirect={(id, patch) => void updateRedirectRow(id, patch)}
                      onDeleteRedirect={(id) => void removeRedirect(id)}
                      onCopyRedirectUrl={(slug) => selectedPage && copyRedirectUrl(selectedPage, slug)}
                    />
                  ) : tab === "analytics" ? (
                    <div className="p-4">
                      <AnalyticsPanel
                        summary={analytics}
                        realtime={realtime}
                        pageTitle={selectedPage.title}
                        days={analyticsDays}
                        onDaysChange={setAnalyticsDays}
                      />
                    </div>
                  ) : (
                    <div className="p-4">
                      <AbTestPanel
                        page={selectedPage}
                        results={abTest}
                        loading={abTestLoading}
                        actionLoading={abActionLoading}
                        setupOpen={abSetupOpen}
                        testName={abTestName}
                        onTestNameChange={setAbTestName}
                        onOpenSetup={() => setAbSetupOpen(true)}
                        onCloseSetup={() => setAbSetupOpen(false)}
                        onRefresh={() => selectedId && void loadAbTest(selectedId)}
                        onCreateVariant={async () => {
                          if (!selectedId) return;
                          setAbActionLoading(true);
                          try {
                            const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}/ab-test`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "create_variant" }),
                            });
                            const data = (await res.json()) as { error?: string };
                            if (!res.ok) throw new Error(data.error ?? "Failed to create variant");
                            addToast(localToast("Variant created", "Variant B page cloned from current design", "normal"));
                            await loadAbTest(selectedId);
                          } catch (err) {
                            addToast(localToast("Create variant failed", err instanceof Error ? err.message : "Error", "high"));
                          } finally {
                            setAbActionLoading(false);
                          }
                        }}
                        onStartTest={async () => {
                          if (!selectedId) return;
                          setAbActionLoading(true);
                          try {
                            const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}/ab-test`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ testName: abTestName || "A/B Test" }),
                            });
                            const data = (await res.json()) as { error?: string };
                            if (!res.ok) throw new Error(data.error ?? "Failed to start test");
                            setAbSetupOpen(false);
                            addToast(localToast("A/B test started", "Traffic is now split 50/50", "normal"));
                            await loadAbTest(selectedId);
                          } catch (err) {
                            addToast(localToast("Start test failed", err instanceof Error ? err.message : "Error", "high"));
                          } finally {
                            setAbActionLoading(false);
                          }
                        }}
                        onStopTest={async () => {
                          if (!selectedId) return;
                          setAbActionLoading(true);
                          try {
                            const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(selectedId)}/ab-test`, {
                              method: "DELETE",
                            });
                            const data = (await res.json()) as { error?: string };
                            if (!res.ok) throw new Error(data.error ?? "Failed to stop test");
                            addToast(localToast("A/B test stopped", "Traffic split disabled", "normal"));
                            await loadAbTest(selectedId);
                          } catch (err) {
                            addToast(localToast("Stop test failed", err instanceof Error ? err.message : "Error", "high"));
                          } finally {
                            setAbActionLoading(false);
                          }
                        }}
                        onDeclareWinner={async (winner) => {
                          if (!selectedId) return;
                          setAbActionLoading(true);
                          try {
                            const res = await fetch(
                              `/api/admin/link-pages/${encodeURIComponent(selectedId)}/ab-test/winner`,
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ winner }),
                              }
                            );
                            const data = (await res.json()) as { error?: string };
                            if (!res.ok) throw new Error(data.error ?? "Failed to declare winner");
                            addToast(localToast("Winner declared", `Variant ${winner.toUpperCase()} applied`, "normal"));
                            await loadPage(selectedId);
                            await loadAbTest(selectedId);
                          } catch (err) {
                            addToast(localToast("Declare winner failed", err instanceof Error ? err.message : "Error", "high"));
                          } finally {
                            setAbActionLoading(false);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </section>

          {/* ── RIGHT PANEL — Live Preview ── */}
          {showPreview ? (
            <aside
              className="flex shrink-0 flex-col overflow-hidden"
              style={{ width: 400, background: PANEL }}
            >
              <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: BORDER }}>
                <span className="text-sm font-semibold text-white/80">Preview</span>
                <div className="flex gap-1 rounded-lg p-0.5" style={{ background: BG }}>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={cn(
                      "rounded-md p-1.5 transition-colors",
                      previewDevice === "mobile" ? "text-pink-300" : "text-white/40 hover:text-white/70"
                    )}
                    style={previewDevice === "mobile" ? { background: `${ACCENT}22` } : undefined}
                    title="Mobile"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={cn(
                      "rounded-md p-1.5 transition-colors",
                      previewDevice === "desktop" ? "text-pink-300" : "text-white/40 hover:text-white/70"
                    )}
                    style={previewDevice === "desktop" ? { background: `${ACCENT}22` } : undefined}
                    title="Desktop"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="shrink-0 border-b px-4 py-2.5" style={{ borderColor: BORDER }}>
                <button
                  type="button"
                  onClick={() => setPreviewKey((k) => k + 1)}
                  disabled={!previewUrl}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium text-white/75 transition-colors hover:border-pink-500/40 hover:bg-pink-500/[0.06] hover:text-pink-200 disabled:opacity-40"
                  style={{ borderColor: BORDER, background: BG }}
                  title="Refresh preview"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  ↺ Refresh preview
                </button>
              </div>

              {/* URL bar */}
              <div className="shrink-0 space-y-2 border-b px-4 py-3" style={{ borderColor: BORDER }}>
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ background: BG, borderColor: BORDER }}>
                  <Link2 className="h-3 w-3 shrink-0 text-white/30" />
                  <span className="min-w-0 flex-1 truncate text-[11px] text-white/50">{publicUrl || "—"}</span>
                  <button type="button" onClick={copyPublicUrl} className="text-white/40 hover:text-white/70" title="Copy URL">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-2">
                  {publicUrl ? (
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] text-white/60 transition-colors hover:text-white/90"
                      style={{ borderColor: BORDER }}
                    >
                      <ExternalLink className="h-3 w-3" /> Test live
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowQr((v) => !v)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] transition-colors",
                      showQr ? "text-pink-300" : "text-white/60 hover:text-white/90"
                    )}
                    style={{ borderColor: showQr ? `${ACCENT}44` : BORDER }}
                  >
                    <QrCode className="h-3 w-3" /> QR
                  </button>
                </div>
                {showQr && qrUrl ? (
                  <div className="flex justify-center rounded-lg border p-3" style={{ borderColor: BORDER, background: BG }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="QR code" width={160} height={160} className="rounded" />
                  </div>
                ) : null}
              </div>

              {/* Preview frame */}
              <div className="flex flex-1 items-start justify-center overflow-y-auto p-4">
                {previewUrl ? (
                  previewDevice === "mobile" ? (
                    <div
                      className="relative overflow-hidden rounded-[2rem] border-[3px] shadow-2xl"
                      style={{
                        width: 375 * 0.85,
                        height: 667 * 0.85,
                        borderColor: "#1a1a1a",
                        background: "#000",
                      }}
                    >
                      <iframe
                        key={previewKey}
                        src={previewUrl}
                        title="Mobile preview"
                        className="border-0"
                        style={{
                          width: 375,
                          height: 667,
                          transform: "scale(0.85)",
                          transformOrigin: "top left",
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      className="overflow-hidden rounded-xl border shadow-2xl"
                      style={{
                        width: 1024 * 0.4,
                        height: 768 * 0.4,
                        borderColor: BORDER,
                        background: "#000",
                      }}
                    >
                      <iframe
                        key={previewKey}
                        src={previewUrl}
                        title="Desktop preview"
                        className="border-0"
                        style={{
                          width: 1024,
                          height: 768,
                          transform: "scale(0.4)",
                          transformOrigin: "top left",
                        }}
                      />
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2 text-xs text-white/30">Add a slug to preview</div>
                )}
              </div>
            </aside>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete page?"
        description="This removes the page and all its blocks. This cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => void deletePage()}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-white/30">{message}</div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: ACCENT }} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "published"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : status === "archived"
        ? "bg-white/10 text-white/45 border-white/15"
        : "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return (
    <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase", cls)}>
      {status}
    </span>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "text-pink-200" : "text-white/45 hover:text-white/75"
      )}
      style={active ? { background: `${ACCENT}22` } : undefined}
    >
      {children}
    </button>
  );
}

function StatusToggle({
  status,
  onPublish,
  onUnpublish,
  disabled,
}: {
  status: string;
  onPublish: () => void;
  onUnpublish: () => void;
  disabled: boolean;
}) {
  const isPublished = status === "published";
  return (
    <button
      type="button"
      disabled={disabled || status === "archived"}
      onClick={() => (isPublished ? onUnpublish() : onPublish())}
      className={cn(
        "relative flex h-7 w-[52px] items-center rounded-full border transition-colors disabled:opacity-40",
        isPublished ? "border-emerald-500/40 bg-emerald-500/20" : "border-white/15 bg-white/[0.06]"
      )}
      title={isPublished ? "Published — click to unpublish" : "Draft — click to publish"}
    >
      <span
        className={cn(
          "absolute h-5 w-5 rounded-full bg-white shadow transition-transform",
          isPublished ? "translate-x-[26px]" : "translate-x-1"
        )}
      />
    </button>
  );
}

function AccordionSection({
  id,
  title,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b" style={{ borderColor: BORDER }}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-white/60">{title}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-white/30" />
        ) : (
          <ChevronRight className="h-4 w-4 text-white/30" />
        )}
      </button>
      {expanded ? <div className="space-y-3 px-4 pb-4">{children}</div> : null}
    </div>
  );
}

function SaveStatusIndicator({
  isSaving,
  hasUnsavedChanges,
}: {
  isSaving: boolean;
  hasUnsavedChanges: boolean;
}) {
  if (isSaving) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-white/45">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (hasUnsavedChanges) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        Unsaved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400/90">
      <CheckCircle2 className="h-3 w-3" />
      Saved
    </span>
  );
}

function DnsCopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] text-white/55 transition hover:bg-white/5"
      style={{ borderColor: BORDER }}
      title={`Copy ${label}`}
    >
      {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function LinkPageDomainManager({
  pageId,
  customDomain,
  onDomainUpdated,
}: {
  pageId: string;
  customDomain: string;
  onDomainUpdated: (domain: string) => void;
}) {
  const { addToast } = useToast();
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<DomainStatusResponse | null>(null);
  const [vercelConfigured, setVercelConfigured] = React.useState<boolean | null>(null);

  const checkStatus = React.useCallback(async () => {
    if (!customDomain.trim()) {
      setStatus(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/link-pages/${encodeURIComponent(pageId)}/domain?domain=${encodeURIComponent(customDomain)}`
      );
      const data = (await res.json()) as DomainStatusResponse;
      if (data.vercelConfigured !== undefined) setVercelConfigured(data.vercelConfigured);
      setStatus(data);
    } catch {
      setStatus({ domain: customDomain, verified: false, records: [] });
    } finally {
      setLoading(false);
    }
  }, [pageId, customDomain]);

  React.useEffect(() => {
    if (!customDomain.trim()) {
      setStatus(null);
      setInput("");
      void fetch(`/api/admin/link-pages/${encodeURIComponent(pageId)}/domain`)
        .then((r) => r.json())
        .then((data: DomainStatusResponse) => {
          if (data.vercelConfigured !== undefined) setVercelConfigured(data.vercelConfigured);
        })
        .catch(() => setVercelConfigured(false));
      return;
    }
    void checkStatus();
  }, [pageId, customDomain, checkStatus]);

  React.useEffect(() => {
    if (!customDomain.trim() || status?.verified) return;
    const t = setInterval(() => void checkStatus(), 30_000);
    return () => clearInterval(t);
  }, [customDomain, status?.verified, checkStatus]);

  async function connectDomain() {
    const domain = input.trim();
    if (!domain) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(pageId)}/domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = (await res.json()) as DomainStatusResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to connect domain");
      if (data.vercelConfigured !== undefined) setVercelConfigured(data.vercelConfigured);
      if (data.page) onDomainUpdated(data.page.custom_domain);
      else onDomainUpdated(data.domain ?? domain);
      setStatus(data);
      setInput("");
      addToast(localToast("Domain connected", data.domain ?? domain, "normal"));
    } catch (err) {
      addToast(
        localToast("Domain failed", err instanceof Error ? err.message : "Could not connect domain", "high")
      );
    } finally {
      setLoading(false);
    }
  }

  async function removeDomain() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/link-pages/${encodeURIComponent(pageId)}/domain`, {
        method: "DELETE",
      });
      const data = (await res.json()) as DomainStatusResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to remove domain");
      onDomainUpdated("");
      setStatus(null);
      setInput("");
      addToast(localToast("Domain removed", "Custom domain disconnected", "normal"));
    } catch (err) {
      addToast(
        localToast("Remove failed", err instanceof Error ? err.message : "Could not remove domain", "high")
      );
    } finally {
      setLoading(false);
    }
  }

  const isVerified = Boolean(customDomain && status?.verified);
  const visitUrl = customDomain ? `https://${customDomain}` : "";

  return (
    <div className="space-y-2">
      {vercelConfigured === false ? (
        <div
          className="flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] text-amber-200/90"
          style={{ borderColor: "rgba(251,191,36,0.25)", background: "rgba(251,191,36,0.08)" }}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Automatic domain setup is unavailable. Set <code className="text-amber-100/80">VERCEL_TOKEN</code> and{" "}
            <code className="text-amber-100/80">VERCEL_PROJECT_ID</code> on the server.
          </span>
        </div>
      ) : null}

      {!customDomain ? (
        <div
          className="rounded-lg border border-dashed px-3 py-4"
          style={{ borderColor: "rgba(255,255,255,0.15)" }}
        >
          <p className="mb-2 text-[11px] text-white/45">Connect a custom domain (e.g. links.example.com)</p>
          <div className="flex gap-2">
            <FormInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="links.example.com"
              disabled={loading || vercelConfigured === false}
              onKeyDown={(e) => {
                if (e.key === "Enter") void connectDomain();
              }}
            />
            <button
              type="button"
              onClick={() => void connectDomain()}
              disabled={loading || !input.trim() || vercelConfigured === false}
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-white transition disabled:opacity-40"
              style={{ background: ACCENT }}
            >
              Connect
            </button>
          </div>
        </div>
      ) : loading && !status ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border py-8" style={{ borderColor: BORDER }}>
          <Loader2 className="h-4 w-4 animate-spin text-white/40" />
          <span className="text-xs text-white/45">Checking domain…</span>
        </div>
      ) : isVerified ? (
        <div
          className="space-y-3 rounded-lg border px-3 py-3"
          style={{ borderColor: "rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.08)" }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-300">Active</span>
            <span className="truncate text-xs text-white/60">{customDomain}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={visitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] text-white/70 transition hover:text-white"
              style={{ borderColor: BORDER }}
            >
              <ExternalLink className="h-3 w-3" /> Visit link
            </a>
            <button
              type="button"
              onClick={() => void removeDomain()}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] text-rose-300/80 transition hover:text-rose-200 disabled:opacity-40"
              style={{ borderColor: "rgba(244,63,94,0.25)" }}
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          className="space-y-3 rounded-lg border px-3 py-3"
          style={{ borderColor: "rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.06)" }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-amber-200">Pending DNS</p>
              <p className="mt-0.5 text-[11px] text-white/50">{customDomain}</p>
            </div>
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-amber-200/60" /> : null}
          </div>

          {status?.error ? (
            <p className="text-[11px] text-rose-300/80">{status.error}</p>
          ) : null}

          {(status?.records ?? []).length > 0 ? (
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: BORDER }}>
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b text-white/40" style={{ borderColor: BORDER }}>
                    <th className="px-2 py-1.5 font-medium">Type</th>
                    <th className="px-2 py-1.5 font-medium">Name</th>
                    <th className="px-2 py-1.5 font-medium">Value</th>
                    <th className="px-2 py-1.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {(status?.records ?? []).map((rec) => (
                    <tr key={`${rec.type}-${rec.name}-${rec.value}`} className="border-b" style={{ borderColor: BORDER }}>
                      <td className="px-2 py-1.5 font-mono text-white/70">{rec.type}</td>
                      <td className="px-2 py-1.5 font-mono text-white/70">{rec.name}</td>
                      <td className="max-w-[140px] truncate px-2 py-1.5 font-mono text-white/70" title={rec.value}>
                        {rec.value}
                      </td>
                      <td className="px-2 py-1.5">
                        <DnsCopyButton value={rec.value} label={rec.type} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <p className="text-[10px] text-white/40">
            Add these records at your DNS provider. Status is checked automatically every 30 seconds.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void checkStatus()}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] text-white/70 transition hover:text-white disabled:opacity-40"
              style={{ borderColor: BORDER }}
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Check status
            </button>
            <button
              type="button"
              onClick={() => void removeDomain()}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] text-rose-300/80 transition hover:text-rose-200 disabled:opacity-40"
              style={{ borderColor: "rgba(244,63,94,0.25)" }}
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </div>
        </div>
      )}

      {loading && customDomain && status ? (
        <p className="text-center text-[10px] text-white/35">
          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
          Updating…
        </p>
      ) : null}
    </div>
  );
}

function EditorPanel({
  page,
  pageId,
  models,
  expandedSections,
  onToggleSection,
  onPatchTextField,
  onPatchImmediateField,
  onFieldBlur,
  slugError,
  onDomainUpdated,
  onAddBlock,
  onUpdateBlock,
  onRemoveBlock,
  onMoveBlock,
  onUpload,
  patchBlock,
  dragIndex,
  setDragIndex,
  onReorder,
  blockClickMap,
  redirects,
  redirectFormOpen,
  onToggleRedirectForm,
  onCreateRedirect,
  onUpdateRedirect,
  onDeleteRedirect,
  onCopyRedirectUrl,
}: {
  page: LinkPageWithBlocks;
  pageId: string;
  models: ModelRecord[];
  expandedSections: Set<string>;
  onToggleSection: (id: string) => void;
  onPatchTextField: (patch: Partial<SaveablePageFields>) => void;
  onPatchImmediateField: (patch: Partial<SaveablePageFields>) => void;
  onFieldBlur: () => void;
  slugError: string | null;
  onDomainUpdated: (domain: string) => void;
  onAddBlock: (t: LinkPageBlockType) => void;
  onUpdateBlock: (blockId: string, patch: BlockPatch) => Promise<LinkPageBlockRecord | undefined>;
  onRemoveBlock: (id: string) => void;
  onMoveBlock: (i: number, dir: -1 | 1) => void;
  onUpload: (f: File, cb: (url: string) => void) => Promise<void>;
  patchBlock: (id: string, patch: Partial<LinkPageBlockRecord>) => void;
  dragIndex: number | null;
  setDragIndex: (i: number | null) => void;
  onReorder: (blocks: LinkPageBlockRecord[]) => void;
  blockClickMap: Record<string, number>;
  redirects: LinkRedirectRecord[];
  redirectFormOpen: boolean;
  onToggleRedirectForm: () => void;
  onCreateRedirect: (input: { label: string; slug: string; destination_url: string }) => void;
  onUpdateRedirect: (redirectId: string, patch: Partial<LinkRedirectRecord>) => void;
  onDeleteRedirect: (redirectId: string) => void;
  onCopyRedirectUrl: (slug: string) => void;
}) {
  const sorted = dedupeBlocks(page.blocks);

  return (
    <div>
      <AccordionSection
        id="identity"
        title="Identity"
        expanded={expandedSections.has("identity")}
        onToggle={onToggleSection}
      >
        <Field label="Title">
          <FormInput
            value={page.title}
            onChange={(e) => onPatchTextField({ title: e.target.value })}
            onBlur={onFieldBlur}
          />
        </Field>
        <Field label="Slug">
          <FormInput
            value={page.slug}
            onChange={(e) => onPatchTextField({ slug: slugify(e.target.value) })}
            onBlur={onFieldBlur}
            error={slugError ?? undefined}
          />
        </Field>
        <Field label="Model">
          <select
            value={page.model_id}
            onChange={(e) => onPatchImmediateField({ model_id: e.target.value })}
            className="w-full rounded-lg border px-3 py-2 text-sm text-white"
            style={{ background: BG, borderColor: BORDER }}
          >
            <option value="">— None —</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model_name || m.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Custom domain">
          <LinkPageDomainManager
            pageId={pageId}
            customDomain={page.custom_domain}
            onDomainUpdated={onDomainUpdated}
          />
        </Field>
        <Field label="Meta description">
          <Textarea
            value={page.meta_description}
            onChange={(e) => onPatchTextField({ meta_description: e.target.value })}
            onBlur={onFieldBlur}
            rows={2}
          />
        </Field>
        <label className="flex items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={page.show_powered_by}
            onChange={(e) => onPatchImmediateField({ show_powered_by: e.target.checked })}
            className="rounded border-white/20"
          />
          Show powered-by badge
        </label>
      </AccordionSection>

      <AccordionSection
        id="profile"
        title="Profile"
        expanded={expandedSections.has("profile")}
        onToggle={onToggleSection}
      >
        <Field label="Bio / caption">
          <Textarea
            value={page.bio ?? ""}
            onChange={(e) => onPatchTextField({ bio: e.target.value })}
            onBlur={onFieldBlur}
            rows={3}
            placeholder="Short bio or tagline shown under the title"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name color">
            <OptionalColorField
              value={page.name_color}
              fallback={THEME_TEXT_COLOR[page.theme] ?? THEME_TEXT_COLOR.dark}
              onSwatchChange={(v) => onPatchImmediateField({ name_color: v })}
              onHexChange={(v) => onPatchTextField({ name_color: v })}
              onHexBlur={onFieldBlur}
              onReset={() => onPatchImmediateField({ name_color: "" })}
            />
          </Field>
          <Field label="Bio color">
            <OptionalColorField
              value={page.bio_color}
              fallback={THEME_TEXT_COLOR[page.theme] ?? THEME_TEXT_COLOR.dark}
              onSwatchChange={(v) => onPatchImmediateField({ bio_color: v })}
              onHexChange={(v) => onPatchTextField({ bio_color: v })}
              onHexBlur={onFieldBlur}
              onReset={() => onPatchImmediateField({ bio_color: "" })}
            />
          </Field>
        </div>
        <Field label="Profile photo URL">
          <div className="flex gap-2">
            <FormInput
              value={page.profile_photo_url}
              onChange={(e) => onPatchTextField({ profile_photo_url: e.target.value })}
              onBlur={onFieldBlur}
            />
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-2 text-xs text-white/60 hover:bg-white/5" style={{ borderColor: BORDER }}>
              <Upload className="h-3.5 w-3.5" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f, (url) => onPatchImmediateField({ profile_photo_url: url }));
                }}
              />
            </label>
          </div>
        </Field>
        <label className="flex items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={page.verified}
            onChange={(e) => onPatchImmediateField({ verified: e.target.checked })}
            className="rounded border-white/20"
          />
          Verified badge
        </label>
      </AccordionSection>

      <AccordionSection
        id="appearance"
        title="Appearance"
        expanded={expandedSections.has("appearance")}
        onToggle={onToggleSection}
      >
        <Field label="Theme">
          <select
            value={page.theme}
            onChange={(e) => onPatchImmediateField({ theme: e.target.value as LinkPageRecord["theme"] })}
            className="w-full rounded-lg border px-3 py-2 text-sm text-white"
            style={{ background: BG, borderColor: BORDER }}
          >
            {(["dark", "light", "minimal", "neon", "gold"] as const).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Font">
          <div className="grid grid-cols-2 gap-2">
            {LINK_PAGE_FONTS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onPatchImmediateField({ font: f })}
                className="rounded-lg border px-3 py-2.5 text-left text-[15px] text-white transition-colors"
                style={{
                  fontFamily: fontFamilyMap[f],
                  background: page.font === f ? ACCENT : BG,
                  borderColor: page.font === f ? ACCENT : BORDER,
                }}
              >
                {fontLabels[f]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Background">
          <BackgroundSection
            page={page}
            onPatchImmediateField={onPatchImmediateField}
            onPatchTextField={onPatchTextField}
            onFieldBlur={onFieldBlur}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primary color">
            <NativeColorSwatch
              value={page.primary_color}
              fallback={ACCENT}
              onChange={(v) => onPatchImmediateField({ primary_color: v })}
            />
          </Field>
          <Field label="Accent color">
            <NativeColorSwatch
              value={page.accent_color}
              fallback="#a855f7"
              onChange={(v) => onPatchImmediateField({ accent_color: v })}
            />
          </Field>
        </div>
      </AccordionSection>

      <AccordionSection
        id="blocks"
        title="Blocks"
        expanded={expandedSections.has("blocks")}
        onToggle={onToggleSection}
      >
        {/* Add block grid */}
        <div className="mb-4 grid grid-cols-4 gap-1.5">
          {BLOCK_TYPES.map((bt) => (
            <button
              key={bt.value}
              type="button"
              onClick={() => onAddBlock(bt.value)}
              className="flex flex-col items-center gap-1 rounded-lg border py-2 text-[10px] text-white/50 transition-colors hover:border-pink-500/30 hover:text-pink-200"
              style={{ borderColor: BORDER, background: BG }}
            >
              <span className="text-base leading-none">{bt.icon}</span>
              {bt.label}
            </button>
          ))}
        </div>

        {/* Platform presets */}
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/30">Quick presets</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {PLATFORM_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onAddBlock("link")}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] text-white/55 transition-colors hover:border-pink-500/30 hover:text-pink-200"
              style={{ borderColor: BORDER }}
              title={`Add ${p.label} link`}
            >
              <span>{p.icon}</span> {p.label}
            </button>
          ))}
        </div>

        {/* Draggable blocks */}
        <div className="space-y-2">
          {sorted.map((block, index) => (
            <div
              key={block.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex === null || dragIndex === index) return;
                const next = [...sorted];
                const [moved] = next.splice(dragIndex, 1);
                next.splice(index, 0, moved);
                setDragIndex(null);
                onReorder(next);
              }}
              className={cn(
                "rounded-xl border p-3 transition-colors",
                dragIndex === index ? "border-pink-500/40 bg-pink-500/[0.05]" : ""
              )}
              style={{ borderColor: dragIndex === index ? undefined : BORDER, background: BG }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-white/40">
                  <GripVertical className="h-4 w-4 cursor-grab text-white/25" />
                  <span className="font-semibold">{block.block_type.replace("_", " ")}</span>
                  {(blockClickMap[block.block_id] ?? 0) > 0 ? (
                    <span className="normal-case tracking-normal text-white/30">
                      · {blockClickMap[block.block_id]} clicks
                    </span>
                  ) : null}
                  {!block.is_visible ? <EyeOff className="h-3 w-3 text-white/25" /> : <Eye className="h-3 w-3 text-white/20" />}
                </div>
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => onMoveBlock(index, -1)} className="p-1 text-white/30 hover:text-white/70">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => onMoveBlock(index, 1)} className="p-1 text-white/30 hover:text-white/70">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => onRemoveBlock(block.id)} className="p-1 text-rose-400/50 hover:text-rose-300">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <BlockEditor
                block={block}
                pagePrimaryColor={page.primary_color}
                onChange={(patch) => patchBlock(block.id, patch)}
                onSaveLinkFields={(blockId, patch) => void onUpdateBlock(blockId, patch)}
                onSavePatch={(blockId, patch) => void onUpdateBlock(blockId, patch)}
                onUpload={onUpload}
              />
            </div>
          ))}
          {sorted.length === 0 ? (
            <p className="py-8 text-center text-xs text-white/25">No blocks yet — add one above</p>
          ) : null}
        </div>
      </AccordionSection>

      <AccordionSection
        id="tracking"
        title="Tracking & Pixels"
        expanded={expandedSections.has("tracking")}
        onToggle={onToggleSection}
      >
        <p className="mb-3 text-[11px] text-white/40">
          Meta and TikTok pixels fire on page views after cookie consent (when enabled). Click
          tracking passes fbclid through redirects automatically.
        </p>
        <Field label="Meta Pixel ID">
          <FormInput
            value={page.meta_pixel_id ?? ""}
            onChange={(e) => onPatchTextField({ meta_pixel_id: e.target.value })}
            onBlur={onFieldBlur}
            placeholder="e.g. 123456789012345"
          />
        </Field>
        <Field label="TikTok Pixel ID">
          <FormInput
            value={page.tiktok_pixel_id ?? ""}
            onChange={(e) => onPatchTextField({ tiktok_pixel_id: e.target.value })}
            onBlur={onFieldBlur}
            placeholder="e.g. CXXXXXXXXXXXXXXX"
          />
        </Field>
        <label className="flex items-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={page.cookie_notice_enabled ?? true}
            onChange={(e) => onPatchImmediateField({ cookie_notice_enabled: e.target.checked })}
            className="rounded border-white/20"
          />
          Show cookie notice before loading pixels
        </label>
        <Field label="Cookie notice text">
          <Textarea
            value={page.cookie_notice_text ?? ""}
            onChange={(e) => onPatchTextField({ cookie_notice_text: e.target.value })}
            onBlur={onFieldBlur}
            rows={2}
            placeholder="We use cookies and similar technologies for analytics…"
          />
        </Field>
      </AccordionSection>

      <AccordionSection
        id="redirects"
        title="Redirects"
        expanded={expandedSections.has("redirects")}
        onToggle={onToggleSection}
      >
        <p className="mb-3 text-[11px] text-white/40">
          Safe short URLs — destinations are never exposed on the public page.
        </p>
        <button
          type="button"
          onClick={onToggleRedirectForm}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium text-white/70 transition-colors hover:border-pink-500/30 hover:text-pink-200"
          style={{ borderColor: BORDER, background: BG }}
        >
          <Plus className="h-3.5 w-3.5" />
          {redirectFormOpen ? "Cancel" : "Add redirect"}
        </button>

        {redirectFormOpen ? (
          <RedirectAddForm onSubmit={onCreateRedirect} onCancel={onToggleRedirectForm} />
        ) : null}

        <div className="space-y-2">
          {redirects.map((redirect) => {
            const shortUrl = buildRedirectPublicUrl(page, redirect.slug);
            const destPreview =
              redirect.destination_url.length > 48
                ? `${redirect.destination_url.slice(0, 45)}…`
                : redirect.destination_url;
            return (
              <div
                key={redirect.id}
                className="rounded-xl border p-3"
                style={{ borderColor: BORDER, background: BG }}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white/80">{redirect.label || redirect.slug}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-pink-300/80">{shortUrl}</p>
                    <p className="mt-1 truncate text-[10px] text-white/30" title={redirect.destination_url}>
                      → {destPreview}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onCopyRedirectUrl(redirect.slug)}
                      className="rounded-lg border p-1.5 text-white/40 transition-colors hover:text-white/80"
                      style={{ borderColor: BORDER }}
                      title="Copy short URL"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteRedirect(redirect.id)}
                      className="rounded-lg p-1.5 text-rose-400/50 transition-colors hover:text-rose-300"
                      title="Delete redirect"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <label className="flex items-center gap-2 text-white/45">
                    <input
                      type="checkbox"
                      checked={redirect.is_active}
                      onChange={(e) => onUpdateRedirect(redirect.id, { is_active: e.target.checked })}
                    />
                    Active
                  </label>
                  <span className="tabular-nums text-white/35">{redirect.click_count} clicks</span>
                </div>
              </div>
            );
          })}
          {redirects.length === 0 ? (
            <p className="py-6 text-center text-xs text-white/25">No redirects yet</p>
          ) : null}
        </div>
      </AccordionSection>
    </div>
  );
}

function RedirectAddForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: { label: string; slug: string; destination_url: string }) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [destination, setDestination] = React.useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!destination.trim()) return;
    onSubmit({
      label: label.trim() || slug.trim() || "Redirect",
      slug: slug.trim() ? slugify(slug) : slugify(label || "link"),
      destination_url: destination.trim(),
    });
    setLabel("");
    setSlug("");
    setDestination("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 space-y-2 rounded-xl border p-3"
      style={{ borderColor: BORDER, background: "rgba(255,255,255,0.02)" }}
    >
      <FormInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Instagram promo)" />
      <FormInput
        value={slug}
        onChange={(e) => setSlug(slugify(e.target.value))}
        placeholder="Short slug (optional)"
      />
      <FormInput
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        placeholder="https://destination-url.com/…"
        required
      />
      <div className="flex gap-2 pt-1">
        <button type="submit" className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-white" style={{ background: ACCENT }}>
          Create redirect
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border px-3 py-1.5 text-[11px] text-white/50"
          style={{ borderColor: BORDER }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function BlockEditor({
  block,
  pagePrimaryColor,
  onChange,
  onSaveLinkFields,
  onSavePatch,
  onUpload,
}: {
  block: LinkPageBlockRecord;
  pagePrimaryColor: string;
  onChange: (patch: Partial<LinkPageBlockRecord>) => void;
  onSaveLinkFields: (blockId: string, patch: BlockPatch) => void;
  onSavePatch: (blockId: string, patch: BlockPatch) => void;
  onUpload: (f: File, cb: (url: string) => void) => Promise<void>;
}) {
  const blockRef = React.useRef(block);
  blockRef.current = block;

  const saveLinkFields = React.useCallback(() => {
    const current = blockRef.current;
    const patch: BlockPatch = {
      label: current.label,
      url: current.url,
      platform: current.platform,
      sublabel: current.sublabel,
      style: current.style,
    };
    if (blockPlatform(current) === "custom") {
      patch.custom_button_color = current.custom_button_color;
      patch.icon = current.icon;
    }
    onSaveLinkFields(current.id, patch);
  }, [onSaveLinkFields]);

  const savePatch = React.useCallback(
    (patch: BlockPatch) => {
      onSavePatch(blockRef.current.id, patch);
    },
    [onSavePatch]
  );

  if (block.block_type === "spacer") {
    return <p className="text-[11px] text-white/30">Vertical spacer — drag to reposition</p>;
  }

  const selectedPlatform = blockPlatform(block);
  const isCustomPlatform = selectedPlatform === "custom";

  return (
    <div className="space-y-2">
      {(block.block_type === "link" || block.block_type === "social_bar") && (
        <>
          <FormInput
            value={block.label}
            onChange={(e) => onChange({ label: e.target.value })}
            onBlur={saveLinkFields}
            placeholder="Label"
          />
          <FormInput
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value })}
            onBlur={saveLinkFields}
            placeholder="https://…"
          />
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Platform</p>
            <div className="flex flex-wrap gap-1.5">
              {LINK_PAGE_PLATFORMS.map((p) => {
                const branding = PLATFORM_BRANDING[p.id];
                const selected = selectedPlatform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    title={p.label}
                    onClick={() => {
                      const patch: Partial<LinkPageBlockRecord> = {
                        platform: p.id,
                        icon: p.id === "custom" ? block.icon || "🔗" : p.icon,
                      };
                      if (p.id !== "custom" && p.urlPrefix && !block.url) {
                        patch.label = block.label || p.label;
                        patch.url = p.urlPrefix;
                      }
                      if (blockRef.current.style === "default") {
                        patch.style = getRecommendedBlockStyle(p.id);
                      }
                      onChange(patch);
                      const next = { ...blockRef.current, ...patch };
                      const save: BlockPatch = {
                        platform: next.platform,
                        icon: next.icon,
                      };
                      if (patch.label !== undefined) save.label = next.label;
                      if (patch.url !== undefined) save.url = next.url;
                      if (patch.style !== undefined) save.style = next.style;
                      onSavePatch(next.id, save);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
                      selected ? "text-white" : "text-white/55 hover:text-white/80"
                    )}
                    style={
                      selected
                        ? {
                            background: branding.pillColor,
                            borderColor: branding.pillColor,
                            color: p.id === "snapchat" ? "#000" : "#fff",
                          }
                        : { borderColor: BORDER, background: "rgba(255,255,255,0.03)" }
                    }
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: branding.pillColor }}
                      aria-hidden="true"
                    />
                    <span>{p.icon}</span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          {isCustomPlatform ? (
            <>
              <Field label="Button color">
                <NativeColorSwatch
                  value={block.custom_button_color || pagePrimaryColor}
                  fallback={pagePrimaryColor || ACCENT}
                  onChange={(v) => {
                    onChange({ custom_button_color: v });
                    savePatch({ custom_button_color: v });
                  }}
                />
              </Field>
              <FormInput
                value={block.icon && block.icon !== "custom" ? block.icon : "🔗"}
                onChange={(e) => onChange({ icon: e.target.value || "🔗" })}
                onBlur={() => savePatch({ icon: blockRef.current.icon || "🔗" })}
                placeholder="Icon emoji"
              />
            </>
          ) : null}
          {block.block_type === "link" ? (
            <FormInput
              value={block.sublabel}
              onChange={(e) => onChange({ sublabel: e.target.value })}
              onBlur={saveLinkFields}
              placeholder="Sublabel (optional)"
            />
          ) : null}
        </>
      )}
      {block.block_type === "heading" && (
        <FormInput
          value={block.heading_text || block.label}
          onChange={(e) => onChange({ heading_text: e.target.value, label: e.target.value })}
          onBlur={() =>
            savePatch({
              heading_text: blockRef.current.heading_text || blockRef.current.label,
              label: blockRef.current.heading_text || blockRef.current.label,
            })
          }
          placeholder="Heading text"
        />
      )}
      {block.block_type === "bio_text" && (
        <Textarea
          value={block.label}
          onChange={(e) => onChange({ label: e.target.value })}
          onBlur={() => savePatch({ label: blockRef.current.label })}
          rows={2}
          placeholder="Bio text"
        />
      )}
      {block.block_type === "countdown" && (
        <>
          <FormInput
            value={block.label}
            onChange={(e) => onChange({ label: e.target.value })}
            onBlur={() => savePatch({ label: blockRef.current.label })}
            placeholder="Countdown label"
          />
          <FormInput
            type="datetime-local"
            value={block.countdown_target?.slice(0, 16) ?? ""}
            onChange={(e) =>
              onChange({ countdown_target: e.target.value ? new Date(e.target.value).toISOString() : null })
            }
            onBlur={() => savePatch({ countdown_target: blockRef.current.countdown_target })}
          />
        </>
      )}
      {block.block_type === "photo_grid" && (
        <div className="space-y-2">
          <Textarea
            value={block.photo_urls.join("\n")}
            onChange={(e) =>
              onChange({
                photo_urls: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              })
            }
            onBlur={() => savePatch({ photo_urls: blockRef.current.photo_urls })}
            rows={3}
            placeholder="Image URLs (one per line)"
          />
          <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-white/50">
            <Upload className="h-3.5 w-3.5" /> Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f, (url) => onChange({ photo_urls: [...block.photo_urls, url] }));
              }}
            />
          </label>
        </div>
      )}
      {block.block_type === "link" && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">Button style</p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "prominent", label: "Branded" },
                { id: "glass", label: "Glass" },
                { id: "glass_dark", label: "Dark glass" },
                { id: "outline", label: "Outline" },
                { id: "minimal", label: "Minimal" },
                { id: "subtle", label: "Subtle" },
              ] as const
            ).map((s) => {
              const selected = block.style === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onChange({ style: s.id });
                    savePatch({ style: s.id });
                  }}
                  className="rounded-lg border px-3 py-1.5 text-[13px] transition-colors"
                  style={{
                    borderColor: selected ? ACCENT : "#333",
                    background: selected ? "rgba(236,72,153,0.15)" : "#111",
                    color: selected ? ACCENT : "#9ca3af",
                    fontWeight: selected ? 600 : 400,
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {block.style === "default" ? (
            <p className="text-[10px] text-white/35">
              Auto: {getRecommendedBlockStyle(detectLinkPlatform(block))} for this platform
            </p>
          ) : null}
        </div>
      )}
      <label className="flex items-center gap-2 text-[11px] text-white/45">
        <input
          type="checkbox"
          checked={block.is_visible}
          onChange={(e) => {
            onChange({ is_visible: e.target.checked });
            savePatch({ is_visible: e.target.checked });
          }}
        />
        Visible
      </label>
    </div>
  );
}

const ANALYTICS_DAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Today" },
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
];

function AnalyticsDaysPicker({
  days,
  onDaysChange,
}: {
  days: number;
  onDaysChange: (days: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ANALYTICS_DAY_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onDaysChange(value)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            days === value ? "border-pink-500/40 text-pink-200" : "text-white/50 hover:text-white/80"
          )}
          style={{
            background: days === value ? "rgba(236,72,153,0.12)" : BG,
            borderColor: days === value ? ACCENT : BORDER,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TrendBadge({ trend, suffix }: { trend: AnalyticsTrend; suffix?: string }) {
  const Icon = trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;
  const color =
    trend.direction === "up" ? "#34d399" : trend.direction === "down" ? "#f87171" : "rgba(255,255,255,0.35)";
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color }}>
      <Icon className="h-3 w-3" />
      {trend.changePercent}%
      {suffix ? <span className="text-white/30">{suffix}</span> : null}
    </span>
  );
}

function MiniSparkline({ data }: { data: number[] }) {
  const chartData = data.map((value, i) => ({ i, value }));
  return (
    <div className="h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatPeakHour(hour: number): string {
  const h = hour % 24;
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${suffix}`;
}

function AbTestPanel({
  page,
  results,
  loading,
  actionLoading,
  setupOpen,
  testName,
  onTestNameChange,
  onOpenSetup,
  onCloseSetup,
  onRefresh,
  onCreateVariant,
  onStartTest,
  onStopTest,
  onDeclareWinner,
}: {
  page: LinkPageRecord;
  results: AbTestResults | null;
  loading: boolean;
  actionLoading: boolean;
  setupOpen: boolean;
  testName: string;
  onTestNameChange: (name: string) => void;
  onOpenSetup: () => void;
  onCloseSetup: () => void;
  onRefresh: () => void;
  onCreateVariant: () => Promise<void>;
  onStartTest: () => Promise<void>;
  onStopTest: () => Promise<void>;
  onDeclareWinner: (winner: "a" | "b") => Promise<void>;
}) {
  const formatPct = (n: number) => `${(n * 100).toFixed(1)}%`;

  if (loading && !results) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-white/35">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" style={{ color: ACCENT }} /> Loading A/B test…
      </div>
    );
  }

  const enabled = page.ab_test_enabled;
  const hasVariant = !!page.ab_variant_id;
  const confidence = results?.confidence ?? 0;
  const suggested = results?.suggestedWinner;

  const chartData = (results?.viewsByDay ?? []).map((d) => ({
    date: d.date.slice(5),
    a: d.a,
    b: d.b,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">{results?.testName || "A/B Test"}</h2>
          <p className="mt-0.5 text-xs text-white/40">
            {enabled ? "Test running — 50/50 traffic split" : page.ab_winner !== "none" ? `Winner: Variant ${page.ab_winner.toUpperCase()}` : "No active test"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border p-2 text-white/50 hover:text-white/80"
            style={{ borderColor: BORDER }}
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {!enabled ? (
            <button
              type="button"
              onClick={onOpenSetup}
              disabled={actionLoading || page.status !== "published"}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              style={{ background: ACCENT }}
            >
              {hasVariant ? "Start test" : "Set up test"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onStopTest()}
              disabled={actionLoading}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium text-rose-300 disabled:opacity-40"
              style={{ borderColor: "rgba(244,63,94,0.3)" }}
            >
              Stop test
            </button>
          )}
        </div>
      </div>

      {page.status !== "published" && !enabled ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          Publish this page before starting an A/B test.
        </div>
      ) : null}

      {setupOpen ? (
        <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: BG }}>
          <h3 className="text-sm font-semibold text-white">Set up A/B test</h3>
          <p className="mt-1 text-xs text-white/40">
            Variant A is your live page. Create Variant B, edit it, then start the test.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-xs text-white/60">Test name</Label>
              <FormInput
                value={testName}
                onChange={(e) => onTestNameChange(e.target.value)}
                placeholder="e.g. Hero button color test"
                className="mt-1"
              />
            </div>
            {!hasVariant ? (
              <button
                type="button"
                onClick={() => void onCreateVariant()}
                disabled={actionLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-medium text-white/80 hover:bg-white/[0.04]"
                style={{ borderColor: BORDER }}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create new variant (clone page + blocks)
              </button>
            ) : (
              <p className="text-xs text-emerald-400/80">Variant B ready — edit the cloned page from the page list, then start the test.</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onCloseSetup} className="rounded-lg px-3 py-1.5 text-xs text-white/50 hover:text-white/80">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onStartTest()}
                disabled={actionLoading || !hasVariant}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                style={{ background: ACCENT }}
              >
                Start test
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {(["a", "b"] as const).map((v) => {
          const metrics = v === "a" ? results?.variantA : results?.variantB;
          const isSuggested = suggested === v;
          const isWinner = page.ab_winner === v;
          return (
            <div
              key={v}
              className={cn(
                "rounded-xl border p-4",
                isSuggested && enabled ? "border-pink-500/40" : "",
                isWinner ? "border-emerald-500/40 bg-emerald-500/[0.06]" : ""
              )}
              style={{ borderColor: isSuggested && enabled ? undefined : BORDER, background: isWinner ? undefined : BG }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">
                  Variant {v.toUpperCase()}
                  {v === "a" ? " (Control)" : " (Challenger)"}
                </span>
                {isWinner ? (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">Winner</span>
                ) : isSuggested && enabled ? (
                  <span className="rounded-full bg-pink-500/20 px-2 py-0.5 text-[10px] font-medium text-pink-300">Leading</span>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-white/35">Views</p>
                  <p className="text-lg font-bold tabular-nums text-white">{metrics?.views.toLocaleString() ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-white/35">Clicks</p>
                  <p className="text-lg font-bold tabular-nums text-white">{metrics?.clicks.toLocaleString() ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-white/35">CTR</p>
                  <p className="text-lg font-bold tabular-nums text-white">{metrics ? formatPct(metrics.ctr) : "—"}</p>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-white/30">{metrics?.sessions ?? 0} sessions</p>
              {enabled ? (
                <button
                  type="button"
                  onClick={() => void onDeclareWinner(v)}
                  disabled={actionLoading}
                  className="mt-3 w-full rounded-lg border py-1.5 text-[11px] font-medium text-white/60 hover:text-white/90 disabled:opacity-40"
                  style={{ borderColor: BORDER }}
                >
                  Declare {v.toUpperCase()} winner
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: BG }}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Statistical confidence</span>
          <span className="text-sm font-bold tabular-nums text-white">{confidence}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${confidence}%`,
              background: confidence >= 95 ? "#34d399" : confidence >= 80 ? ACCENT : PURPLE,
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-white/40">
          {confidence >= 95
            ? "High confidence — results are statistically significant."
            : suggested
              ? "Early signal detected — collect more sessions for higher confidence."
              : "Need >100 sessions and >5% CTR difference, or chi-square significance at 95%."}
        </p>
      </div>

      {chartData.length > 0 ? (
        <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: BG }}>
          <h3 className="mb-3 text-sm font-semibold text-white">Views by day</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} width={32} />
              <Tooltip
                contentStyle={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="a" name="Variant A" stroke={ACCENT} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="b" name="Variant B" stroke={PURPLE} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}

function AnalyticsPanel({
  summary,
  realtime,
  pageTitle,
  days,
  onDaysChange,
}: {
  summary: AnalyticsSummary | null;
  realtime: number;
  pageTitle?: string;
  days: number;
  onDaysChange: (days: number) => void;
}) {
  const trendLabel = days === 1 ? "vs yesterday" : "vs prev period";

  const hourlyRadialData = React.useMemo(() => {
    if (!summary) return [];
    const maxClicks = Math.max(1, ...summary.hourlyDistribution.map((h) => h.clicks));
    return summary.hourlyDistribution.map((h) => ({
      hour: h.hour,
      label: `${h.hour}`,
      clicks: h.clicks,
      fill: h.hour === summary.peakHour ? ACCENT : PURPLE,
      opacity: 0.35 + (h.clicks / maxClicks) * 0.65,
    }));
  }, [summary]);

  const socialReferrerTotal = React.useMemo(() => {
    if (!summary) return 0;
    return summary.referrerBreakdown
      .filter((r) => r.label !== "Direct")
      .reduce((s, r) => s + r.count, 0);
  }, [summary]);

  const directReferrerTotal = React.useMemo(() => {
    if (!summary) return 0;
    return summary.referrerBreakdown.find((r) => r.label === "Direct")?.count ?? 0;
  }, [summary]);

  const referrerBarTotal = socialReferrerTotal + directReferrerTotal;

  if (!summary) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-white/35">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" style={{ color: ACCENT }} /> Loading analytics…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {pageTitle ? (
          <h2 className="text-lg font-bold text-white">{pageTitle}</h2>
        ) : (
          <span />
        )}
        <AnalyticsDaysPicker days={days} onDaysChange={onDaysChange} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LuxuryStatCard
          label="Total views"
          value={summary.pageViews}
          trend={summary.previousPeriodComparison.pageViews}
          trendLabel={trendLabel}
        />
        <LuxuryStatCard
          label="Unique visitors"
          value={summary.uniqueVisitors}
          trend={summary.previousPeriodComparison.uniqueVisitors}
          trendLabel={trendLabel}
        />
        <LuxuryStatCard
          label="New visitors"
          value={summary.newVisitors}
          subtitle={`${summary.returningVisitors} returning (${summary.returningRate}%)`}
          trend={summary.previousPeriodComparison.newVisitors}
          trendLabel={trendLabel}
        />
        <LuxuryStatCard
          label="True CTR"
          value={summary.trueCtr}
          suffix="%"
          accent
          subtitle={`${summary.uniqueClickers} unique clickers`}
          trend={summary.previousPeriodComparison.trueCtr}
          trendLabel={trendLabel}
        />
      </div>

      {summary.uniqueVisitors > 0 ? (
        <ChartCard title="Visitor behavior">
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-white/70">
              <span>New visitors: {summary.newVisitors} ({summary.uniqueVisitors > 0 ? Math.round((summary.newVisitors / summary.uniqueVisitors) * 100) : 0}%)</span>
              <span>Returning: {summary.returningVisitors} ({summary.returningRate}%)</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full">
              <div
                className="h-full"
                style={{
                  width: `${summary.uniqueVisitors > 0 ? Math.round((summary.newVisitors / summary.uniqueVisitors) * 100) : 0}%`,
                  background: `linear-gradient(90deg, ${ACCENT}, ${PURPLE})`,
                }}
              />
              <div className="h-full flex-1" style={{ background: "rgba(255,255,255,0.12)" }} />
            </div>
            <p className="text-[10px] text-white/35">
              {summary.newVisitors} new · {summary.returningVisitors} returning
            </p>
          </div>
        </ChartCard>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-white/40">
        <span className="inline-flex h-2 w-2 animate-pulse rounded-full" style={{ background: ACCENT }} />
        {realtime} live {realtime === 1 ? "visitor" : "visitors"} · last 5 min
      </div>

      {summary.viewsByDay.length > 0 ? (
        <ChartCard title="Page views over time">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.viewsByDay}>
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  tickFormatter={(d) => String(d).slice(5)}
                />
                <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="views" stroke={ACCENT} fill="url(#viewsGrad)" name="Views" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      ) : null}

      {summary.topLinks.length > 0 ? (
        <ChartCard title="Top links">
          <ul className="space-y-3">
            {summary.topLinks.map((link, i) => {
              const branding = PLATFORM_BRANDING[link.platform as keyof typeof PLATFORM_BRANDING];
              return (
                <li key={link.block_id} className="flex items-center gap-3">
                  <span className="w-6 shrink-0 text-center text-xs tabular-nums text-white/25">#{i + 1}</span>
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: branding?.pillColor ?? "rgba(255,255,255,0.08)" }}
                    dangerouslySetInnerHTML={{ __html: branding?.svg ?? "🔗" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white/80">{link.label}</p>
                    <p className="truncate text-[10px] text-white/30">{link.url}</p>
                  </div>
                  <MiniSparkline data={link.sparkline} />
                  <div className="shrink-0 text-right">
                    <span className="block tabular-nums text-sm font-semibold" style={{ color: ACCENT }}>
                      {link.clicks}
                    </span>
                    <span className="block text-[10px] tabular-nums text-white/35">
                      {link.uniqueClicks} unique
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </ChartCard>
      ) : null}

      {hourlyRadialData.some((h) => h.clicks > 0) ? (
        <ChartCard title="When your audience clicks">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="relative h-64 w-64 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="18%"
                  outerRadius="95%"
                  barSize={8}
                  data={hourlyRadialData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 23]} dataKey="hour" tick={false} />
                  <RadialBar dataKey="clicks" cornerRadius={4} background={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Tooltip
                    contentStyle={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }}
                    formatter={(value) => [`${value ?? 0} clicks`, ""]}
                    labelFormatter={(h) => `${h}:00 Athens`}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[10px] uppercase tracking-wider text-white/35">Peak hour</p>
                <p className="text-xl font-bold text-white">{formatPeakHour(summary.peakHour)}</p>
                <p className="text-[10px] text-white/30">Europe/Athens</p>
              </div>
            </div>
            <div className="grid flex-1 grid-cols-4 gap-2 sm:grid-cols-6">
              {summary.hourlyDistribution.map((h) => {
                const max = Math.max(1, ...summary.hourlyDistribution.map((x) => x.clicks));
                const intensity = h.clicks / max;
                return (
                  <div key={h.hour} className="text-center">
                    <div
                      className="mx-auto mb-1 h-8 w-full rounded"
                      style={{
                        background: `rgba(236,72,153,${0.1 + intensity * 0.7})`,
                        boxShadow: h.hour === summary.peakHour ? `0 0 8px ${ACCENT}` : undefined,
                      }}
                    />
                    <span className="text-[9px] text-white/35">{h.hour}h</span>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartCard>
      ) : null}

      {summary.referrerBreakdown.length > 0 ? (
        <ChartCard title="Top referrers">
          {referrerBarTotal > 0 ? (
            <div className="mb-4">
              <div className="mb-2 flex justify-between text-xs text-white/50">
                <span>Social & search</span>
                <span>Direct</span>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.round((socialReferrerTotal / referrerBarTotal) * 100)}%`,
                    background: `linear-gradient(90deg, ${PURPLE}, ${ACCENT})`,
                  }}
                />
                <div
                  className="h-full flex-1"
                  style={{ background: "rgba(255,255,255,0.12)" }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-white/35">
                <span>{Math.round((socialReferrerTotal / referrerBarTotal) * 100)}%</span>
                <span>{Math.round((directReferrerTotal / referrerBarTotal) * 100)}%</span>
              </div>
            </div>
          ) : null}
          <ul className="space-y-2">
            {summary.referrerBreakdown.map((r) => (
              <li key={r.label}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 text-white/70">
                    <span className="text-base">{r.icon}</span>
                    {r.label}
                  </span>
                  <span className="tabular-nums text-white/40">
                    {r.count} ({r.percent}%)
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${r.percent}%`,
                      background: r.label === "Direct" ? "rgba(255,255,255,0.25)" : `linear-gradient(90deg, ${PURPLE}, ${ACCENT})`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </ChartCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {summary.deviceBreakdown.length > 0 ? (
          <ChartCard title="Devices">
            <ul className="space-y-3">
              {summary.deviceBreakdown.map((d, i) => (
                <li key={d.device}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 capitalize text-white/70">
                      {d.device === "mobile" ? (
                        <Smartphone className="h-4 w-4 text-white/40" />
                      ) : d.device === "tablet" ? (
                        <Monitor className="h-4 w-4 text-white/40" />
                      ) : (
                        <Monitor className="h-4 w-4 text-white/40" />
                      )}
                      {d.device}
                    </span>
                    <span className="tabular-nums text-white/40">
                      {d.count.toLocaleString()} ({d.percent}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${d.percent}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </ChartCard>
        ) : null}

        {summary.countryBreakdown.length > 0 ? (
          <ChartCard title="Countries">
            <ul className="space-y-2">
              {summary.countryBreakdown.map((c) => (
                <li key={c.country} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 text-white/70">
                    <span className="text-base">{c.flag}</span>
                    {c.country}
                  </span>
                  <span className="tabular-nums text-white/40">
                    {c.count} ({c.percent}%)
                  </span>
                </li>
              ))}
            </ul>
          </ChartCard>
        ) : null}
      </div>

      {summary.cityBreakdown.length > 0 ? (
        <ChartCard title="Top cities">
          <ul className="grid gap-2 sm:grid-cols-2">
            {summary.cityBreakdown.map((c) => (
              <li key={c.city} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-white/70">
                  <Globe className="h-3.5 w-3.5 text-white/30" />
                  {c.city}
                </span>
                <span className="tabular-nums text-white/40">
                  {c.count} ({c.percent}%)
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      ) : null}

      {summary.redirectClicks.length > 0 ? (
        <ChartCard title="Redirect clicks">
          <ul className="space-y-2">
            {summary.redirectClicks.map((r) => (
              <li key={r.redirect_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-white/65">
                  {r.label}
                  <span className="text-white/30"> · /{r.slug}</span>
                </span>
                <span className="shrink-0 tabular-nums font-semibold" style={{ color: ACCENT }}>
                  {r.clicks}
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      ) : null}

      {summary.utmBreakdown.length > 0 ? (
        <ChartCard title="UTM campaigns">
          <ul className="space-y-2">
            {summary.utmBreakdown.map((u) => (
              <li key={`${u.source}-${u.campaign}`} className="flex justify-between gap-2 text-sm text-white/60">
                <span className="truncate">
                  {u.source}
                  <span className="text-white/30"> · {u.campaign}</span>
                </span>
                <span className="shrink-0 tabular-nums text-white/35">{u.count}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
      ) : null}
    </div>
  );
}

function GlobalAnalyticsPanel({
  summary,
  loading,
  pages,
  days,
  onDaysChange,
  onSelectPage,
  onRefresh,
}: {
  summary: GlobalAnalyticsSummary | null;
  loading: boolean;
  pages: LinkPageRecord[];
  days: number;
  onDaysChange: (days: number) => void;
  onSelectPage: (id: string) => void;
  onRefresh: () => void;
}) {
  const pageIdToRecordId = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pages) map.set(p.page_id, p.id);
    return map;
  }, [pages]);

  const pageColors = React.useMemo(() => {
    const ids = summary?.leaderboard.map((l) => l.page_id) ?? [];
    const map: Record<string, string> = {};
    ids.forEach((id, i) => {
      map[id] = PIE_COLORS[i % PIE_COLORS.length];
    });
    return map;
  }, [summary]);

  const stackedData = React.useMemo(() => {
    if (!summary) return [];
    return summary.viewsByDayByPage.map((row) => {
      const entry: Record<string, string | number> = { date: row.date };
      for (const [pid, views] of Object.entries(row.pages)) {
        entry[pid] = views;
      }
      return entry;
    });
  }, [summary]);

  const trendLabel = days === 1 ? "vs yesterday" : "vs prev period";

  const hourlyRadialData = React.useMemo(() => {
    if (!summary) return [];
    const maxClicks = Math.max(1, ...summary.hourlyDistribution.map((h) => h.clicks));
    return summary.hourlyDistribution.map((h) => ({
      hour: h.hour,
      clicks: h.clicks,
      fill: h.hour === summary.peakHour ? ACCENT : PURPLE,
      opacity: 0.35 + (h.clicks / maxClicks) * 0.65,
    }));
  }, [summary]);

  if (loading && !summary) {
    return <LoadingState />;
  }

  if (!summary) {
    return <EmptyState message="No analytics data yet" />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b px-6 py-4" style={{ borderColor: BORDER }}>
        <div>
          <h2 className="text-lg font-bold text-white">All Pages Analytics</h2>
          <p className="text-xs text-white/40">
            {days === 1 ? "Today" : `Last ${days} days`} · combined performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AnalyticsDaysPicker days={days} onDaysChange={onDaysChange} />
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-lg border px-3 py-1.5 text-xs text-white/60 transition-colors hover:text-white/90 disabled:opacity-50"
            style={{ borderColor: BORDER }}
          >
            {loading ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : "Refresh"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <LuxuryStatCard
              label="Total page views"
              value={summary.totalPageViews}
              trend={summary.previousPeriodComparison.pageViews}
              trendLabel={trendLabel}
            />
            <LuxuryStatCard
              label="Unique visitors"
              value={summary.totalUniqueVisitors}
              trend={summary.previousPeriodComparison.uniqueVisitors}
              trendLabel={trendLabel}
            />
            <LuxuryStatCard
              label="New visitors"
              value={summary.totalNewVisitors}
              subtitle={`${summary.totalReturningVisitors} returning (${summary.returningRate}%)`}
              trend={summary.previousPeriodComparison.newVisitors}
              trendLabel={trendLabel}
            />
            <LuxuryStatCard
              label="True CTR"
              value={summary.trueCtr}
              suffix="%"
              accent
              subtitle={`${summary.totalUniqueClickers} unique clickers`}
              trend={summary.previousPeriodComparison.trueCtr}
              trendLabel={trendLabel}
            />
          </div>

          {summary.viewsByDay.length > 0 ? (
            <ChartCard title="Page views over time">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.viewsByDay}>
                    <defs>
                      <linearGradient id="globalViewsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                      tickFormatter={(d) => String(d).slice(5)}
                    />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="views" stroke={ACCENT} fill="url(#globalViewsGrad)" name="Views" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          ) : null}

          {stackedData.length > 0 ? (
            <ChartCard title="Views by page (daily)">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stackedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                    {summary.leaderboard.slice(0, 6).map((p) => (
                      <Line
                        key={p.page_id}
                        type="monotone"
                        dataKey={p.page_id}
                        name={p.title}
                        stroke={pageColors[p.page_id]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Leaderboard">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-[10px] uppercase tracking-wider text-white/30" style={{ borderColor: BORDER }}>
                      <th className="pb-2 pr-4">Page</th>
                      <th className="pb-2 pr-4 text-right">Views</th>
                      <th className="pb-2 text-right">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.leaderboard.map((row, i) => {
                      const recordId = pageIdToRecordId.get(row.page_id);
                      return (
                        <tr
                          key={row.page_id}
                          className={cn("border-b transition-colors", recordId ? "cursor-pointer hover:bg-white/[0.03]" : "")}
                          style={{ borderColor: BORDER }}
                          onClick={() => recordId && onSelectPage(recordId)}
                        >
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] tabular-nums text-white/25">#{i + 1}</span>
                              <div>
                                <p className="font-medium text-white/80">{row.title}</p>
                                <p className="text-[10px] text-white/30">/{row.slug}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums text-white/70">{row.views.toLocaleString()}</td>
                          <td className="py-2.5 text-right tabular-nums" style={{ color: ACCENT }}>{row.clicks.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </ChartCard>

            {summary.deviceBreakdown.length > 0 ? (
              <ChartCard title="Devices">
                <ul className="space-y-3">
                  {summary.deviceBreakdown.map((d, i) => (
                    <li key={d.device}>
                      <div className="mb-1.5 flex justify-between text-sm">
                        <span className="capitalize text-white/70">{d.device}</span>
                        <span className="tabular-nums text-white/40">{d.count.toLocaleString()} ({d.percent}%)</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${d.percent}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </ChartCard>
            ) : null}
          </div>

          {hourlyRadialData.some((h) => h.clicks > 0) ? (
            <ChartCard title="When your audience clicks">
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="relative h-56 w-56 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="18%"
                      outerRadius="95%"
                      barSize={8}
                      data={hourlyRadialData}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <PolarAngleAxis type="number" domain={[0, 23]} dataKey="hour" tick={false} />
                      <RadialBar dataKey="clicks" cornerRadius={4} background={{ fill: "rgba(255,255,255,0.04)" }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[10px] uppercase tracking-wider text-white/35">Peak hour</p>
                    <p className="text-lg font-bold text-white">{formatPeakHour(summary.peakHour)}</p>
                  </div>
                </div>
              </div>
            </ChartCard>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {summary.referrerBreakdown.length > 0 ? (
              <ChartCard title="Top referrers">
                <ul className="space-y-2">
                  {summary.referrerBreakdown.map((r) => (
                    <li key={r.label}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 text-white/70">
                          <span>{r.icon}</span>
                          {r.label}
                        </span>
                        <span className="tabular-nums text-white/40">{r.count} ({r.percent}%)</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${r.percent}%`, background: `linear-gradient(90deg, ${PURPLE}, ${ACCENT})` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </ChartCard>
            ) : null}

            {summary.countryBreakdown.length > 0 ? (
              <ChartCard title="Top countries">
                <ul className="space-y-2">
                  {summary.countryBreakdown.map((c) => (
                    <li key={c.country} className="flex items-center justify-between gap-2 text-sm text-white/60">
                      <span className="flex items-center gap-2">
                        <span>{c.flag}</span>
                        {c.country}
                      </span>
                      <span className="tabular-nums text-white/35">{c.count.toLocaleString()} ({c.percent}%)</span>
                    </li>
                  ))}
                </ul>
              </ChartCard>
            ) : null}
          </div>

          {summary.bestDayOfWeek.some((d) => d.views > 0 || d.clicks > 0) ? (
            <ChartCard title="Best days of week">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.bestDayOfWeek}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="views" fill={ACCENT} name="Views" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="clicks" fill={PURPLE} name="Clicks" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LuxuryStatCard({
  label,
  value,
  accent,
  pulse,
  suffix,
  subtitle,
  trend,
  trendLabel,
}: {
  label: string;
  value: number;
  accent?: boolean;
  pulse?: boolean;
  suffix?: string;
  subtitle?: string;
  trend?: AnalyticsTrend;
  trendLabel?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4"
      style={{ background: PANEL, borderColor: BORDER }}
    >
      {accent ? (
        <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at top right, ${ACCENT}, transparent 70%)` }} />
      ) : null}
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/35">{label}</p>
      <p
        className={cn("mt-1.5 text-2xl font-bold tabular-nums", pulse && "animate-pulse")}
        style={{ color: accent ? ACCENT : "#fff" }}
      >
        {value.toLocaleString()}
        {suffix ? <span className="text-lg">{suffix}</span> : null}
      </p>
      {subtitle ? <p className="mt-1 text-[11px] text-white/40">{subtitle}</p> : null}
      {trend ? (
        <div className="mt-2">
          <TrendBadge trend={trend} suffix={trendLabel} />
        </div>
      ) : null}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: PANEL, borderColor: BORDER }}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-[11px] text-white/40">{label}</Label>
      {children}
    </div>
  );
}
