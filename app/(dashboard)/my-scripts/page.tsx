import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

/** @deprecated My Scripts absorbed into Scripts to Write (History + rejected resubmit). */
export default function MyScriptsRedirectPage() {
  redirect(ROUTES.creativeScripts);
}
