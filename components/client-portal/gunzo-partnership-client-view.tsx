"use client";

import type { ClientPartnershipInflowwStats } from "@/services/client-partnership-infloww";
import { ClientGunzoPartnershipInflowwSection } from "@/components/client-portal/gunzo-partnership-infloww-section";
import { ClientMonthlyAiReportCard } from "@/components/client-monthly-ai-report-card";

type Props = {
  inflowwStats: ClientPartnershipInflowwStats;
  clientName?: string;
};

export function ClientGunzoPartnershipView({ inflowwStats, clientName }: Props) {
  return (
    <>
      <ClientMonthlyAiReportCard />
      <ClientGunzoPartnershipInflowwSection
        initial={inflowwStats}
        accountLabel={clientName ?? inflowwStats.modelNames[0]}
      />
    </>
  );
}
