"use client";

import { Calendar, Droplet } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { formatDateLong } from "@/lib/format";
import { useLanguage } from "@/lib/language-provider";
import { useTranslations } from "@/lib/use-translations";

type Props = {
  periodTrackingEnabled: boolean;
  isInPeriod: boolean;
  dayNumber: number | null;
  nextExpected: string | null;
};

/** Read-only period summary on model home; full logging lives on Availability. */
export function ModelPeriodHomeStatusCard({ periodTrackingEnabled, isInPeriod, dayNumber, nextExpected }: Props) {
  const { t } = useTranslations();
  const { language } = useLanguage();
  const locale = language === "es" ? "es" : "en-GB";

  if (!periodTrackingEnabled) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      {isInPeriod ? (
        <p className="text-sm text-rose-400">
          <><Droplet className="inline h-3.5 w-3.5 text-rose-400" aria-hidden /> {t("periodTracker.homePeriodActive")}</>
          {dayNumber != null ? ` · ${t("periodTracker.homeDay", { day: dayNumber })}` : ""}
        </p>
      ) : nextExpected ? (
        <p className="text-sm text-white/50">
          <><Calendar className="inline h-3.5 w-3.5 text-amber-300" aria-hidden /> {t("periodTracker.homeNextPeriod")}</>
          <span className="text-white/70">{formatDateLong(nextExpected, locale)}</span>
        </p>
      ) : (
        <p className="text-sm text-white/30">{t("periodTracker.homeLogHint")}</p>
      )}
      <Link
        href={ROUTES.model.schedule}
        className="mt-2 inline-block text-xs font-medium text-pink-300/90 underline-offset-2 hover:text-pink-200 hover:underline"
      >
        {t("periodTracker.homeManageAvailability")}
      </Link>
    </div>
  );
}
