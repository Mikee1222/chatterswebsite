import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export default function AdminTaskTimerConfigPage() {
  redirect(`${ROUTES.admin.taskTemplates}?tab=timer-config`);
}
