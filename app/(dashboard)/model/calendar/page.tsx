import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

/** Legacy URL — canonical content calendar lives at `ROUTES.model.contentCalendar`. */
export default function ModelCalendarRedirectPage() {
  redirect(ROUTES.model.contentCalendar);
}
