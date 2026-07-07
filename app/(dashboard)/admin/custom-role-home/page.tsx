import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Building,
  Calendar,
  CalendarCheck,
  CheckSquare,
  Clock,
  CreditCard,
  FileText,
  Gift,
  Megaphone,
  MessageSquare,
  Radio,
  Shield,
  Star,
  TrendingUp,
  Trophy,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getSessionFromCookies } from "@/lib/auth";
import { getUserPermissions, isAdminAreaUser } from "@/lib/rbac";
import { PERMISSION_DESCRIPTIONS, PERMISSIONS, type Permission } from "@/lib/permissions";
import { shouldUsePersonalVaTasksNav } from "@/lib/nav-config";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type ShortcutCard = {
  permission: Permission;
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

const SHORTCUT_CARDS: ShortcutCard[] = [
  {
    permission: "accounts:view",
    title: "Accounts",
    href: ROUTES.admin.accounts,
    icon: UserCog,
    description: PERMISSION_DESCRIPTIONS["accounts:view"],
  },
  {
    permission: "billing:view",
    title: "Billing",
    href: ROUTES.admin.billing,
    icon: CreditCard,
    description: PERMISSION_DESCRIPTIONS["billing:view"],
  },
  {
    permission: "earnings:view",
    title: "Earnings",
    href: ROUTES.admin.earnings,
    icon: TrendingUp,
    description: PERMISSION_DESCRIPTIONS["earnings:view"],
  },
  {
    permission: "shifts:manage",
    title: "Live shifts",
    href: ROUTES.admin.liveShifts,
    icon: Radio,
    description: PERMISSION_DESCRIPTIONS["shifts:manage"],
  },
  {
    permission: "shifts:manage",
    title: "Shift activity",
    href: ROUTES.admin.shiftActivity,
    icon: Clock,
    description: PERMISSION_DESCRIPTIONS["shifts:manage"],
  },
  {
    permission: "models:view",
    title: "Models",
    href: ROUTES.admin.models,
    icon: Users,
    description: PERMISSION_DESCRIPTIONS["models:view"],
  },
  {
    permission: "marketing:view",
    title: "Marketing",
    href: ROUTES.admin.marketing,
    icon: Megaphone,
    description: PERMISSION_DESCRIPTIONS["marketing:view"],
  },
  {
    permission: "whales:view",
    title: "Whales",
    href: ROUTES.admin.whales,
    icon: Star,
    description: PERMISSION_DESCRIPTIONS["whales:view"],
  },
  {
    permission: "va-tasks:view",
    title: "VA Tasks",
    href: ROUTES.admin.vaTasks,
    icon: CheckSquare,
    description: PERMISSION_DESCRIPTIONS["va-tasks:view"],
  },
  {
    permission: "sops:manage",
    title: "SOP Library",
    href: ROUTES.admin.sopLibrary,
    icon: BookOpen,
    description: PERMISSION_DESCRIPTIONS["sops:manage"],
  },
  {
    permission: "challenges:view",
    title: "Challenges",
    href: ROUTES.admin.challenges,
    icon: Trophy,
    description: PERMISSION_DESCRIPTIONS["challenges:view"],
  },
  {
    permission: "rewards:view",
    title: "Rewards",
    href: ROUTES.admin.rewards,
    icon: Gift,
    description: PERMISSION_DESCRIPTIONS["rewards:view"],
  },
  {
    permission: "mistakes:view",
    title: "Mistakes",
    href: ROUTES.admin.mistakes,
    icon: AlertTriangle,
    description: PERMISSION_DESCRIPTIONS["mistakes:view"],
  },
  {
    permission: "custom-requests:view",
    title: "Custom requests",
    href: ROUTES.admin.customRequests,
    icon: FileText,
    description: PERMISSION_DESCRIPTIONS["custom-requests:view"],
  },
  {
    permission: "clients:view",
    title: "Clients",
    href: ROUTES.admin.clients,
    icon: Building,
    description: PERMISSION_DESCRIPTIONS["clients:view"],
  },
  {
    permission: "notifications:view",
    title: "Notifications",
    href: ROUTES.admin.testNotifications,
    icon: Bell,
    description: PERMISSION_DESCRIPTIONS["notifications:view"],
  },
  {
    permission: "roles:manage",
    title: "Roles",
    href: ROUTES.admin.roles,
    icon: Shield,
    description: PERMISSION_DESCRIPTIONS["roles:manage"],
  },
  {
    permission: "feedback:view",
    title: "Feedback",
    href: ROUTES.admin.feedback,
    icon: MessageSquare,
    description: PERMISSION_DESCRIPTIONS["feedback:view"],
  },
  {
    permission: "chatter_program:view",
    title: "Weekly program",
    href: ROUTES.admin.weeklyProgram,
    icon: Calendar,
    description: PERMISSION_DESCRIPTIONS["chatter_program:view"],
  },
  {
    permission: "va_program:view",
    title: "VA weekly program",
    href: ROUTES.admin.weeklyProgramVa,
    icon: CalendarCheck,
    description: PERMISSION_DESCRIPTIONS["va_program:view"],
  },
];

const cardClass = cn(
  "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 p-5 transition-colors",
  "bg-gradient-to-br from-zinc-900/95 via-zinc-900/80 to-pink-950/25",
  "shadow-[0_8px_32px_-12px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)]",
  "hover:border-pink-500/30 hover:bg-white/[0.03]"
);

export default async function CustomRoleHomePage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!isAdminAreaUser(user)) redirect(ROUTES.dashboard);

  const permissions = await getUserPermissions(user);
  if (permissions.length === 0) redirect(ROUTES.dashboard);

  const permissionSet = new Set(permissions);
  const visibleCards = SHORTCUT_CARDS.filter((card) => permissionSet.has(card.permission));

  const resolveShortcutHref = (card: ShortcutCard): string => {
    if (
      card.permission === PERMISSIONS.VA_TASKS_VIEW &&
      shouldUsePersonalVaTasksNav(user.role, permissionSet)
    ) {
      return ROUTES.va.tasks;
    }
    return card.href;
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-pink-300/80">Dashboard</p>
        <h1 className="mt-2 text-4xl font-semibold text-white">
          Welcome back, {user.fullName?.trim() || "there"}
        </h1>
        <p className="mt-2 text-gray-400">Here&apos;s what you have access to</p>
      </div>

      {visibleCards.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-5 py-8 text-center text-sm text-white/70">
          No sections available. Contact your administrator.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={`${card.permission}-${card.href}`}
                href={resolveShortcutHref(card)}
                className={cardClass}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-pink-300/90 transition-colors group-hover:border-pink-500/30 group-hover:bg-pink-500/10">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{card.title}</p>
                    <p className="mt-1 text-sm text-white/60">{card.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
