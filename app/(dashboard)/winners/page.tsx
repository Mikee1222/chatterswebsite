import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

/** Legacy Research submit — consolidated into Fill Bunches. */
export default function WinnersSubmitRedirectPage() {
  redirect(ROUTES.winnerRecreates);
}
