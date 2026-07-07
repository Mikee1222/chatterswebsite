import type { ModelRecord, UserRecord } from "@/types";

/**
 * Available for new-work assignment pickers unless the model is explicitly inactive.
 *
 * `modelss.status` is a two-choice single-select ("active" / "inactive"). We exclude
 * only genuinely inactive models and treat blank/unknown status as active — the same
 * "exclude inactive" semantics the Models admin view and `listActiveUsers` used before
 * the assignment-filter refactor. The previous allowlist (`=== "active"`) wrongly hid
 * every model whose status wasn't the exact string "active", which emptied the
 * Rebill/Tip and other assignment dropdowns for any model with a missing status.
 */
export function isModelActiveForAssignment(model: Pick<ModelRecord, "status">): boolean {
  return (model.status ?? "").trim().toLowerCase() !== "inactive";
}

export function filterActiveModelsForAssignment(modelss: ModelRecord[]): ModelRecord[] {
  return modelss.filter(isModelActiveForAssignment);
}

/**
 * Login-enabled and not explicitly inactive — for new-work assignment pickers.
 *
 * Restores the original pre-refactor rule: exclude a user only when they cannot log
 * in or their status is explicitly "inactive". Blank/unknown status stays selectable
 * (the refactor's allowlist of `=== "active"` dropped every user without an exact
 * "active" status).
 */
export function isUserActiveForAssignment(user: Pick<UserRecord, "status" | "can_login">): boolean {
  if (user.can_login === false) return false;
  return (user.status ?? "").trim().toLowerCase() !== "inactive";
}

/** Active, login-enabled users only (excludes inactive and suspended). */
export function filterActiveUsersForAssignment(users: UserRecord[]): UserRecord[] {
  return users.filter(isUserActiveForAssignment);
}
