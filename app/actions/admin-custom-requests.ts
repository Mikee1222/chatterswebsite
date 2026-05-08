"use server";

import { z } from "zod";
import { getSessionFromCookies } from "@/lib/auth";
import { revalidateCustomRequestSurfaces } from "@/lib/revalidate-custom-request-paths";
import {
  agencyApproveCustomRequest,
  agencyDeclineCustomRequest,
  agencyEditCustomRequest,
} from "@/services/custom-request-agency-queue";
import { listCustomRequestsPaginated } from "@/services/custom-requests";

function assertAdminOrManager() {
  return getSessionFromCookies().then((u) => {
    if (!u || (u.role !== "admin" && u.role !== "manager")) {
      throw new Error("Unauthorized");
    }
    return u;
  });
}

const idSchema = z.string().trim().min(1);

const declineSchema = z.object({
  recordId: idSchema,
  /** Shown to chatter; persisted to `custom_requests.decline_reason`. Airtable `admin_status` = **rejected** (not "declined"). */
  decline_reason: z.string().trim().min(1, "Reason is required").max(4000),
});

const editSchema = z.object({
  recordId: idSchema,
  request_details: z.string().trim().max(20000).optional(),
  price: z.string().trim().max(500).optional(),
  deadline_requested: z.string().trim().max(80).nullable().optional(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

export type LoadMoreCustomRequestsResult =
  | { ok: true; records: import("@/types").CustomRequest[]; nextOffset: string | null; hasMore: boolean }
  | { ok: false; error: string };

export async function adminLoadMoreCustomRequests(offset: string): Promise<LoadMoreCustomRequestsResult> {
  try {
    await assertAdminOrManager();
    const o = offset?.trim();
    if (!o) return { ok: false, error: "Invalid cursor." };
    const batch = await listCustomRequestsPaginated({}, 1, 50, o);
    return {
      ok: true,
      records: batch.records,
      nextOffset: batch.nextOffset,
      hasMore: batch.hasMore,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return { ok: false, error: msg };
    return { ok: false, error: msg || "Load failed." };
  }
}

/**
 * Approve: Airtable `admin_status` is **accepted** (not "approved"). Notifies the linked model user.
 */
export async function adminApproveCustomRequest(recordId: string): Promise<ActionResult> {
  try {
    await assertAdminOrManager();
    const id = idSchema.safeParse(recordId);
    if (!id.success) return { ok: false, error: "Invalid record id." };
    const res = await agencyApproveCustomRequest(id.data);
    if (!res.ok) return res;
    revalidateCustomRequestSurfaces();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return { ok: false, error: msg };
    return { ok: false, error: msg || "Approve failed." };
  }
}

/** Decline: `admin_status` = **rejected** + `decline_reason`; notifies chatter. */
export async function adminDeclineCustomRequest(input: z.infer<typeof declineSchema>): Promise<ActionResult> {
  const parsed = declineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };
  }
  try {
    await assertAdminOrManager();
    const res = await agencyDeclineCustomRequest(parsed.data.recordId, parsed.data.decline_reason);
    if (!res.ok) return res;
    revalidateCustomRequestSurfaces();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return { ok: false, error: msg };
    return { ok: false, error: msg || "Decline failed." };
  }
}

/** Patch description / price / deadline; notifies chatter and model (pending, or accepted once scheduled/uploaded). */
export async function adminEditCustomRequest(input: z.infer<typeof editSchema>): Promise<ActionResult> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((x) => x.message).join(" ") };
  }
  try {
    await assertAdminOrManager();
    const res = await agencyEditCustomRequest(
      parsed.data.recordId,
      {
        request_details: parsed.data.request_details,
        price: parsed.data.price,
        deadline_requested: parsed.data.deadline_requested,
      },
      "admin"
    );
    if (!res.ok) return res;
    revalidateCustomRequestSurfaces();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return { ok: false, error: msg };
    return { ok: false, error: msg || "Update failed." };
  }
}
