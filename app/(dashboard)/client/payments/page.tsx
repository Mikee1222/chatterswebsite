import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export default function ClientPaymentsRedirectPage() {
  redirect(ROUTES.client.payChatting);
}
