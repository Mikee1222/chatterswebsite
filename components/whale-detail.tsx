import { transactionTypeLabel } from "@/lib/airtable-options";
import { formatDateEuropean, formatDateTimeEuropean, displayName } from "@/lib/format";
import type { Whale } from "@/types";

export function WhaleDetail({
  whale,
  activity,
  transactions,
  userRole,
}: {
  whale: Whale;
  activity: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  userRole: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass-card space-y-4 p-6">
        <h2 className="text-lg font-semibold text-white">Profile</h2>
        <dl className="grid gap-3 text-sm">
          <Row label="Username" value={whale.username} />
          <Row label="Platform" value={whale.platform} />
          <Row label="Assigned chatter" value={displayName(whale.assigned_chatter_name)} />
          <Row label="Relationship" value={whale.relationship_status} />
          <Row label="Active hours" value={whale.hours_active?.length ? whale.hours_active.join(", ") : (whale.active_hours_start || whale.active_hours_end ? `${whale.active_hours_start || "—"} – ${whale.active_hours_end || "—"}` : "—")} />
          <Row label="Timezone" value={whale.timezone} />
          <Row label="Spend level" value={whale.spend_level} />
          <Row label="Total spent" value={`$${whale.total_spent.toLocaleString()}`} />
          <Row label="Last spent" value={whale.last_spent_amount ? `$${whale.last_spent_amount}` : "—"} />
          <Row label="Last contact" value={whale.last_contact_date ? formatDateEuropean(whale.last_contact_date) : "—"} />
          <Row label="Next followup" value={whale.next_followup ? formatDateEuropean(whale.next_followup) : "—"} />
          <Row label="Status" value={whale.status} />
          <Row label="Last updated by" value={whale.last_updated_by || "—"} />
        </dl>
        {(whale.preferences || whale.red_flags || whale.retention_risk) && (
          <div className="space-y-2 pt-2">
            {whale.preferences && (
              <p className="text-sm text-white/70"><span className="text-white/50">Preferences:</span> {whale.preferences}</p>
            )}
            {whale.red_flags && (
              <p className="text-sm text-white/70"><span className="text-white/50">Red flags:</span> {whale.red_flags}</p>
            )}
            {whale.retention_risk && (
              <p className="text-sm text-white/70"><span className="text-white/50">Retention risk:</span> {whale.retention_risk}</p>
            )}
          </div>
        )}
        <div className="pt-2">
          <p className="text-xs text-white/50">Notes</p>
          <p className="mt-1 text-sm text-white/80">{whale.notes || "—"}</p>
        </div>
      </div>
      <div className="space-y-6">
        <div className="glass-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Activity</h2>
          <ul className="space-y-2">
            {activity.length === 0 ? (
              <li className="text-sm text-white/50">No activity</li>
            ) : (
              activity.map((a) => (
                <li key={a.id as string} className="rounded-lg bg-white/5 px-3 py-2 text-sm">
                  <span className="text-white/80">{String(a.summary ?? a.action_type ?? "—")}</span>
                  <span className="ml-2 text-xs text-white/40">{a.created_at ? formatDateTimeEuropean(a.created_at as string) : ""}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="glass-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Transactions</h2>
          <ul className="space-y-2">
            {transactions.length === 0 ? (
              <li className="text-sm text-white/50">No transactions</li>
            ) : (
              transactions.map((t) => (
                <li key={t.id as string} className="flex justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                  <span className="text-white/80">{formatDateEuropean(t.date as string)} — {transactionTypeLabel(String(t.type ?? ""))}</span>
                  <span className="text-white/80">${Number(t.amount ?? 0).toLocaleString()}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-white/50">{label}</dt>
      <dd className="text-white/90">{value || "—"}</dd>
    </div>
  );
}
