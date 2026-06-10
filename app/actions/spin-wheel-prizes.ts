"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/lib/routes";
import {
  createRecord,
  deleteRecord,
  updateRecord,
  invalidateListRecordsReadCacheForTable,
} from "@/lib/airtable-server";
import { SPIN_PRIZE_UI_TYPES, defaultHexForSpinPrizeUi, spinPrizeUiToDb, type SpinPrizeUiType } from "@/lib/spin-wheel-prize-types";

const TABLE = "spin_wheel_prizes";

const prizeRowSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().optional(),
  label: z.string().trim().min(1, "Each prize needs a label."),
  prizeTypeUi: z.enum(SPIN_PRIZE_UI_TYPES),
  prize_value: z.string(),
  probability: z.number().int().min(0).max(1_000_000),
  active: z.boolean(),
  color: z.string(),
  sort_order: z.number().int().min(0).max(10_000),
});

const saveSchema = z.object({
  prizes: z.array(prizeRowSchema).min(0),
  deletedIds: z.array(z.string()),
});

function validateValueForType(ui: SpinPrizeUiType, prizeValue: string, label: string): string | null {
  const v = prizeValue.trim();
  switch (ui) {
    case "points": {
      const n = Number.parseInt(v, 10);
      if (!Number.isFinite(n) || n <= 0) return "Points prizes need a positive whole number in the amount field.";
      return null;
    }
    case "bonus": {
      const n = Number.parseFloat(v.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) return "Bonus prizes need a positive euro amount.";
      return null;
    }
    case "break": {
      const n = Number.parseInt(v, 10);
      if (!Number.isFinite(n) || n <= 0) return "Break prizes need a positive number of minutes.";
      return null;
    }
    case "double_points":
      return null;
    case "custom":
      if (!label.trim()) return "Custom prizes need a label (the prize text).";
      return null;
    default:
      return null;
  }
}

function buildAirtableFields(
  ui: SpinPrizeUiType,
  label: string,
  prizeValue: string,
  probability: number,
  active: boolean,
  color: string,
  sortOrder: number,
): Record<string, unknown> {
  const dbType = spinPrizeUiToDb(ui);
  let value = prizeValue.trim();
  if (ui === "double_points" && !value) value = "next_shift";
  if (ui === "custom" && !value) value = label.trim();
  return {
    label: label.trim(),
    prize_type: dbType,
    prize_value: value,
    probability,
    active,
    color: color.trim() || defaultHexForSpinPrizeUi(ui),
    sort_order: sortOrder,
  };
}

export type SaveSpinWheelPrizesResult =
  | { success: true; warnings: string[] }
  | { success: false; error: string };

export async function saveSpinWheelPrizesAction(raw: unknown): Promise<SaveSpinWheelPrizesResult> {
  const user = await getSessionFromCookies();
  if (!user || !(await hasPermission(user, PERMISSIONS.SPIN_WHEEL_MANAGE))) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid payload" };
  }

  const { prizes, deletedIds } = parsed.data;
  const warnings: string[] = [];

  for (const row of prizes) {
    const err = validateValueForType(row.prizeTypeUi, row.prize_value, row.label);
    if (err) return { success: false, error: err };
  }

  const totalWeight = prizes.reduce((s, p) => s + Math.max(0, p.probability), 0);
  if (totalWeight <= 0 && prizes.length > 0) {
    warnings.push("Total prize weight is 0 — the wheel will fall back to random segments.");
  } else if (totalWeight < 100 && prizes.length > 0) {
    warnings.push(`Total weight is ${totalWeight} (often admins use thousands). Double-check that this matches what you want.`);
  } else if (totalWeight > 0 && prizes.length > 0) {
    const maxW = Math.max(...prizes.map((p) => p.probability));
    if (maxW / totalWeight > 0.65) {
      warnings.push("One prize dominates most of the wheel (over ~65% effective chance). Consider rebalancing.");
    }
  }

  try {
    for (const id of deletedIds) {
      const rid = id?.trim();
      if (!rid || rid.startsWith("new-")) continue;
      await deleteRecord(TABLE, rid);
    }

    for (const row of prizes) {
      const fields = buildAirtableFields(
        row.prizeTypeUi,
        row.label,
        row.prize_value,
        row.probability,
        row.active,
        row.color,
        row.sort_order,
      );
      const existingId = row.id?.trim();
      if (existingId && !existingId.startsWith("new-")) {
        try {
          await updateRecord(TABLE, existingId, fields);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/sort_order|UNKNOWN_FIELD_NAME/i.test(msg)) {
            const { sort_order: _s, ...rest } = fields;
            await updateRecord(TABLE, existingId, rest);
            warnings.push(
              "Some rows were saved without `sort_order` (add a number field `sort_order` in Airtable to persist wheel order).",
            );
          } else {
            throw e;
          }
        }
      } else {
        try {
          await createRecord(TABLE, fields);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/sort_order|UNKNOWN_FIELD_NAME/i.test(msg)) {
            const { sort_order: _s, ...rest } = fields;
            await createRecord(TABLE, rest);
            warnings.push(
              "New prizes were created without `sort_order` (add a number field `sort_order` in Airtable to persist wheel order).",
            );
          } else {
            throw e;
          }
        }
      }
    }

    invalidateListRecordsReadCacheForTable(TABLE);
    revalidatePath(ROUTES.admin.rewardsConfig);
    revalidatePath(ROUTES.chatter.rewards);
    revalidatePath(ROUTES.admin.rewards);
    return { success: true, warnings: [...new Set(warnings)] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
