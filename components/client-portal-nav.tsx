"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  CreditCard,
  FileText,
  History,
  Home,
  Menu,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: ROUTES.client.home, label: "Home", icon: Home },
  { href: ROUTES.client.payments, label: "Payments", icon: CreditCard },
  { href: ROUTES.client.paymentHistory, label: "History", icon: History },
  { href: ROUTES.client.invoices, label: "Invoices", icon: FileText },
  { href: ROUTES.client.models, label: "Models", icon: Users },
  { href: ROUTES.client.calendar, label: "Calendar", icon: Calendar },
] as const;

export function ClientPortalNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === ROUTES.client.home ? pathname === href : pathname.startsWith(href);

  const linkClass = (href: string) =>
    cn(
      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
      isActive(href)
        ? "bg-pink-500/15 text-pink-300 border border-pink-400/25"
        : "text-white/60 hover:text-white hover:bg-white/[0.06]"
    );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:gap-1 md:border-r md:border-white/10 md:bg-black/30 md:px-4 md:py-6 md:backdrop-blur-xl">
        <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Client Portal
        </p>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass(href)}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile header toggle — fixed top-left */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-3 z-40 rounded-lg border border-white/10 bg-black/60 p-2 text-white/70 backdrop-blur-md hover:text-white md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col border-r border-white/10 bg-[#121218]/95 p-5 backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-white/60 hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={linkClass(href)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-white/10 bg-black/80 px-1 py-2 backdrop-blur-xl md:hidden">
        {NAV_ITEMS.slice(0, 5).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors",
              isActive(href) ? "text-pink-400" : "text-white/50"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
