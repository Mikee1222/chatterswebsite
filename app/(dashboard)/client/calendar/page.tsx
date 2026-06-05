import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export default function ClientCalendarRedirectPage() {
  redirect(ROUTES.client.weeklyPayments);
}
