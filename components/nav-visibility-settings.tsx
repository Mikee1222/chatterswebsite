"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  getBaseNavItemsForRole,
  getBothTypeHiddenNavPreview,
  EMPTY_VA_HIDDEN_BY_TYPE,
  type NavRole,
  type NavStorageProfile,
  type ParsedHiddenNavConfig,
  type VaTypeNavKey,
} from "@/lib/nav-config";
import { getNavVisibilityAction, setNavVisibilityAction } from "@/app/actions/system-settings";

type NavVisibilityState = ParsedHiddenNavConfig & { vaByType: NonNullable<ParsedHiddenNavConfig["vaByType"]> };

const FLAT_SECTIONS: { profile: NavStorageProfile; title: string; role: NavRole }[] = [
  { profile: "chatter", title: "Chatter", role: "chatter" },
  { profile: "admin", title: "Admin / manager", role: "admin" },
  { profile: "model", title: "Model", role: "model" },
];

const VA_TYPE_SECTIONS: { key: VaTypeNavKey; title: string; description: string }[] = [
  {
    key: "chatting",
    title: "Chatting VA",
    description: "Hidden links for VAs with va_type chatting.",
  },
  {
    key: "marketing",
    title: "Marketing VA",
    description: "Hidden links for VAs with va_type marketing.",
  },
  {
    key: "both",
    title: "Both (chatting + marketing)",
    description:
      "Toggles apply to both chatting and marketing lists. VAs with va_type both see UNION visibility (hidden only when hidden for both types).",
  },
];

function emptyState(): NavVisibilityState {
  return {
    byProfile: {
      chatter: [],
      virtual_assistant: [],
      admin: [],
      model: [],
    },
    vaByType: { ...EMPTY_VA_HIDDEN_BY_TYPE },
  };
}

export function NavVisibilitySettings() {
  const router = useRouter();
  const [state, setState] = React.useState<NavVisibilityState>(emptyState());
  const [hydrated, setHydrated] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void getNavVisibilityAction().then((loaded) => {
      if (!cancelled) {
        setState({
          byProfile: { ...loaded.byProfile },
          vaByType: loaded.vaByType ?? { ...EMPTY_VA_HIDDEN_BY_TYPE },
        });
        setHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = React.useCallback(
    async (next: NavVisibilityState) => {
      setState(next);
      setSaveError(null);
      const res = await setNavVisibilityAction(next);
      if (!res.success) {
        setSaveError(res.error);
        return;
      }
      router.refresh();
    },
    [router]
  );

  const setFlatVisible = React.useCallback(
    (profile: NavStorageProfile, href: string, visible: boolean) => {
      const cur = state.byProfile[profile] ?? [];
      const nextList = visible ? cur.filter((h) => h !== href) : cur.includes(href) ? cur : [...cur, href];
      void persist({
        ...state,
        byProfile: { ...state.byProfile, [profile]: nextList },
      });
    },
    [state, persist]
  );

  const setVaTypeVisible = React.useCallback(
    (vaKey: VaTypeNavKey, href: string, visible: boolean) => {
      const vaByType = state.vaByType ?? { ...EMPTY_VA_HIDDEN_BY_TYPE };
      if (vaKey === "both") {
        const chatting = vaByType.chatting ?? [];
        const marketing = vaByType.marketing ?? [];
        const nextChatting = visible
          ? chatting.filter((h) => h !== href)
          : chatting.includes(href)
            ? chatting
            : [...chatting, href];
        const nextMarketing = visible
          ? marketing.filter((h) => h !== href)
          : marketing.includes(href)
            ? marketing
            : [...marketing, href];
        void persist({
          ...state,
          vaByType: {
            ...vaByType,
            chatting: nextChatting,
            marketing: nextMarketing,
            both: getBothTypeHiddenNavPreview({
              chatting: nextChatting,
              marketing: nextMarketing,
              both: [],
            }),
          },
        });
        return;
      }
      const cur = vaByType[vaKey] ?? [];
      const nextList = visible ? cur.filter((h) => h !== href) : cur.includes(href) ? cur : [...cur, href];
      const nextVaByType = { ...vaByType, [vaKey]: nextList };
      void persist({
        ...state,
        vaByType: {
          ...nextVaByType,
          both: getBothTypeHiddenNavPreview(nextVaByType),
        },
      });
    },
    [state, persist]
  );

  const reset = React.useCallback(() => {
    void persist(emptyState());
  }, [persist]);

  const vaItems = getBaseNavItemsForRole("virtual_assistant");
  const vaByType = state.vaByType ?? { ...EMPTY_VA_HIDDEN_BY_TYPE };

  return (
    <section className="border-t border-white/10 pt-8">
      <h2 className="mb-2 text-lg font-semibold text-white">Navigation management</h2>
      <p className="mb-6 max-w-2xl text-sm text-white/60">
        Show or hide sidebar and mobile nav links per role. Preferences are stored in Airtable (
        <code className="text-white/80">system_settings.hidden_nav_items</code>).
      </p>
      {saveError ? <p className="mb-4 text-sm text-red-400">{saveError}</p> : null}

      {!hydrated ? (
        <p className="text-sm text-white/50">Loading…</p>
      ) : (
        <div className="space-y-8">
          {FLAT_SECTIONS.map(({ profile, title, role }) => {
            const items = getBaseNavItemsForRole(role);
            const hiddenSet = new Set(state.byProfile[profile] ?? []);
            return (
              <NavToggleSection
                key={profile}
                title={title}
                items={items}
                hiddenSet={hiddenSet}
                onToggle={(href, visible) => setFlatVisible(profile, href, visible)}
              />
            );
          })}

          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-white">Virtual assistant (by va_type)</h3>
              <p className="mt-1 max-w-2xl text-sm text-white/55">
                Configure which of the {vaItems.length} VA nav tabs each specialization can see. VAs without{" "}
                <code className="text-white/75">va_type</code> see all tabs.
              </p>
            </div>
            {VA_TYPE_SECTIONS.map(({ key, title, description }) => {
              const hiddenSet =
                key === "both"
                  ? new Set(getBothTypeHiddenNavPreview(vaByType))
                  : new Set(vaByType[key] ?? []);
              return (
                <NavToggleSection
                  key={key}
                  title={title}
                  subtitle={description}
                  items={vaItems}
                  hiddenSet={hiddenSet}
                  onToggle={(href, visible) => setVaTypeVisible(key, href, visible)}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-white/20 bg-transparent px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/10"
            >
              Reset to default
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function NavToggleSection({
  title,
  subtitle,
  items,
  hiddenSet,
  onToggle,
}: {
  title: string;
  subtitle?: string;
  items: ReturnType<typeof getBaseNavItemsForRole>;
  hiddenSet: Set<string>;
  onToggle: (href: string, visible: boolean) => void;
}) {
  return (
    <div className="glass-card p-6">
      <h3 className="mb-1 text-base font-semibold text-white">{title}</h3>
      {subtitle ? <p className="mb-4 text-sm text-white/50">{subtitle}</p> : <div className="mb-4" />}
      <ul className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.03]">
        {items.map((item) => {
          const isVisible = !hiddenSet.has(item.href);
          return (
            <li
              key={item.href}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 first:rounded-t-xl last:rounded-b-xl"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white/90">{item.label}</p>
                <p className="truncate font-mono text-xs text-white/45">{item.href}</p>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-white/70">
                <span className="select-none">{isVisible ? "Shown" : "Hidden"}</span>
                <span className="relative inline-block h-7 w-12 shrink-0">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={isVisible}
                    onChange={(e) => onToggle(item.href, e.target.checked)}
                  />
                  <span
                    className="pointer-events-none absolute inset-0 rounded-full bg-white/10 transition-colors peer-checked:bg-pink-500/35"
                    aria-hidden
                  />
                  <span
                    className="pointer-events-none absolute left-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white/80 shadow transition-transform duration-150 peer-checked:translate-x-[1.375rem] peer-checked:bg-pink-200"
                    aria-hidden
                  />
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
