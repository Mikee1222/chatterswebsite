"use client";

import * as React from "react";
import type { SessionUser } from "@/types";

/**
 * Legacy FAB slot for roles without a dedicated quick-actions FAB.
 * Chatter, admin/manager, model, and VA each use their own floating quick-actions component.
 */
export function MobileFab({ user: _user }: { user: SessionUser }) {
  void _user;
  return null;
}
