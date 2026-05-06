import { revalidatePath } from "next/cache";
import { ROUTES } from "@/lib/routes";

/** Admin customs list, VA customs queue, chatter request page, model customs. */
export function revalidateCustomRequestSurfaces(): void {
  revalidatePath(ROUTES.admin.customRequests);
  revalidatePath(ROUTES.admin.customs);
  revalidatePath(ROUTES.chatter.requestCustom);
  revalidatePath(ROUTES.model.customs);
  revalidatePath(ROUTES.va.customRequests);
}
