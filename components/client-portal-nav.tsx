"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  BarChart3,
  History,
  Home,
  LayoutGrid,
  Menu,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { logout } from "@/app/actions/auth";

const NAV_ITEMS = [
  { href: ROUTES.client.home, label: "Home", icon: Home },
  { href: ROUTES.client.content, label: "Content", icon: LayoutGrid },
  { href: ROUTES.client.paymentHistory, label: "Payment History", icon: History },
  { href: ROUTES.client.payChatting, label: "Pay Chatting", icon: Wallet },
  { href: ROUTES.client.payCrm, label: "Pay CRM", icon: Building2 },
  { href: ROUTES.client.gunzoPartnership, label: "Gunzo Partnership", icon: BarChart3 },
] as const;

export function ClientPortalNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen]);

  const isActive = (href: string) =>
    href === ROUTES.client.home ? pathname === href : pathname.startsWith(href);

  const linkClass = (href: string) =>
    cn(
      "group relative flex items-center gap-3.5 rounded-xl border-l-[3px] px-3.5 py-3 text-[15px] font-medium transition-[background,box-shadow,color,border-color,transform] duration-200 ease-out",
      isActive(href)
        ? "border-pink-400 bg-gradient-to-r from-pink-500/22 via-pink-500/10 to-white/[0.03] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_28px_-12px_rgba(236,72,153,0.35)]"
        : "border-transparent text-white/65 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/95 active:scale-[0.99]"
    );

  const iconClass = (href: string) =>
    cn(
      "relative z-10 h-[1.35rem] w-[1.35rem] shrink-0 transition-colors duration-200",
      isActive(href)
        ? "text-pink-200 drop-shadow-[0_0_10px_rgba(236,72,153,0.35)]"
        : "text-white/45 group-hover:text-pink-200/85"
    );

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} onClick={onNavigate} className={linkClass(href)}>
          <Icon className={iconClass(href)} aria-hidden />
          <span className="relative z-10 min-w-0 flex-1 truncate leading-snug">{label}</span>
        </Link>
      ))}
    </>
  );

  return (
    <>
      <aside className="glass-panel fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-white/[0.08] bg-black/50 shadow-[4px_0_40px_-12px_rgba(0,0,0,0.65)] backdrop-blur-xl md:block">
        <div className="flex h-full flex-col">
        <div className="flex h-[3.25rem] items-center border-b border-white/[0.08] px-5">
          <Link
            href={ROUTES.client.home}
            prefetch
            className="text-[15px] font-semibold tracking-tight text-white transition-colors hover:text-pink-100/95"
          >
            Client Portal
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <NavLinks />
        </nav>
        <div className="border-t border-white/[0.08] px-4 py-4">
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-xl px-3.5 py-3 text-left text-sm font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white/95"
            >
              Log out
            </button>
          </form>
        </div>
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-3 z-40 rounded-lg border border-white/10 bg-black/60 p-2 text-white/70 backdrop-blur-md hover:text-white md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 flex h-screen w-64 flex-col overflow-y-auto border-r border-white/10 bg-black/90 backdrop-blur-xl">
            <div className="flex h-[3.25rem] items-center justify-between border-b border-white/10 px-4">
              <span className="text-[15px] font-semibold text-white">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-white/45 transition-colors hover:text-white/95"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </nav>
            <div className="border-t border-white/10 px-4 py-4">
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full rounded-xl px-3.5 py-3 text-left text-sm font-medium text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white/95"
                >
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
