"use client";

import * as React from "react";
import type { UserNavPreferences } from "@/lib/nav-preferences";
import { saveMyNavPreferences } from "@/app/actions/nav-preferences";

const SAVE_DEBOUNCE_MS = 400;

export function useNavPreferencesState(initial: UserNavPreferences) {
  const [prefs, setPrefs] = React.useState<UserNavPreferences>(initial);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = React.useRef(prefs);

  React.useEffect(() => {
    setPrefs(initial);
    latestRef.current = initial;
  }, [initial]);

  const persist = React.useCallback((next: UserNavPreferences) => {
    latestRef.current = next;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveMyNavPreferences(next);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const updatePrefs = React.useCallback(
    (updater: (prev: UserNavPreferences) => UserNavPreferences) => {
      setPrefs((prev) => {
        const next = updater(prev);
        latestRef.current = next;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const toggleSectionCollapsed = React.useCallback(
    (section: string) => {
      updatePrefs((prev) => {
        const collapsed = prev.collapsed_sections.includes(section)
          ? prev.collapsed_sections.filter((s) => s !== section)
          : [...prev.collapsed_sections, section];
        return { ...prev, collapsed_sections: collapsed };
      });
    },
    [updatePrefs]
  );

  const toggleSectionHidden = React.useCallback(
    (section: string) => {
      updatePrefs((prev) => {
        const hidden = prev.hidden_sections.includes(section)
          ? prev.hidden_sections.filter((s) => s !== section)
          : [...prev.hidden_sections, section];
        return { ...prev, hidden_sections: hidden };
      });
    },
    [updatePrefs]
  );

  const togglePin = React.useCallback(
    (href: string, maxPinned: number) => {
      updatePrefs((prev) => {
        if (prev.pinned_hrefs.includes(href)) {
          return { ...prev, pinned_hrefs: prev.pinned_hrefs.filter((h) => h !== href) };
        }
        if (prev.pinned_hrefs.length >= maxPinned) return prev;
        return { ...prev, pinned_hrefs: [...prev.pinned_hrefs, href] };
      });
    },
    [updatePrefs]
  );

  const showAllSections = React.useCallback(() => {
    updatePrefs((prev) => ({ ...prev, hidden_sections: [] }));
  }, [updatePrefs]);

  return {
    prefs,
    toggleSectionCollapsed,
    toggleSectionHidden,
    togglePin,
    showAllSections,
    isSectionCollapsed: (section: string) => prefs.collapsed_sections.includes(section),
    isSectionHidden: (section: string) => prefs.hidden_sections.includes(section),
    pinnedHrefs: prefs.pinned_hrefs,
    hiddenSections: prefs.hidden_sections,
  };
}
