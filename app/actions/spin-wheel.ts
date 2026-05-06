"use server";

import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { createRecord, getRecord, updateRecord } from "@/lib/airtable-server";
import { awardPoints, consumeOneSpin, refundOneSpin } from "@/services/points-engine";
import { computeSpinRotationDelta, getActiveSpinPrizes, pickWeightedPrizeIndex } from "@/services/spin-wheel";

const SPINS_TABLE = "spin_wheel_spins";
const PRIZES_TABLE = "spin_wheel_prizes";

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
  if (!user || user.role !== "chatter") {
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

  const claimed = prize.prize_type !== "cash" && prize.prize_type !== "extra_break";

  let spinRec: { id: string };
  try {
    spinRec = await createRecord(SPINS_TABLE, {
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

  let pointsAwardedFromSpin = false;
  try {
    if (prize.prize_type === "points") {
      const pts = Math.max(0, Math.floor(Number.parseFloat(prize.prize_value) || 0));
      if (pts > 0) {
        pointsAwardedFromSpin = true;
        await awardPoints(userId, pts, `Spin wheel: ${prize.label}`, "spin", spinRec.id);
      }
    }
  } catch (e) {
    console.error("[spin-wheel] awardPoints failed", e);
  }

  if (!pointsAwardedFromSpin) {
    try {
      const [{ notify }, { NOTIFICATION_EVENT, NOTIFICATION_PRIORITY }] = await Promise.all([
        import("@/services/notification-service"),
        import("@/lib/notification-types"),
      ]);
      await notify({
        user_id: userId,
        event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
        priority: NOTIFICATION_PRIORITY.NORMAL,
        title: "🎰 Spin complete",
        body: `You won: ${prize.label}`,
        entity_type: "spin_wheel_spin",
        entity_id: spinRec.id,
        _triggerSource: "spinWheelAction",
      }).catch(() => {});
    } catch {
      /* non-blocking */
    }
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
  if (!user || (user.role !== "admin" && user.role !== "manager")) {
    return { success: false, error: "Unauthorized" };
  }
  if (!spinId.trim()) return { success: false, error: "Missing spin id." };
  try {
    const spinRec = await getRecord<{
      prize_id?: string;
      claimed?: boolean;
      user_id?: string;
      prize_label?: string;
    }>(SPINS_TABLE, spinId);
    if (spinRec.fields?.claimed) {
      return { success: false, error: "Already marked as claimed." };
    }
    const prizeId = String(spinRec.fields?.prize_id ?? "").trim();
    if (!prizeId) return { success: false, error: "Spin has no prize linked." };
    const prizeRec = await getRecord<{ prize_type?: string }>(PRIZES_TABLE, prizeId);
    const pt = String(prizeRec.fields?.prize_type ?? "").toLowerCase();
    if (pt !== "cash" && pt !== "extra_break") {
      return { success: false, error: "Only cash and extra break spins can be marked claimed here." };
    }
    const chatterId = String(spinRec.fields?.user_id ?? "").trim();
    const prizeLabel = String(spinRec.fields?.prize_label ?? "prize").trim() || "prize";
    const paidIso = new Date().toISOString();
    const claimNote = `Marked paid ${paidIso}`;
    await updateRecord(SPINS_TABLE, spinId, { claimed: true, claim_note: claimNote });
    revalidatePath(ROUTES.admin.spinResults);
    revalidatePath(ROUTES.chatter.rewards);

    if (chatterId) {
      try {
        const [{ notify }, { NOTIFICATION_EVENT }] = await Promise.all([
          import("@/services/notification-service"),
          import("@/lib/notification-types"),
        ]);
        await notify({
          user_id: chatterId,
          event_type: NOTIFICATION_EVENT.SYSTEM_ALERT,
          title: "💰 Prize claimed!",
          body: `Your ${prizeLabel} has been processed!`,
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
