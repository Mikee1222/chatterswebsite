"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  getBaseNavItemsForRole,
  EMPTY_HIDDEN_NAV_BY_PROFILE,
  type NavRole,
  type NavStorageProfile,
} from "@/lib/nav-config";
import { getNavVisibilityAction, setNavVisibilityAction } from "@/app/actions/system-settings";

const SECTIONS: { profile: NavStorageProfile; title: string; role: NavRole }[] = [
  { profile: "chatter", title: "Chatter", role: "chatter" },
  { profile: "virtual_assistant", title: "Virtual assistant", role: "virtual_assistant" },
  { profile: "admin", title: "Admin / manager", role: "admin" },
  { profile: "model", title: "Model", role: "model" },
];

export function NavVisibilitySettings() {
  const router = useRouter();
  const [hidden, setHidden] = React.useState<Record<NavStorageProfile, string[]>>({
    ...EMPTY_HIDDEN_NAV_BY_PROFILE,
  });
  const [hydrated, setHydrated] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void getNavVisibilityAction().then((loaded) => {
      if (!cancelled) {
        setHidden(loaded);
        setHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = React.useCallback(
    async (next: Record<NavStorageProfile, string[]>) => {
      setHidden(next);
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

  const setVisible = React.useCallback(
    (profile: NavStorageProfile, href: string, visible: boolean) => {
      const cur = hidden[profile] ?? [];
      const nextList = visible ? cur.filter((h) => h !== href) : cur.includes(href) ? cur : [...cur, href];
      void persist({ ...hidden, [profile]: nextList });
    },
    [hidden, persist]
  );

  const reset = React.useCallback(() => {
    void persist({ ...EMPTY_HIDDEN_NAV_BY_PROFILE });
  }, [persist]);

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
          {SECTIONS.map(({ profile, title, role }) => {
            const items = getBaseNavItemsForRole(role);
            const hiddenSet = new Set(hidden[profile] ?? []);
            return (
              <div key={profile} className="glass-card p-6">
                <h3 className="mb-4 text-base font-semibold text-white">{title}</h3>
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
                              onChange={(e) => setVisible(profile, item.href, e.target.checked)}
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
          })}

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
