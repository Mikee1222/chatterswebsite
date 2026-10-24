import { redirect } from "next/navigation";
import Link from "next/link";
import { UserCheck, ChevronRight } from "lucide-react";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { listPersonasSummary } from "@/services/model-personas";
import { listLinkedModelIdsForUser } from "@/services/model-user-profiles";
import { listActiveGunzoTeamModelss } from "@/services/modelss";
import { VA_CARD, VA_TASKS } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

export default async function PersonasPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const canView = await hasPermission(user, PERMISSIONS.PERSONAS_VIEW);
  const canManage = await hasPermission(user, PERMISSIONS.PERSONAS_MANAGE);
  const canEditOwn = await hasPermission(user, PERMISSIONS.PERSONAS_EDIT_OWN);
  if (!canView && !canManage && !canEditOwn) redirect(ROUTES.dashboard);

  const [summaries, models] = await Promise.all([
    listPersonasSummary().catch(() => []),
    listActiveGunzoTeamModelss().catch(() => []),
  ]);

  let allowed: Set<string> | null = null;
  if (!canView && !canManage && canEditOwn) {
    const linked = await listLinkedModelIdsForUser(user.airtableUserId ?? user.id);
    allowed = new Set(linked.modelIds);
  }

  const summaryByModel = new Map(summaries.map((s) => [s.model_id, s]));
  const rows = models
    .filter((m) => !allowed || allowed.has(m.id))
    .map((m) => {
      const s = summaryByModel.get(m.id);
      return {
        model_id: m.id,
        model_name: m.model_name,
        updated_at: s?.updated_at ?? null,
        last_updated_by_name: s?.last_updated_by_name ?? null,
        has_birth_date: s?.has_birth_date ?? false,
      };
    })
    .sort((a, b) => a.model_name.localeCompare(b.model_name));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-[#D4AF8C]">
          <UserCheck className="h-5 w-5" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Creators</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Model Personas
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed" style={{ color: VA_TASKS.bodyText }}>
          Structured profiles that ground chatting voice and AI Creative Studio. Edit each linked
          model separately.
        </p>
      </header>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.model_id}>
            <Link
              href={ROUTES.persona(row.model_id)}
              className={cn(
                VA_CARD,
                "flex items-center justify-between gap-3 px-4 py-3.5 text-left",
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{row.model_name}</p>
                <p className="mt-0.5 text-xs" style={{ color: VA_TASKS.bodyMuted }}>
                  {row.updated_at
                    ? `Last updated ${formatRelative(row.updated_at)}${
                        row.last_updated_by_name ? ` by ${row.last_updated_by_name}` : ""
                      }`
                    : "No persona yet — tap to create"}
                  {!row.has_birth_date ? " · Birth date needed for AI" : ""}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/35" aria-hidden />
            </Link>
          </li>
        ))}
        {rows.length === 0 && (
          <li
            className={cn(VA_CARD, "px-4 py-8 text-center text-sm")}
            style={{ color: VA_TASKS.bodyMuted }}
          >
            No models available for your permissions.
          </li>
        )}
      </ul>
    </div>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return new Date(iso).toLocaleString();
}
