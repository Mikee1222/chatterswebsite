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
      "relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
      isActive(href)
        ? "border border-white/15 bg-white/[0.08] text-white"
        : "text-gray-500 hover:bg-white/[0.04] hover:text-gray-200"
    );

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} onClick={onNavigate} className={linkClass(href)}>
          {isActive(href) && (
            <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-white/60" />
          )}
          <Icon className={cn("h-5 w-5 shrink-0", isActive(href) ? "text-white" : "text-gray-500")} />
          <span className={isActive(href) ? "font-semibold text-white" : ""}>{label}</span>
        </Link>
      ))}
    </>
  );

  return (
    <>
      <aside className="hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-black/40 md:flex">
        <div className="border-b border-white/10 px-5 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/50">Gunzo Agency</p>
          <p className="mt-1 text-lg font-semibold text-white">Client Portal</p>
        </div>
        <nav className="flex-1 space-y-1.5 px-4 py-4">
          <NavLinks />
        </nav>
        <div className="border-t border-white/10 px-4 py-4">
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              Log out
            </button>
          </form>
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
          <div className="absolute left-0 top-0 flex h-screen w-64 flex-col overflow-y-auto border-r border-white/10 bg-black/90">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <span className="text-lg font-semibold text-white">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-gray-400 hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1.5 px-4 py-4">
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </nav>
            <div className="border-t border-white/10 px-4 py-4">
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
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
