"use client";

import * as React from "react";
import { Link2, Trash2 } from "lucide-react";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { btnSecondaryClass } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export type GetMySocialLinkDraft = {
  getmysocial_link_id: string;
  link_role: "A" | "B";
  link_label: string;
  shortcode: string;
  of_destination_hint?: string;
  is_primary?: boolean;
};

type LiveLink = {
  id: string;
  shortcode: string;
  display_name: string;
  status: string | null;
  type: string;
};

type Props = {
  modelId: string;
  initialLinks?: GetMySocialLinkDraft[];
  onChange?: (links: GetMySocialLinkDraft[]) => void;
};

function defaultRows(initial?: GetMySocialLinkDraft[]): GetMySocialLinkDraft[] {
  const a = initial?.find((l) => l.link_role === "A");
  const b = initial?.find((l) => l.link_role === "B");
  return [
    {
      getmysocial_link_id: a?.getmysocial_link_id ?? "",
      link_role: "A",
      link_label: a?.link_label ?? "Link A",
      shortcode: a?.shortcode ?? "",
      of_destination_hint: a?.of_destination_hint ?? "",
      is_primary: true,
    },
    {
      getmysocial_link_id: b?.getmysocial_link_id ?? "",
      link_role: "B",
      link_label: b?.link_label ?? "Link B",
      shortcode: b?.shortcode ?? "",
      of_destination_hint: b?.of_destination_hint ?? "",
      is_primary: false,
    },
  ];
}

export function GetMySocialLinksEditor({
  modelId,
  initialLinks = [],
  onChange,
}: Props) {
  const [links, setLinks] = React.useState<GetMySocialLinkDraft[]>(() =>
    defaultRows(initialLinks)
  );
  const [showLookup, setShowLookup] = React.useState(false);
  const [lookupLoading, setLookupLoading] = React.useState(false);
  const [lookupError, setLookupError] = React.useState<string | null>(null);
  const [liveLinks, setLiveLinks] = React.useState<LiveLink[]>([]);
  const [lookupTarget, setLookupTarget] = React.useState<"A" | "B">("A");

  React.useEffect(() => {
    if (initialLinks.length) setLinks(defaultRows(initialLinks));
  }, [initialLinks]);

  function emit(next: GetMySocialLinkDraft[]) {
    setLinks(next);
    onChange?.(next);
  }

  function updateRole(role: "A" | "B", patch: Partial<GetMySocialLinkDraft>) {
    emit(links.map((a) => (a.link_role === role ? { ...a, ...patch, link_role: role } : a)));
  }

  function clearRole(role: "A" | "B") {
    updateRole(role, {
      getmysocial_link_id: "",
      shortcode: "",
      link_label: `Link ${role}`,
      of_destination_hint: "",
    });
  }

  function assignFromLookup(live: LiveLink, role: "A" | "B") {
    updateRole(role, {
      getmysocial_link_id: live.id,
      shortcode: live.shortcode || "",
      link_label: live.display_name || `Link ${role}`,
    });
    setShowLookup(false);
  }

  async function loadLookup(role: "A" | "B") {
    setLookupTarget(role);
    setShowLookup(true);
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch("/api/admin/getmysocial-links", { cache: "no-store" });
      const json = (await res.json()) as {
        links?: LiveLink[];
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setLookupError(json.message || json.error || "Failed to load links");
        setLiveLinks([]);
        return;
      }
      setLiveLinks(json.links ?? []);
      if (!(json.links ?? []).length) {
        setLookupError(json.message || "No links found on this GetMySocial account.");
      }
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {links.map((row) => (
        <div
          key={row.link_role}
          className={cn(
            "rounded-xl border p-3",
            row.link_role === "A"
              ? "border-[#D4AF8C]/40 bg-[#D4AF8C]/5"
              : "border-white/10 bg-black/20"
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF8C]/90">
              Link {row.link_role}
              {row.link_role === "A" ? " · Primary" : ""}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void loadLookup(row.link_role)}
                className={btnSecondaryClass}
              >
                Lookup
              </button>
              {row.getmysocial_link_id ? (
                <button
                  type="button"
                  onClick={() => clearRole(row.link_role)}
                  className="rounded-lg p-1.5 text-white/40 hover:bg-red-500/10 hover:text-red-300"
                  aria-label={`Clear Link ${row.link_role}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Label" icon={<Link2 />} htmlFor={`gms_label_${row.link_role}`}>
              <FormInput
                id={`gms_label_${row.link_role}`}
                value={row.link_label}
                onChange={(e) => updateRole(row.link_role, { link_label: e.target.value })}
                placeholder={`Link ${row.link_role}`}
              />
            </FormField>
            <FormField label="Shortcode" icon={<Link2 />} htmlFor={`gms_sc_${row.link_role}`}>
              <FormInput
                id={`gms_sc_${row.link_role}`}
                value={row.shortcode}
                onChange={(e) => updateRole(row.link_role, { shortcode: e.target.value })}
                placeholder="e.g. linaki"
              />
            </FormField>
            <FormField
              label="GetMySocial link ID"
              icon={<Link2 />}
              htmlFor={`gms_id_${row.link_role}`}
              className="sm:col-span-2"
            >
              <FormInput
                id={`gms_id_${row.link_role}`}
                value={row.getmysocial_link_id}
                onChange={(e) =>
                  updateRole(row.link_role, { getmysocial_link_id: e.target.value })
                }
                placeholder="lnk_…"
                autoComplete="off"
              />
            </FormField>
          </div>
        </div>
      ))}

      {showLookup ? (
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="mb-2 text-xs text-white/50">
            Assigning to Link {lookupTarget}
            <button
              type="button"
              className="ml-2 text-white/35 underline"
              onClick={() => setShowLookup(false)}
            >
              Close
            </button>
          </p>
          {lookupLoading ? (
            <p className="text-sm text-white/40">Loading GetMySocial links…</p>
          ) : lookupError ? (
            <p className="text-sm text-amber-200/90">{lookupError}</p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {liveLinks.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white/90">{l.display_name}</p>
                    <p className="truncate text-[11px] text-white/40">
                      /{l.shortcode} · {l.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={btnSecondaryClass}
                    onClick={() => assignFromLookup(l, lookupTarget)}
                  >
                    Use as {lookupTarget}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <input type="hidden" name="getmysocial_links_model_id" value={modelId} readOnly />
    </div>
  );
}

export function draftGetMySocialLinksForSave(
  rows: GetMySocialLinkDraft[]
): GetMySocialLinkDraft[] {
  return rows.filter((a) => a.getmysocial_link_id.trim());
}
