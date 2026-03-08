import Link from "next/link";
import { redirect } from "next/navigation";
import { MyWhalesClient } from "@/components/my-whales-client";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getWhalesByChatter } from "@/services/whales";
import { listAllModelss } from "@/services/modelss";

export default async function MyWhalesPage() {
  const user = await getSessionFromCookies();
  if (!user || user.role !== "chatter") redirect(ROUTES.dashboard);

  const chatterId = user.airtableUserId ?? user.id;
  const [whales, modelss] = await Promise.all([
    getWhalesByChatter(chatterId).catch(() => []),
    listAllModelss().catch(() => []),
  ]);
  const modelNames: Record<string, string> = {};
  for (const m of modelss) {
    modelNames[m.id] = m.model_name ?? "";
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[my-whales page]", {
      currentUserEmail: user.email,
      internalUserId: user.id,
      airtableUserRecordId: user.airtableUserId ?? "(null)",
      chatterIdUsed: chatterId,
      whalesCount: whales.length,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">My whales</h1>
          <p className="mt-1 text-sm text-white/60">Whales assigned to you</p>
        </div>
        <Link
          href={ROUTES.chatter.myWhalesNew}
          className="rounded-xl bg-[hsl(330,80%,55%)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[hsl(330,80%,50%)]"
        >
          New whale
        </Link>
      </div>

      <MyWhalesClient whales={whales} modelNames={modelNames} />
    </div>
  );
}
