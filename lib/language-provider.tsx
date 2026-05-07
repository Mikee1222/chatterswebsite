"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateMyModelLanguageAction } from "@/app/actions/model-profile";
import type { ModelLang } from "@/lib/model-i18n";

type LanguageContextValue = {
  language: ModelLang;
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
  const router = useRouter();

  React.useEffect(() => {
    setLangState(initialLanguage);
  }, [initialLanguage]);

  const setLanguage = React.useCallback(async (lang: ModelLang) => {
    const next = lang === "es" ? "es" : "en";
    const res = await updateMyModelLanguageAction(next);
    if (!res.success) {
      throw new Error(res.error ?? "Could not save language.");
    }
    document.cookie = `language=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setLangState(next);
    router.refresh();
  }, [router]);

  const value = React.useMemo(() => ({ language, setLanguage }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Fixed EN + no-op setLanguage: isolates layout blank-page issues tied to LanguageProvider / router.refresh. */
export function StaticEnLanguageProvider({ children }: { children: React.ReactNode }) {
  const value = React.useMemo<LanguageContextValue>(
    () => ({
      language: "en",
      setLanguage: async () => {},
    }),
    []
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
