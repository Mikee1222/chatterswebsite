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
      {/* Same logo asset as login / spin wheel — pink serif G */}
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF1493] via-[#E91E8C] to-[#DB2777] p-[1.5px] shadow-[0_0_24px_-6px_rgba(255,20,147,0.55),0_4px_12px_-6px_rgba(0,0,0,0.55)]">
        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#0D0B0D] p-[2px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/apple-touch-icon-v2.png"
            alt="Gunzo"
            width={36}
            height={36}
            className="h-full w-full rounded-full object-cover"
          />
        </span>
      </span>
      <div className="min-w-0 text-left">
        <p className="truncate text-sm font-semibold tracking-tight text-white">
          Careers
        </p>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D4AF8C]/75">
          Gunzo Team
        </p>
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
  const btn = (code: PipelineLanguage) => {
    const active = lang === code;
    return (
      <button
        type="button"
        onClick={() => onChange(code)}
        aria-pressed={active}
        className={cn(
          "min-w-[2.5rem] rounded-full px-3.5 py-1.5 font-semibold tracking-wide transition",
          active
            ? "bg-gradient-to-br from-[#FF1493] to-[#DB2777] text-white shadow-[0_4px_16px_-4px_rgba(255,20,147,0.5)]"
            : "text-white/50 hover:bg-white/[0.06] hover:text-white/80",
        )}
      >
        {code.toUpperCase()}
      </button>
    );
  };

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      role="group"
      aria-label={ui.language}
    >
      {btn("en")}
      <span className="mx-0.5 h-3.5 w-px shrink-0 bg-white/25" aria-hidden />
      {btn("el")}
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
