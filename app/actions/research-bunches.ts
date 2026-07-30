"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import type { AuthUser } from "@/lib/auth-config";
import {
  createManagerBunch,
  addIdea,
  deleteIdea,
  submitBunch,
  setIdeaChecked,
  requestChanges,
  approveBunch,
  getBunchById,
  type IdeaPlatform,
} from "@/services/research-bunches";

type Result = { success: boolean; error?: string; message?: string };

function actorId(user: AuthUser): string {
  return user.airtableUserId ?? user.id;
}

async function requireView(): Promise<AuthUser | { error: string }> {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Unauthorized." };
  if (!(await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_VIEW))) return { error: "Forbidden." };
  return user;
}

async function requireQa(): Promise<AuthUser | { error: string }> {
  const user = await getSessionFromCookies();
  if (!user) return { error: "Unauthorized." };
  if (!(await hasPermission(user, PERMISSIONS.CONTENT_PIPELINE_QA))) return { error: "Forbidden." };
  return user;
}

function revalidate() {
  revalidatePath(ROUTES.pipeline);
  revalidatePath(ROUTES.admin.pipeline);
}

async function notifyUser(userId: string, title: string, body: string, actorId: string, entityId: string) {
  if (!userId) return;
  try {
    const [{ notify }, { NOTIFICATION_EVENT }] = await Promise.all([
      import("@/services/notification-service"),
      import("@/lib/notification-types"),
    ]);
    await notify({ user_id: userId, event_type: NOTIFICATION_EVENT.VA_TASK_ASSIGNED, title, body, entity_type: "research_bunch", entity_id: entityId, actor_user_id: actorId || undefined, priority: "normal" });
  } catch { /* best-effort */ }
}

async function notifyBunchQaHolders(bunchId: string, title: string, body: string, actorId: string) {
  try {
    const [{ notify }, { NOTIFICATION_EVENT }, { listUsersWithPermission }] = await Promise.all([
      import("@/services/notification-service"),
      import("@/lib/notification-types"),
      import("@/services/users"),
    ]);
    const holders = await listUsersWithPermission(PERMISSIONS.CONTENT_PIPELINE_QA);
    for (const h of holders) {
      await notify({ user_id: h.id, event_type: NOTIFICATION_EVENT.VA_TASK_ASSIGNED, title, body, entity_type: "research_bunch", entity_id: bunchId, actor_user_id: actorId || undefined, priority: "normal" });
    }
  } catch { /* best-effort */ }
}

// ---- Manos: starts a bunch (creator + N research + M winner + deadline) ----

export async function createBunchAction(input: {
  creator_model_id: string;
  creator_name: string;
  target_research: number;
  target_winner: number;
  deadline?: string;
  film_type?: "self_record" | "filmer";
}): Promise<Result> {
  const user = await requireQa();
  if ("error" in user) return { success: false, error: user.error };
  try {
    const { bunch, researcher } = await createManagerBunch({ ...input, created_by_name: user.fullName ?? user.email });
    if (researcher) {
      const dl = input.deadline ? ` · deadline ${input.deadline.slice(0, 10)}` : "";
      await notifyUser(researcher.user_id, "🔬 Νέο research bunch", `${input.creator_name}: ${input.target_research} ιδέες${dl}`, actorId(user), bunch.id);
    }
    revalidate();
    return { success: true, message: researcher ? `Ανατέθηκε στον ${researcher.user_name}` : "Δημιουργήθηκε (⚠️ χωρίς researcher)" };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

async function ownsBunch(user: AuthUser, bunchId: string): Promise<boolean> {
  const bunch = await getBunchById(bunchId);
  return !!bunch && bunch.researcher_user_id === actorId(user);
}

export async function addResearchIdea(input: {
  bunch_id: string;
  platform: IdeaPlatform;
  idea_text: string;
  reference_link?: string;
}): Promise<Result> {
  const user = await requireView();
  if ("error" in user) return { success: false, error: user.error };
  if (!input.idea_text.trim()) return { success: false, error: "Κενή ιδέα." };
  if (!(await ownsBunch(user, input.bunch_id))) return { success: false, error: "Δεν είναι δικό σου bunch." };
  try {
    await addIdea(input);
    revalidate();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function removeResearchIdea(ideaId: string): Promise<Result> {
  const user = await requireView();
  if ("error" in user) return { success: false, error: user.error };
  try {
    await deleteIdea(ideaId);
    revalidate();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function submitResearchBunch(bunchId: string): Promise<Result> {
  const user = await requireView();
  if ("error" in user) return { success: false, error: user.error };
  if (!(await ownsBunch(user, bunchId))) return { success: false, error: "Δεν είναι δικό σου bunch." };
  try {
    await submitBunch(bunchId);
    const bunch = await getBunchById(bunchId);
    await notifyBunchQaHolders(bunchId, "✅ Research για QA", `${bunch?.creator_name ?? ""}: ${bunch?.target_research ?? ""} ιδέες έτοιμες`, actorId(user));
    revalidate();
    return { success: true, message: "Στάλθηκε για QA." };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

// ---- QA (Manos) actions ----

export async function qaSetIdeaChecked(ideaId: string, checked: boolean): Promise<Result> {
  const user = await requireQa();
  if ("error" in user) return { success: false, error: user.error };
  try {
    await setIdeaChecked(ideaId, checked);
    revalidate();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function qaRequestChanges(bunchId: string, note?: string): Promise<Result> {
  const user = await requireQa();
  if ("error" in user) return { success: false, error: user.error };
  try {
    await requestChanges(bunchId, { user_id: actorId(user), name: user.fullName ?? user.email }, note);
    const bunch = await getBunchById(bunchId);
    if (bunch?.researcher_user_id) {
      await notifyUser(bunch.researcher_user_id, "↩️ Αλλαγές στο research", note ? `${bunch.creator_name}: ${note}` : `${bunch.creator_name}: χρειάζονται αλλαγές`, actorId(user), bunchId);
    }
    revalidate();
    return { success: true, message: "Ζητήθηκαν αλλαγές." };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function qaApproveBunch(bunchId: string): Promise<Result> {
  const user = await requireQa();
  if ("error" in user) return { success: false, error: user.error };
  try {
    const bunch = await getBunchById(bunchId);
    if (!bunch) return { success: false, error: "Bunch not found." };
    const { spawned } = await approveBunch(bunch, {
      user_id: actorId(user),
      name: user.fullName ?? user.email,
    });
    revalidate();
    return { success: true, message: `Εγκρίθηκε — ${spawned} ιδέες → Creative.` };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
