"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import { awardPoints, consumeOneSpin, refundOneSpin } from "@/services/points-engine";
import {
  computeSpinRotationDelta,
  createSpinRecord,
  getActiveSpinPrizes,
  getPrizeById,
  getSpinById,
  markSpinClaimed,
  pickWeightedPrizeIndex,
} from "@/services/spin-wheel";

export type SpinWheelPrizeResult = {
  id: string;
  label: string;
  prize_type: string;
  prize_value: string;
  color: string;
};

export async function spinWheelAction(): Promise<
  | { success: true; prize: SpinWheelPrizeResult; rotationDelta: number; newSpinsAvailable: number }
  | { success: false; error: string }
> {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "chatter") {
    return { success: false, error: "Unauthorized" };
  }
  const userId = user.airtableUserId ?? user.id;

  const prizes = await getActiveSpinPrizes();
  if (prizes.length === 0) {
    return { success: false, error: "No prizes configured yet." };
  }

  const consumed = await consumeOneSpin(userId);
  if (!consumed.ok) {
    return { success: false, error: consumed.error === "No spins available." ? "No spins left." : consumed.error };
  }

  const winIndex = pickWeightedPrizeIndex(prizes);
  const prize = prizes[winIndex];
  const rotationDelta = computeSpinRotationDelta(winIndex, prizes.length);

  const pt = prize.prize_type.trim().toLowerCase();
  const needsManualFulfillment =
    pt === "cash" ||
    pt === "extra_break" ||
    pt === "custom" ||
    pt === "mystery" ||
    pt === "bonus" ||
    pt === "break";
  const claimed = !needsManualFulfillment;

  let spinRec: { id: string };
  try {
    spinRec = await createSpinRecord({
      user_id: userId,
      prize_id: prize.id,
      prize_label: prize.label,
      created_at: new Date().toISOString(),
      claimed,
    });
  } catch (e) {
    await refundOneSpin(userId);
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }

  try {
    if (pt === "points") {
      const pts = Math.max(0, Math.floor(Number.parseFloat(prize.prize_value) || 0));
      if (pts > 0) {
        await awardPoints(userId, pts, `Spin wheel: ${prize.label}`, "spin", spinRec.id);
      }
    }
  } catch (e) {
    console.error("[spin-wheel] awardPoints failed", e);
  }

  const chatterName = (user.fullName?.trim() || user.email?.trim() || "Chatter").slice(0, 120);
  const prizeDetails = prize.prize_value?.trim() || prize.prize_type?.trim() || "";

  try {
    const [{ notifyByRoleConfig }, { NOTIFICATION_EVENT }, { spinResultSelf }] = await Promise.all([
      import("@/services/notification-service"),
      import("@/lib/notification-types"),
      import("@/lib/notification-copy"),
    ]);
    const copy = spinResultSelf(prize.label, prizeDetails);
    await notifyByRoleConfig(NOTIFICATION_EVENT.SPIN_RESULT, {
      personal_user_id: userId,
      actor_user_id: userId,
      actor_name: chatterName,
      title: copy.title,
      body: copy.body,
      entity_type: "spin_wheel_spin",
      entity_id: spinRec.id,
      context: { prizeName: prize.label, prizeDetails, chatterName },
    }).catch((e) => {
      console.error("[spin-wheel] spin_result notify failed", e);
    });
  } catch (e) {
    console.error("[spin-wheel] spin_result notify failed", e);
  }

  revalidatePath(ROUTES.chatter.rewards);
  revalidatePath(ROUTES.admin.spinResults);

  return {
    success: true,
    prize: {
      id: prize.id,
      label: prize.label,
      prize_type: prize.prize_type,
      prize_value: prize.prize_value,
      color: prize.color,
    },
    rotationDelta,
    newSpinsAvailable: consumed.remaining,
  };
}

export async function markSpinClaimedAction(
  spinId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.SPIN_WHEEL_MANAGE))) {
    return { success: false, error: "Unauthorized" };
  }
  if (!spinId.trim()) return { success: false, error: "Missing spin id." };
  try {
    const spinRec = await getSpinById(spinId);
    if (!spinRec) return { success: false, error: "Spin not found." };
    if (spinRec.claimed) {
      return { success: false, error: "Already marked as claimed." };
    }
    const prizeId = spinRec.prize_id.trim();
    if (!prizeId) return { success: false, error: "Spin has no prize linked." };
    const prizeRec = await getPrizeById(prizeId);
    if (!prizeRec) return { success: false, error: "Prize not found." };
    const pt = prizeRec.prize_type.toLowerCase();
    const markableTypes = new Set(["cash", "extra_break", "custom", "mystery", "bonus", "break"]);
    if (!markableTypes.has(pt)) {
      return {
        success: false,
        error: "Only manual-fulfillment prizes (bonus, break, custom, etc.) can be marked claimed here.",
      };
    }
    const chatterId = spinRec.user_id.trim();
    const prizeLabel = spinRec.prize_label.trim() || "prize";
    const paidIso = new Date().toISOString();
    const claimNote = `Marked paid ${paidIso}`;
    await markSpinClaimed(spinId, claimNote);

    if (chatterId && pt === "cash") {
      try {
        const { createSpinWheelCashBonus } = await import("@/services/fines-bonuses");
        const { getUserByAirtableId } = await import("@/services/users");

        const chatterUser = await getUserByAirtableId(chatterId).catch(() => null);
        const chatterName = chatterUser?.full_name?.trim() || chatterId;
        const prizeAmount = Math.max(0, parseFloat(String(prizeRec.prize_value ?? "0")) || 0);

        await createSpinWheelCashBonus({
          spinId,
          spinCreatedAt: spinRec.created_at.trim() || undefined,
          user_id: chatterId,
          user_name: chatterName,
          prize_label: prizeLabel,
          amount: prizeAmount,
          admin_id: user.airtableUserId ?? user.id,
          admin_name: user.fullName?.trim() || user.email?.trim() || "Admin",
        });
      } catch (e) {
        console.error("[spin-wheel] auto-create bonus failed", e);
      }
    }

    revalidatePath(ROUTES.admin.spinResults);
    revalidatePath(ROUTES.chatter.rewards);
    revalidatePath(ROUTES.finesBonuses);
    revalidatePath(ROUTES.admin.finesBonuses);

    if (chatterId) {
      try {
        const [{ notify }, { NOTIFICATION_EVENT }] = await Promise.all([
          import("@/services/notification-service"),
          import("@/lib/notification-types"),
        ]);
        await notify({
          user_id: chatterId,
          event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
          title: "🎁 Prize claimed!",
          body: `🎁 Your ${prizeLabel} has been processed!`,
          entity_type: "spin_wheel_spin",
          entity_id: spinId,
          _triggerSource: "markSpinClaimedAction",
        });
      } catch (e) {
        console.error("[spin-wheel] notify prize claimed failed", e);
      }
    }
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
