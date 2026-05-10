"use client";

/**
 * Read-only whales UI for VAs. Overlays (history sheet, etc.) are implemented in
 * `admin-whales-client.tsx` (`AdminWhalesClient` with `readOnly` + `headerVariant="va"`).
 */

import {
  AdminWhalesClient,
  type AdminWhalesInitialFilters,
  type WhaleStatusCounts,
} from "@/components/admin-whales-client";
import type { Whale } from "@/types";

type Chatter = { id: string; full_name: string };
type ModelOption = { id: string; name: string };

export type VAWhalesClientProps = {
  whales: Whale[];
  nextOffset: string | null;
  pageSize: number;
  statusCounts: WhaleStatusCounts;
  chatters: Chatter[];
  modelOptions: ModelOption[];
  revenueByModel: [string, number][];
  revenueByChatter: [string, number][];
  initialFilters: AdminWhalesInitialFilters;
};

/** VA read-only whales UI — same filters, cards, and history sheet as admin without mutations. */
export function VAWhalesClient(props: VAWhalesClientProps) {
  return <AdminWhalesClient {...props} readOnly headerVariant="va" />;
}
