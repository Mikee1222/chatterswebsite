"use client";

import * as React from "react";
import { updateMyModelLanguageAction } from "@/app/actions/model-profile";
import type { ModelLang } from "@/lib/model-i18n";

type LanguageContextValue = {
  language: ModelLang;
  /** Updates UI immediately; persists to server/cookie in the background (no router refresh). */
  setLanguage: (lang: ModelLang) => Promise<void>;
};

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  initialLanguage,
  children,
}: {
  initialLanguage: ModelLang;
  children: React.ReactNode;
}) {
  const [language, setLangState] = React.useState<ModelLang>(initialLanguage);

  React.useEffect(() => {
    setLangState(initialLanguage);
  }, [initialLanguage]);

  const setLanguage = React.useCallback(async (lang: ModelLang) => {
    const next = lang === "es" ? "es" : "en";
    setLangState(next);
    if (typeof document !== "undefined") {
      document.cookie = `language=${next}; path=/; max-age=31536000; SameSite=Lax`;
    }
    void updateMyModelLanguageAction(next).catch(() => {});
  }, []);

  const value = React.useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
