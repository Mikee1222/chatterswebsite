import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getActiveShifts } from "@/services/shifts";
import { getTaskTypesForVirtualAssistant } from "@/services/staff-task-types";
import { TaskShiftsPanel } from "@/components/task-shifts-panel";

export default async function TaskShiftsPage() {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  const activeTaskShifts = await getActiveShifts("virtual_assistant").catch(() => []);
  const taskTypes = await getTaskTypesForVirtualAssistant().catch(() => []);

  const myShift = user.airtableUserId ? activeTaskShifts.find((s) => s.chatter_id === user.airtableUserId) ?? null : null;
  const shiftsToShow = user.role === "admin" ? activeTaskShifts : myShift ? [myShift] : [];

  return (
    <div className="space-y-6">
      <TaskShiftsPanel
        userRole={user.role}
        shifts={shiftsToShow}
        myShift={myShift}
        taskTypes={taskTypes}
      />
    </div>
  );
}
