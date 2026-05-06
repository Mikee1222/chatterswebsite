"use client";

import * as React from "react";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { getNestedMessageString, interpolate } from "@/lib/i18n-utils";
import { useLanguage } from "@/lib/language-provider";
import type { ModelLang } from "@/lib/model-i18n";

type MessagesRoot = (typeof en)["model"];

/**
 * Client translations for keys under the model namespace in messages/en.json and messages/es.json.
 * Example: t('nav.home'), t('periodTracker.daysLeft', { days: 3 }).
 */
export function useTranslations(namespace: keyof typeof en | "model" = "model") {
  const { language } = useLanguage();

  const root = React.useMemo(() => {
    const pack = language === "es" ? es : en;
    if (namespace === "model") return pack.model as MessagesRoot;
    return (pack as Record<string, unknown>)[namespace as string] as unknown as MessagesRoot;
  }, [language, namespace]);

  const t = React.useCallback(
    (key: string, params?: Record<string, string | number | undefined | null>) => {
      const raw = getNestedMessageString(root, key);
      const str = typeof raw === "string" ? raw : key;
      return interpolate(str, params);
    },
    [root]
  );

  return { t, language: language as ModelLang };
}
