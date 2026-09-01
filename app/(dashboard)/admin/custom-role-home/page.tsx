import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
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
  ImageOff,
  Megaphone,
  MessageSquare,
  Radio,
  Shield,
  Star,
  TrendingUp,
  Trophy,
  UserCog,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getSessionFromCookies } from "@/lib/auth";
import { getUserPermissions, isAdminAreaUser } from "@/lib/rbac";
import { PERMISSION_DESCRIPTIONS, PERMISSIONS, type Permission } from "@/lib/permissions";
import { shouldUsePersonalVaTasksNav, qualifiesForAdminVaTasksNav } from "@/lib/nav-config";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { HomeQuickInfo } from "@/components/home-quick-info";

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
    permission: "marketing:manage",
    title: "Marketing",
    href: ROUTES.admin.marketing,
    icon: Megaphone,
    description: PERMISSION_DESCRIPTIONS["marketing:manage"],
  },
  {
    permission: "marketing:view",
    title: "Marketing",
    href: ROUTES.va.marketingAccounts,
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
    title: "Tasks",
    href: ROUTES.admin.vaTasks,
    icon: CheckSquare,
    description: PERMISSION_DESCRIPTIONS["va-tasks:view"],
  },
  {
    permission: "task_progress:view",
    title: "Tasks",
    href: ROUTES.admin.vaTasks,
    icon: CheckSquare,
    description: PERMISSION_DESCRIPTIONS["task_progress:view"],
  },
  {
    permission: "sops:view",
    title: "SOPs / Training",
    href: ROUTES.sops,
    icon: BookOpen,
    description: PERMISSION_DESCRIPTIONS["sops:view"],
  },
  {
    permission: "sops:manage",
    title: "SOP Library",
    href: ROUTES.admin.sopLibrary,
    icon: BookOpen,
    description: PERMISSION_DESCRIPTIONS["sops:manage"],
  },
  {
    permission: "winner_sourcing:submit",
    title: "Fill Bunches",
    href: ROUTES.winnerRecreates,
    icon: Trophy,
    description: PERMISSION_DESCRIPTIONS["winner_sourcing:submit"],
  },
  {
    permission: "my_profiles:view",
    title: "My Profiles",
    href: ROUTES.myProfiles,
    icon: UserCheck,
    description: PERMISSION_DESCRIPTIONS["my_profiles:view"],
  },
  {
    permission: "blur_tool:access",
    title: "Blur tool",
    href: ROUTES.va.blurTool,
    icon: ImageOff,
    description: PERMISSION_DESCRIPTIONS["blur_tool:access"],
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
  "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10",
  "bg-gradient-to-br from-zinc-900/95 via-zinc-900/80 to-pink-950/25",
  "shadow-[0_8px_32px_-12px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)]",
  "transition-[transform,box-shadow,border-color] duration-200 motion-reduce:transition-none",
  "hover:-translate-y-0.5 hover:border-pink-500/30",
  "hover:shadow-[0_18px_50px_-14px_rgba(0,0,0,0.7),0_0_36px_-8px_rgba(255,20,147,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]"
);

export default async function CustomRoleHomePage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (!isAdminAreaUser(user)) redirect(ROUTES.dashboard);

  const permissions = await getUserPermissions(user);
  if (permissions.length === 0) redirect(ROUTES.dashboard);

  const permissionSet = new Set(permissions);
  const visibleCards = SHORTCUT_CARDS.filter((card) => {
    if (!permissionSet.has(card.permission)) return false;
    if (
      card.permission === PERMISSIONS.VA_TASKS_VIEW &&
      qualifiesForAdminVaTasksNav(permissionSet)
    ) {
      return false;
    }
    // Prefer admin Marketing when manage is granted; hide the VA-facing view card.
    if (
      card.permission === PERMISSIONS.MARKETING_VIEW &&
      permissionSet.has(PERMISSIONS.MARKETING_MANAGE)
    ) {
      return false;
    }
    if (
      card.permission === PERMISSIONS.WINNER_SOURCING_SUBMIT &&
      permissionSet.has(PERMISSIONS.WINNER_SOURCING_MANAGE)
    ) {
      return false;
    }
    return true;
  });

  const resolveShortcutHref = (card: ShortcutCard): string => {
    if (
      card.permission === PERMISSIONS.VA_TASKS_VIEW &&
      shouldUsePersonalVaTasksNav(user.role, permissionSet)
    ) {
      return ROUTES.va.tasks;
    }
    if (
      card.permission === PERMISSIONS.TASK_PROGRESS_VIEW ||
      card.permission === PERMISSIONS.VA_TASKS_MANAGE
    ) {
      return ROUTES.admin.vaTasks;
    }
    return card.href;
  };

  const cardCount = visibleCards.length;
  // Few cards render as substantial, centered cards so the page never looks sparse;
  // larger counts fall back to the responsive grid.
  const few = cardCount > 0 && cardCount <= 3;

  return (
    <div className="space-y-8">
      <div
        className="relative overflow-hidden rounded-2xl border border-pink-500/15 bg-gradient-to-br from-pink-500/[0.08] via-black/45 to-fuchsia-950/25 px-6 py-6 backdrop-blur-xl md:px-8 md:py-7"
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 0 36px -10px hsl(330 80% 55% / 0.12)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-pink-200/60">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Welcome back, {user.fullName?.trim() || "there"}
        </h1>
        <p className="mt-1.5 text-[15px] text-white/65">Here&apos;s what you have access to</p>
        <div className="mt-5">
          <HomeQuickInfo />
        </div>
      </div>

      {cardCount === 0 ? (
        <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/95 via-zinc-900/80 to-pink-950/20 px-6 py-10 text-center shadow-[0_8px_32px_-12px_rgba(0,0,0,0.65)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-pink-500/25 bg-pink-500/10 text-pink-300/90">
            <Shield className="h-6 w-6" aria-hidden />
          </div>
          <p className="mt-4 text-base font-medium text-white">You&apos;re all set up</p>
          <p className="mt-1.5 text-sm text-white/60">
            No dashboard sections are assigned to your role yet. Need access to something? Reach out to your admin.
          </p>
        </div>
      ) : (
        <div
          className={cn(
            "gap-5",
            few
              ? "flex flex-wrap justify-center"
              : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          )}
        >
          {visibleCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={`${card.permission}-${card.href}`}
                href={resolveShortcutHref(card)}
                className={cn(
                  cardClass,
                  few ? "w-full p-6 sm:w-[340px]" : "p-5"
                )}
              >
                <div className={cn("flex items-start", few ? "gap-5" : "gap-4")}>
                  <div
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-xl border border-pink-500/20 bg-gradient-to-br from-pink-500/15 to-[#D4AF8C]/10 text-pink-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_18px_-6px_rgba(255,20,147,0.5)] transition-colors group-hover:border-pink-500/40 group-hover:from-pink-500/25 group-hover:to-[#D4AF8C]/15",
                      few ? "h-14 w-14" : "h-11 w-11"
                    )}
                  >
                    <Icon className={few ? "h-6 w-6" : "h-5 w-5"} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-semibold text-white", few && "text-lg")}>{card.title}</p>
                    <p className={cn("mt-1 text-white/60", few ? "text-sm leading-relaxed" : "text-sm")}>
                      {card.description}
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-medium text-pink-300/80 transition-colors group-hover:text-pink-200">
                  <span>Open {card.title}</span>
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
                    aria-hidden
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {cardCount > 0 && few ? (
        <p className="text-center text-sm text-white/45">
          Need access to something else? Contact your admin.
        </p>
      ) : null}
    </div>
  );
}
