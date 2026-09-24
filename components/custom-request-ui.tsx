"use client";

/**
 * Shared status visuals for Custom Requests (chatter/VA submit, admin, model).
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";
import { formatDateEuropean } from "@/lib/format";
import {
  CUSTOM_REQUEST_STATUS_CLASS,
  customRequestStatusLabel,
  getCustomRequestDisplayStatus,
  type CustomRequestDisplayStatus,
  type CustomRequestLang,
} from "@/lib/custom-request-status";
import type { CustomRequest } from "@/types";

export {
  CUSTOM_REQUEST_STATUS_ORDER,
  countCustomRequestsByDisplayStatus,
  countCustomRequestsThisWeek,
  customRequestCanMarkDelivered,
  customRequestIsPending,
  customRequestStatusLabel,
  customRequestTypeBadgeClass,
  customRequestTypeLabel,
  displayCustomRequestDescription,
  displayCustomRequestTitle,
  getCustomRequestDisplayStatus,
  resolveCustomRequestType,
  type CustomRequestDisplayStatus,
  type CustomRequestLang,
} from "@/lib/custom-request-status";

export function CustomRequestStatusBadge({
  request,
  status,
  lang = "en",
  className,
}: {
  request?: CustomRequest;
  status?: CustomRequestDisplayStatus;
  lang?: CustomRequestLang;
  className?: string;
}) {
  const resolved = status ?? (request ? getCustomRequestDisplayStatus(request) : "pending");
  return (
    <span className={cn(VA_STATUS_BADGE, CUSTOM_REQUEST_STATUS_CLASS[resolved], className)}>
      {customRequestStatusLabel(resolved, lang)}
    </span>
  );
}

export function displayCustomRequestDeadline(req: CustomRequest): string {
  const raw = (req.deadline_requested ?? "").trim();
  if (raw) return formatDateEuropean(raw);
  return "—";
}

export function displayCustomRequestPrice(req: CustomRequest): string {
  const raw = (req.price ?? "").trim();
  if (!raw) return "—";
  return raw.startsWith("$") ? raw : `$${raw}`;
}
