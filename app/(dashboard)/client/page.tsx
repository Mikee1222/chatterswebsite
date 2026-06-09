import Link from "next/link";
import {
  Building2,
  CalendarDays,
  CreditCard,
  BarChart3,
  LayoutGrid,
  UserCog,
  Wallet,
} from "lucide-react";
import { getSessionFromCookies } from "@/lib/auth";
import { getClientAirtableId } from "@/lib/client-session";
import {
  canSubmitPayment,
  getStatusLabel,
  getStatusTone,
  getSubmissionStatusLabel,
  getSubmissionStatusTone,
  isPendingReviewStatus,
} from "@/lib/billing-status";
import { formatDateEuropean } from "@/lib/format";
import { getChattingWeeklyDueWindow, getCycleAmountDue } from "@/lib/client-portal-utils";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { ClientAttentionItemsBox } from "@/components/client-portal/attention-items-box";
import {
  getCalendarEvents,
  getClientAttentionItems,
  getClientById,
  getClientCurrentBillingCycle,
  getClientCurrentChattingCycleFromRevenues,
  getClientModels,
  getClientPaymentMethods,
  getLatestSubmissionForCycle,
} from "@/services/client-portal";

export const dynamic = "force-dynamic";

export default async function ClientHomePage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "client") redirect(ROUTES.login);

  const clientId = getClientAirtableId(user);
  const client = await getClientById(clientId).catch(() => null);
  const displayName = client?.display_name || user.fullName || user.email;

  const [chattingResult, crmCycle, paymentMethods, models, attentionItems, events] =
    await Promise.all([
      getClientCurrentChattingCycleFromRevenues(clientId),
      getClientCurrentBillingCycle(clientId, "crm_monthly"),
      getClientPaymentMethods(clientId),
      getClientModels(clientId),
      getClientAttentionItems(clientId),
      getCalendarEvents(clientId).catch(() => [] as Awaited<ReturnType<typeof getCalendarEvents>>),
    ]);

  const chattingCycle = chattingResult?.cycle ?? null;
  const payableRevenues = chattingResult?.payableRevenues ?? [];

  const chattingDisplayStatus = (() => {
    if (payableRevenues.length === 0) return "announced";
    const statuses = payableRevenues.map((r) => r.status ?? "announced").filter((s) => s !== "draft");
    if (statuses.some((s) => s === "overdue")) return "overdue";
    if (statuses.some((s) => s === "pending_review")) return "pending_review";
    return "announced";
  })();

  const [chattingLatestSubmission, crmLatestSubmission] = await Promise.all([
    chattingCycle?.id ? getLatestSubmissionForCycle(chattingCycle.id, clientId) : Promise.resolve(null),
    crmCycle?.id ? getLatestSubmissionForCycle(crmCycle.id, clientId) : Promise.resolve(null),
  ]);

  const upcomingEvents = events
    .filter((e) => new Date(e.start_datetime) >= new Date())
    .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
    .slice(0, 3);

  const chattingSubmissionStatus = chattingLatestSubmission?.status;
  const crmSubmissionStatus = crmLatestSubmission?.status;
  const chattingPendingReview =
    chattingSubmissionStatus === "pending_review" || chattingDisplayStatus === "pending_review";
  const crmPendingReview =
    crmSubmissionStatus === "pending_review" || isPendingReviewStatus(crmCycle?.status);
  const chattingCanSubmit = canSubmitPayment(chattingDisplayStatus, chattingSubmissionStatus);
  const crmCanSubmit = canSubmitPayment(crmCycle?.status, crmSubmissionStatus);

  const chattingStatusLabel =
    chattingSubmissionStatus && chattingSubmissionStatus !== "rejected"
      ? getSubmissionStatusLabel(chattingSubmissionStatus)
      : getStatusLabel(chattingDisplayStatus);
  const chattingStatusTone =
    chattingSubmissionStatus && chattingSubmissionStatus !== "rejected"
      ? getSubmissionStatusTone(chattingSubmissionStatus)
      : getStatusTone(chattingDisplayStatus);
  const crmStatusLabel =
    crmSubmissionStatus && crmSubmissionStatus !== "rejected"
      ? getSubmissionStatusLabel(crmSubmissionStatus)
      : getStatusLabel(crmCycle?.status);
  const crmStatusTone =
    crmSubmissionStatus && crmSubmissionStatus !== "rejected"
      ? getSubmissionStatusTone(crmSubmissionStatus)
      : getStatusTone(crmCycle?.status);

  const formatAmount = (amount: number, currency?: string | null) => {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    return `${safeAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;
  };

  const chattingPayHref = chattingCycle?.id
    ? `${ROUTES.client.payChatting}?cycle=${encodeURIComponent(chattingCycle.id)}`
    : ROUTES.client.payChatting;

  return (
    <div className="space-y-10 pb-20 md:pb-0">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">CLIENT PORTAL</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-white md:text-5xl">
            Welcome back, {displayName}
          </h1>
          <p className="mt-3 text-base text-white/50 md:text-lg">
            Your executive overview of billing, payments, and activity.
          </p>
        </div>
      </div>

      <ClientAttentionItemsBox items={attentionItems} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card p-6 transition-all duration-300 hover:border-pink-400/30">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Wallet className="h-4 w-4 text-pink-400" />
                <span className="font-semibold">Chatting Weekly</span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">
                {chattingCycle
                  ? formatAmount(getCycleAmountDue(chattingCycle), chattingCycle.currency)
                  : "No active cycle"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {chattingCycle ? (
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-sm ${chattingStatusTone}`}
                >
                  {chattingStatusLabel}
                </span>
              ) : null}
              <Link
                href={chattingCanSubmit ? chattingPayHref : ROUTES.client.paymentHistory}
                className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                  chattingCanSubmit
                    ? "bg-pink-500/80 text-white hover:bg-pink-500"
                    : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                }`}
              >
                {chattingCanSubmit ? "Pay now" : "View"}
              </Link>
            </div>
          </div>
          {chattingCycle && (
            <div className="mt-5 space-y-3 text-sm text-white/60">
              {chattingCycle.period_start && chattingCycle.period_end && (
                <p className="text-xs text-white/45">
                  Week {formatDateEuropean(chattingCycle.period_start)} –{""}
                  {formatDateEuropean(chattingCycle.period_end)}
                </p>
              )}
              {(() => {
                const dueWindow = getChattingWeeklyDueWindow(chattingCycle.period_end);
                return dueWindow ? (
                  <p className="text-xs text-white/45">
                    Due window: {formatDateEuropean(dueWindow.dueStart)} –{""}
                    {formatDateEuropean(dueWindow.dueEnd)}
                  </p>
                ) : null;
              })()}
              {chattingPendingReview && chattingLatestSubmission?.submitted_datetime && (
                <p className="text-xs text-white/45">
                  Submitted: {formatDateEuropean(chattingLatestSubmission.submitted_datetime)}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="glass-card p-6 transition-all duration-300 hover:border-pink-400/30">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Building2 className="h-4 w-4 text-pink-400" />
                <span className="font-semibold">CRM Monthly</span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-white">
                {crmCycle ? formatAmount(getCycleAmountDue(crmCycle), crmCycle.currency) : "No active cycle"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {crmCycle ? (
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-sm ${crmStatusTone}`}
                >
                  {crmStatusLabel}
                </span>
              ) : null}
              <Link
                href={crmCanSubmit ? ROUTES.client.payCrm : ROUTES.client.paymentHistory}
                className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                  crmCanSubmit
                    ? "bg-pink-500/80 text-white hover:bg-pink-500"
                    : "border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                }`}
              >
                {crmCanSubmit ? "Pay now" : "View"}
              </Link>
            </div>
          </div>
          {crmCycle && (
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-white/60">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/45">Due date</p>
                <p className="font-medium text-white">{formatDateEuropean(crmCycle.due_date)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-white/45">Status</p>
                <p className="font-medium text-white">{crmStatusLabel}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold text-white">Quick actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction
            href={ROUTES.client.content}
            icon={LayoutGrid}
            title="Content Hub"
            subtitle="Schedule and manage content for your models"
          />
          <QuickAction
            href={chattingCanSubmit ? chattingPayHref : ROUTES.client.paymentHistory}
            icon={Wallet}
            title={chattingCanSubmit ? "Pay Chatting" : "View Chatting"}
            subtitle={chattingCanSubmit ? "Submit payment proof" : "Review status"}
          />
          <QuickAction
            href={crmCanSubmit ? ROUTES.client.payCrm : ROUTES.client.paymentHistory}
            icon={Building2}
            title={crmCanSubmit ? "Pay CRM" : "View CRM"}
            subtitle={crmCanSubmit ? "Submit payment proof" : "Review status"}
          />
          <QuickAction
            href={ROUTES.client.gunzoPartnership}
            icon={BarChart3}
            title="Gunzo Partnership"
            subtitle="Performance overview"
          />
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold text-white">
          <UserCog className="h-5 w-5 text-pink-400" />
          Your models
        </h3>
        {models.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => (
              <div
                key={model.id}
                className="glass-card rounded-xl border-l-2 border-l-pink-500/40 p-4"
              >
                <p className="font-semibold text-white">{model.model_name ?? "Model"}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/45">No models assigned</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="glass-card p-6">
          <h3 className="mb-4 flex items-center gap-2 text-xl font-semibold text-white">
            <CreditCard className="h-5 w-5 text-pink-400" />
            Payment methods
          </h3>
          {paymentMethods.length > 0 ? (
            <div className="space-y-2">
              {paymentMethods.slice(0, 3).map((method) => (
                <div key={method.id} className="glass-card rounded-xl p-4">
                  <p className="font-medium text-white">{method.label}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-white/50">{method.type}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/45">No payment methods available</p>
          )}
        </div>

        <div className="glass-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xl font-semibold text-white">
              <CalendarDays className="h-5 w-5 text-pink-400" />
              Upcoming events
            </h3>
            <Link href={ROUTES.client.weeklyPayments} className="text-sm text-pink-400 hover:text-pink-300">
              View all →
            </Link>
          </div>
          {upcomingEvents.length > 0 ? (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="glass-card rounded-xl p-4">
                  <p className="font-medium text-white">{event.title}</p>
                  <p className="mt-1 text-xs text-white/50">{formatDateEuropean(event.start_datetime)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/45">No upcoming events</p>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: typeof Wallet;
  title: string;
  subtitle: string;
}) {
  return (
    <Link href={href} className="glass-card group p-5 transition-all duration-300 hover:border-pink-400/30">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/20">
          <Icon className="h-6 w-6 text-pink-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="text-sm text-white/55">{subtitle}</p>
        </div>
      </div>
    </Link>
  );
}
