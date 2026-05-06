import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

/** Legacy `/model/customs` URL — redirects to the canonical custom workflow (`ROUTES.model.customs` → `/model/custom-requests`). */
export default function ModelCustomsLegacyRedirectPage() {
  redirect(ROUTES.model.customs);
}
