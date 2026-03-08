import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getActiveShifts } from "@/services/shifts";
import { getFreeModelss } from "@/services/modelss";
import { getActiveShiftModels } from "@/services/shifts";
import { ActiveShiftsPanel } from "@/components/active-shifts-panel";

export default async function ActiveShiftsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const activeChatterShifts = await getActiveShifts("chatter").catch(() => []);

  let myShift = null;
  let myActiveModelss: Awaited<ReturnType<typeof getActiveShiftModels>> = [];
  if (user.role === "chatter" || user.role === "admin") {
    myShift = user.airtableUserId ? activeChatterShifts.find((s) => s.chatter_id === user.airtableUserId) ?? null : null;
    if (myShift) {
      myActiveModelss = await getActiveShiftModels(myShift.id).catch(() => []);
    }
  }

  const shiftsToShow = user.role === "admin" ? activeChatterShifts : myShift ? [myShift] : [];
  const freeModelss = await getFreeModelss().catch(() => []);

  return (
    <div className="space-y-6">
      <ActiveShiftsPanel
        userRole={user.role}
        shifts={shiftsToShow}
        myShift={myShift}
        myActiveModelss={myActiveModelss}
        freeModelss={freeModelss}
      />
    </div>
  );
}
