"use client";

/**
 * Model Wardrobe — outfits / locations / props with one photo each.
 * Filled once by the creator (or CD); Draft briefs pick ONE outfit + ONE location
 * per recording brief (one bunch = one setup) and rotate by last-used.
 */

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Check,
  Loader2,
  MapPin,
  Package,
  Pencil,
  Plus,
  Shirt,
  Trash2,
  X,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { uploadFileToSupabaseStorage } from "@/lib/client-direct-storage-upload";
import type { WardrobeItem, WardrobeKind } from "@/services/model-wardrobe";
import {
  ModelAvatar,
  PsPageHeader,
  PsTagInput,
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_FILTER_INPUT,
  cn,
} from "@/components/personas-studio/shared";

type Props = {
  modelId: string;
  modelName: string;
  initialItems: WardrobeItem[];
  initialRules: string;
  canEdit: boolean;
};

const OUTFIT_TAGS = [
  "cozy", "casual", "going out", "sporty", "dress", "lingerie-ish", "pyjamas", "office", "swim", "winter", "summer",
];
const LOCATION_TAGS = [
  "bed", "couch", "kitchen", "mirror", "balcony", "bathroom", "desk", "outdoor", "morning light", "evening light",
];

const KINDS: Array<{ id: WardrobeKind; label: string; plural: string; icon: React.ComponentType<{ className?: string }>; hint: string }> = [
  { id: "outfit", label: "Outfit", plural: "Outfits", icon: Shirt, hint: "One photo per full look (mirror selfie is fine). Number + short name + vibe tags." },
  { id: "location", label: "Location", plural: "Locations", icon: MapPin, hint: "Spots in the house she films at. Note when the light is good." },
  { id: "prop", label: "Prop", plural: "Props", icon: Package, hint: "Things she has around: coffee mug, laptop, headphones, pet…" },
];

function daysAgo(iso: string | null): string {
  if (!iso) return "never used";
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return "used today";
  return `used ${d}d ago`;
}

type Draft = {
  name: string;
  tags: string[];
  color: string;
  notes: string;
  photo_url: string;
  photo_preview: string;
};

const EMPTY_DRAFT: Draft = { name: "", tags: [], color: "", notes: "", photo_url: "", photo_preview: "" };

function ItemForm({
  kind,
  modelId,
  initial,
  onCancel,
  onSaved,
}: {
  kind: WardrobeKind;
  modelId: string;
  initial?: WardrobeItem;
  onCancel: () => void;
  onSaved: (item: WardrobeItem) => void;
}) {
  const [draft, setDraft] = React.useState<Draft>(
    initial
      ? {
          name: initial.name,
          tags: initial.tags,
          color: initial.color,
          notes: initial.notes,
          photo_url: initial.photo_url,
          photo_preview: initial.photo_signed_url,
        }
      : EMPTY_DRAFT,
  );
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const suggestions = kind === "outfit" ? OUTFIT_TAGS : kind === "location" ? LOCATION_TAGS : [];

  async function onPhoto(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadFileToSupabaseStorage(file, "wardrobe-photo", { itemId: modelId });
      setDraft((d) => ({ ...d, photo_url: res.sbUrl, photo_preview: URL.createObjectURL(file) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!draft.name.trim() && !draft.photo_url) {
      setError("Add a name or a photo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = initial
        ? `/api/personas/${encodeURIComponent(modelId)}/wardrobe/${encodeURIComponent(initial.id)}`
        : `/api/personas/${encodeURIComponent(modelId)}/wardrobe`;
      const res = await fetch(url, {
        method: initial ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          name: draft.name,
          tags: draft.tags,
          color: draft.color,
          notes: draft.notes,
          photo_url: draft.photo_url,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { item?: WardrobeItem; error?: string };
      if (!res.ok || !data.item) {
        setError(data.error ?? "Could not save.");
        return;
      }
      onSaved(data.item);
    } catch {
      setError("Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#FF1493]/30 bg-[#FF1493]/[0.04] p-4">
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <label
          className={cn(
            "flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-dashed border-white/20 bg-black/30 text-center",
            uploading && "pointer-events-none opacity-60",
          )}
        >
          {draft.photo_preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.photo_preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <>
              {uploading ? <Loader2 className="h-6 w-6 animate-spin text-white/50" /> : <Camera className="h-6 w-6 text-white/40" />}
              <span className="px-2 text-[11px] text-white/45">{uploading ? "Uploading…" : "Add photo"}</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              void onPhoto(f);
            }}
          />
        </label>
        <div className="space-y-2">
          <input
            className={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
            placeholder={kind === "outfit" ? "e.g. grey set + white socks" : kind === "location" ? "e.g. couch by the window" : "e.g. coffee mug"}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          {kind !== "prop" ? (
            <PsTagInput
              values={draft.tags}
              onChange={(tags) => setDraft((d) => ({ ...d, tags }))}
              placeholder="Tags — vibe, when it fits"
              suggestions={suggestions}
            />
          ) : null}
          {kind === "outfit" ? (
            <input
              className={cn(VA_FILTER_INPUT, "min-h-11 w-full")}
              placeholder="Main colour (optional)"
              value={draft.color}
              onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
            />
          ) : null}
          <textarea
            className={cn(VA_FILTER_INPUT, "min-h-[56px] w-full resize-y")}
            placeholder="Notes (optional) — e.g. only for Trial accounts, needs good daylight"
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          />
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-rose-300/90">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(VA_BTN_PRIMARY, "min-h-10 px-4 text-xs")}
          disabled={saving || uploading}
          onClick={() => void save()}
        >
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
          {initial ? "Save" : `Add ${kind}`}
        </button>
        <button type="button" className={cn(VA_BTN_SECONDARY, "min-h-10 px-4 text-xs")} onClick={onCancel}>
          <X className="mr-1.5 h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ModelWardrobeClient({ modelId, modelName, initialItems, initialRules, canEdit }: Props) {
  const [items, setItems] = React.useState<WardrobeItem[]>(initialItems);
  const [rules, setRules] = React.useState(initialRules);
  const [rulesSaved, setRulesSaved] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [adding, setAdding] = React.useState<WardrobeKind | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [kindTab, setKindTab] = React.useState<WardrobeKind>("outfit");

  async function remove(item: WardrobeItem) {
    if (!window.confirm(`Delete ${item.kind} #${item.number}${item.name ? ` (${item.name})` : ""}?`)) return;
    const res = await fetch(
      `/api/personas/${encodeURIComponent(modelId)}/wardrobe/${encodeURIComponent(item.id)}`,
      { method: "DELETE" },
    );
    if (res.ok) setItems((list) => list.filter((x) => x.id !== item.id));
  }

  async function toggleActive(item: WardrobeItem) {
    const res = await fetch(
      `/api/personas/${encodeURIComponent(modelId)}/wardrobe/${encodeURIComponent(item.id)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_active: !item.is_active }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as { item?: WardrobeItem };
    if (data.item) setItems((list) => list.map((x) => (x.id === data.item!.id ? data.item! : x)));
  }

  async function saveRules() {
    setRulesSaved("saving");
    try {
      const res = await fetch(`/api/personas/${encodeURIComponent(modelId)}/wardrobe`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      setRulesSaved(res.ok ? "saved" : "error");
    } catch {
      setRulesSaved("error");
    }
  }

  const current = KINDS.find((k) => k.id === kindTab)!;
  const visible = items.filter((i) => i.kind === kindTab);
  const counts = Object.fromEntries(KINDS.map((k) => [k.id, items.filter((i) => i.kind === k.id && i.is_active).length]));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
      <div className="mb-4">
        <Link
          href={ROUTES.persona(modelId)}
          className={cn(VA_BTN_SECONDARY, "inline-flex min-h-10 items-center gap-2 px-3 text-sm")}
        >
          <ArrowLeft className="h-4 w-4" />
          Persona
        </Link>
      </div>
      <PsPageHeader
        eyebrow="Persona"
        title={`${modelName} · Wardrobe`}
        description="Everything she can film with. Draft briefs pick ONE outfit + ONE location per recording brief and rotate them, so the brief never asks her what to wear."
        icon={Shirt}
        action={<ModelAvatar name={modelName} size={48} />}
      />

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => {
              setKindTab(k.id);
              setAdding(null);
              setEditing(null);
            }}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-xs font-medium",
              kindTab === k.id ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-white" : "border-white/10 text-white/55",
            )}
          >
            <k.icon className="h-3.5 w-3.5" />
            {k.plural}
            <span className="rounded-md bg-white/[0.08] px-1.5 text-[10px]">{counts[k.id]}</span>
          </button>
        ))}
      </div>

      <div className={cn(VA_CARD, "space-y-4 p-4 md:p-6")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-white/55">{current.hint}</p>
          {canEdit && adding !== kindTab ? (
            <button
              type="button"
              className={cn(VA_BTN_PRIMARY, "min-h-10 px-4 text-xs")}
              onClick={() => {
                setAdding(kindTab);
                setEditing(null);
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add {current.label.toLowerCase()}
            </button>
          ) : null}
        </div>

        {adding === kindTab ? (
          <ItemForm
            kind={kindTab}
            modelId={modelId}
            onCancel={() => setAdding(null)}
            onSaved={(item) => {
              setItems((list) => [...list, item]);
              setAdding(null);
            }}
          />
        ) : null}

        {visible.length === 0 && adding !== kindTab ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
            No {current.plural.toLowerCase()} yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item) =>
              editing === item.id ? (
                <div key={item.id} className="sm:col-span-2 lg:col-span-3">
                  <ItemForm
                    kind={item.kind}
                    modelId={modelId}
                    initial={item}
                    onCancel={() => setEditing(null)}
                    onSaved={(saved) => {
                      setItems((list) => list.map((x) => (x.id === saved.id ? saved : x)));
                      setEditing(null);
                    }}
                  />
                </div>
              ) : (
                <div
                  key={item.id}
                  className={cn(
                    "overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25",
                    !item.is_active && "opacity-50",
                  )}
                >
                  <div className="relative aspect-[3/4] bg-black/40">
                    {item.photo_signed_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.photo_signed_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/20">
                        <current.icon className="h-10 w-10" />
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-lg border border-[#D4AF8C]/40 bg-black/70 px-2 py-0.5 text-[11px] font-bold text-[#E8D5B5]">
                      #{item.number}
                    </span>
                    {!item.is_active ? (
                      <span className="absolute right-2 top-2 rounded-lg bg-black/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
                        Hidden
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-1.5 p-3">
                    <p className="truncate text-sm font-medium text-white">{item.name || "Unnamed"}</p>
                    {item.tags.length ? (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map((t) => (
                          <span key={t} className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/60">
                            {t}
                          </span>
                        ))}
                        {item.color ? (
                          <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/60">
                            {item.color}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="text-[11px] text-white/40">
                      {daysAgo(item.last_used_at)}
                      {item.use_count ? ` · ${item.use_count}×` : ""}
                    </p>
                    {item.notes ? <p className="text-[11px] text-white/45">{item.notes}</p> : null}
                    {canEdit ? (
                      <div className="flex gap-1 pt-1">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-white/45 hover:bg-white/[0.06] hover:text-white"
                          title="Edit"
                          onClick={() => {
                            setEditing(item.id);
                            setAdding(null);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg px-2 py-1 text-[11px] text-white/45 hover:bg-white/[0.06] hover:text-white"
                          onClick={() => void toggleActive(item)}
                        >
                          {item.is_active ? "Hide" : "Show"}
                        </button>
                        <button
                          type="button"
                          className="ml-auto rounded-lg p-2 text-white/35 hover:bg-white/[0.06] hover:text-rose-300"
                          title="Delete"
                          onClick={() => void remove(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className={cn(VA_CARD, "mt-4 space-y-2 p-4 md:p-6")}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/75">
          Rules for the AI
        </p>
        <p className="text-sm text-white/55">
          Plain language. E.g. “never the same outfit two bunches in a row”, “lingerie-ish only for Trial
          accounts”, “no grey set on the main Instagram”.
        </p>
        <textarea
          className={cn(VA_FILTER_INPUT, "min-h-[90px] w-full resize-y")}
          value={rules}
          disabled={!canEdit}
          onChange={(e) => {
            setRules(e.target.value);
            setRulesSaved("idle");
          }}
        />
        {canEdit ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={cn(VA_BTN_SECONDARY, "min-h-10 px-4 text-xs")}
              disabled={rulesSaved === "saving"}
              onClick={() => void saveRules()}
            >
              {rulesSaved === "saving" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Save rules
            </button>
            {rulesSaved === "saved" ? <span className="text-[11px] text-emerald-300/80">Saved</span> : null}
            {rulesSaved === "error" ? <span className="text-[11px] text-rose-300/80">Could not save</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
