"use client";

import type { ClientPartnershipInflowwStats } from "@/services/client-partnership-infloww";
import { ClientGunzoPartnershipInflowwSection } from "@/components/client-portal/gunzo-partnership-infloww-section";

type Props = {
  inflowwStats: ClientPartnershipInflowwStats;
  clientName?: string;
};

export function ClientGunzoPartnershipView({ inflowwStats, clientName }: Props) {
  return (
    <ClientGunzoPartnershipInflowwSection
      initial={inflowwStats}
      accountLabel={clientName ?? inflowwStats.modelNames[0]}
    />
  );
}
