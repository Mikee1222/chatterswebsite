"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Languages, Mail, User } from "lucide-react";
import { selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { useLanguage } from "@/lib/language-provider";
import { useTranslations } from "@/lib/use-translations";

type Props = {
  fullName: string;
  email: string;
  /** Current Airtable language_preference, drives the form default. */
  languagePreference: "en" | "es";
};

export function ModelProfileSettingsForm({ fullName, email, languagePreference: initialLangPref }: Props) {
  const { t } = useTranslations();
  const { setLanguage } = useLanguage();
  const [languagePreference, setLanguagePreference] = React.useState<"en" | "es">(initialLangPref);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    setLanguagePreference(initialLangPref);
  }, [initialLangPref]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      await setLanguage(languagePreference);
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save language.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative z-[25] min-w-0 max-md:px-0">
      <h2 className="mb-2 text-lg font-semibold tracking-tight text-white">{t("settings.profile")}</h2>
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-white/55 md:mb-8">{t("settings.profileIntro")}</p>

      <form onSubmit={(e) => void handleSubmit(e)} className="max-w-xl space-y-4">
        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}

        <FormField
          label={t("settings.displayName")}
          icon={<User />}
          htmlFor="model-profile-name"
          description={t("settings.displayNameHint")}
          staggerIndex={0}
        >
          <FormInput id="model-profile-name" readOnly tabIndex={-1} value={fullName} className="cursor-default opacity-90" />
        </FormField>

        <FormField
          label={t("settings.email")}
          icon={<Mail />}
          htmlFor="model-profile-email"
          description={t("settings.displayNameHint")}
          staggerIndex={1}
        >
          <FormInput id="model-profile-email" readOnly tabIndex={-1} value={email} className="cursor-default opacity-90" />
        </FormField>

        <FormField label={t("settings.appLanguage")} icon={<Languages />} htmlFor="model-profile-lang" staggerIndex={2}>
          <FormSelect
            id="model-profile-lang"
            value={languagePreference}
            onChange={(e) => setLanguagePreference(e.target.value === "es" ? "es" : "en")}
          >
            <option value="en" className={selectOptionClass}>
              English
            </option>
            <option value="es" className={selectOptionClass}>
              Español
            </option>
          </FormSelect>
        </FormField>

        <motion.div layout className="pt-1">
          <FormSubmitButton disabled={submitting} loading={submitting} success={success} successLabel={t("common.saved")}>
            {submitting ? t("common.saving") : t("settings.saveLanguage")}
          </FormSubmitButton>
        </motion.div>
      </form>
    </section>
  );
}
