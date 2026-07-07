import type { ModelRecord, UserRecord } from "@/types";

/** True when modelss.status is active — for new-work assignment pickers. */
export function isModelActiveForAssignment(model: Pick<ModelRecord, "status">): boolean {
  return (model.status ?? "").trim().toLowerCase() === "active";
}

export function filterActiveModelsForAssignment(modelss: ModelRecord[]): ModelRecord[] {
  return modelss.filter(isModelActiveForAssignment);
}

/** True when user is active and can log in — for new-work assignment pickers. */
export function isUserActiveForAssignment(user: Pick<UserRecord, "status" | "can_login">): boolean {
  if (user.can_login === false) return false;
  return (user.status ?? "").trim().toLowerCase() === "active";
}

/** Active, login-enabled users only (excludes inactive and suspended). */
export function filterActiveUsersForAssignment(users: UserRecord[]): UserRecord[] {
  return users.filter(isUserActiveForAssignment);
}
