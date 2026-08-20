"use client";

import {
  APPLY_EYEBROW,
  APPLY_GLASS,
} from "@/lib/application-ui-tokens";
import type { PipelineLanguage } from "@/lib/application-pipeline-i18n";
import { pipelineUi } from "@/lib/application-pipeline-i18n";
import { cn } from "@/lib/utils";

export function ApplyAmbientBg() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% -8%, rgba(255,20,147,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(212,175,140,0.1), transparent 50%), radial-gradient(ellipse 40% 30% at 0% 80%, rgba(255,20,147,0.08), transparent 45%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        aria-hidden
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </>
  );
}

export function ApplyBrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/12 bg-gradient-to-br from-white/[0.12] to-[#FF1493]/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={28} height={28} className="h-7 w-7" />
      </span>
      <div className="min-w-0 text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#D4AF8C]/75">
          Gunzo
        </p>
        <p className="truncate text-sm font-medium text-white/90">Careers</p>
      </div>
    </div>
  );
}

export function ApplyLanguageSwitcher({
  lang,
  onChange,
}: {
  lang: PipelineLanguage;
  onChange: (l: PipelineLanguage) => void;
}) {
  const ui = pipelineUi(lang);
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.04] p-0.5 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      role="group"
      aria-label={ui.language}
    >
      {(["en", "el"] as const).map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            className={cn(
              "rounded-full px-3 py-1.5 font-medium transition",
              active
                ? "bg-gradient-to-br from-[#FF1493] to-[#DB2777] text-white shadow-[0_4px_16px_-4px_rgba(255,20,147,0.5)]"
                : "text-white/45 hover:text-white/75",
            )}
          >
            {code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

export function ApplyHeader({
  lang,
  onLangChange,
  showLang = true,
}: {
  lang?: PipelineLanguage | null;
  onLangChange?: (l: PipelineLanguage) => void;
  showLang?: boolean;
}) {
  return (
    <header className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 pt-5 sm:pt-6">
      <ApplyBrandMark />
      {showLang && lang && onLangChange ? (
        <ApplyLanguageSwitcher lang={lang} onChange={onLangChange} />
      ) : (
        <span className={APPLY_EYEBROW}>Apply</span>
      )}
    </header>
  );
}

export function ApplyFooter({ text }: { text?: string }) {
  return (
    <footer className="mx-auto mt-auto w-full max-w-xl px-4 pb-8 pt-10 text-center">
      {text ? <p className="mb-3 text-xs leading-relaxed text-white/35">{text}</p> : null}
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/25">
        © {new Date().getFullYear()} Gunzo · Confidential application
      </p>
    </footer>
  );
}

export function ApplyStepShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-xl px-4 py-6 sm:py-8", className)}>
      <div className={APPLY_GLASS}>{children}</div>
    </div>
  );
}
