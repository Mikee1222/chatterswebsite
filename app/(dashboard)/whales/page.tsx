import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { listAllWhales } from "@/services/whales";
import { WhalesTable } from "@/components/whales-table";
import { Input, btnSecondaryClass } from "@/components/ui/form";

export default async function WhalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; chatter?: string; status?: string; page?: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const params = await searchParams;
  const whales = await listAllWhales().catch(() => []);

  let filtered = whales;
  if (user.role === "chatter" && user.airtableUserId) {
    filtered = whales.filter((w) => w.assigned_chatter_id === user.airtableUserId);
  }
  if (params.q) {
    const q = params.q.toLowerCase();
    filtered = filtered.filter(
      (w) =>
        w.username.toLowerCase().includes(q) ||
        w.assigned_chatter_name.toLowerCase().includes(q)
    );
  }
  if (params.chatter) {
    filtered = filtered.filter((w) => w.assigned_chatter_id === params.chatter);
  }
  if (params.status) {
    filtered = filtered.filter((w) => w.status === params.status);
  }

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize = 20;
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const pageWhales = filtered.slice(start, start + pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            name="q"
            defaultValue={params.q}
            placeholder="Search whales..."
            className="min-w-[200px]"
          />
          <button type="submit" className={btnSecondaryClass}>Search</button>
        </form>
      </div>
      <div className="glass-card overflow-hidden">
        <WhalesTable whales={pageWhales} total={total} page={page} pageSize={pageSize} />
      </div>
    </div>
  );
}
