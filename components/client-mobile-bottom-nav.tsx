"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, History, Home, LayoutGrid, Settings } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const TABS = [
  { href: ROUTES.client.home, label: "Home", icon: Home, match: (p: string) => p === ROUTES.client.home },
  {
    href: ROUTES.client.paymentHistory,
    label: "History",
    icon: History,
    match: (p: string) => p.startsWith(ROUTES.client.paymentHistory),
  },
  {
    href: ROUTES.client.payChatting,
    label: "Pay",
    icon: CreditCard,
    match: (p: string) =>
      p.startsWith(ROUTES.client.payChatting) ||
      p.startsWith(ROUTES.client.payCrm) ||
      p.startsWith(ROUTES.client.payments),
  },
  {
    href: ROUTES.client.content,
    label: "Content",
    icon: LayoutGrid,
    match: (p: string) => p.startsWith(ROUTES.client.content),
  },
  {
    href: ROUTES.client.settings,
    label: "Settings",
    icon: Settings,
    match: (p: string) => p.startsWith(ROUTES.client.settings),
  },
] as const;

export function ClientMobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex h-[var(--mobile-bottom-nav-height,76px)] items-stretch justify-around gap-0.5 border-t border-white/[0.09] bg-zinc-950/92 px-1 pt-1 backdrop-blur-xl md:hidden"
      style={{
        paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
      aria-label="Client portal navigation"
    >
      {TABS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            prefetch
            className={cn(
              "relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1.5 transition-all duration-200 ease-out",
              "border-0 bg-transparent shadow-none outline-none ring-0",
              active
                ? "text-pink-200"
                : "text-white/45 active:scale-[0.96] hover:bg-white/[0.06] hover:text-white/90"
            )}
          >
            {active ? (
              <span
                className="absolute left-1/2 top-1.5 h-1 w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-pink-400 via-pink-300 to-fuchsia-400 shadow-[0_0_14px_rgba(236,72,153,0.55)]"
                aria-hidden
              />
            ) : null}
            <Icon
              className={cn(
                "relative z-10 h-6 w-6 shrink-0 transition-[transform,filter] duration-200",
                active && "scale-[1.06] drop-shadow-[0_0_10px_rgba(236,72,153,0.4)]"
              )}
              aria-hidden
            />
            <span className="relative z-10 text-[10px] leading-tight text-white/55">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
