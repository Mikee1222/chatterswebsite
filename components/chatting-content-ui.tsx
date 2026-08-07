"use client";

/**
 * Shared status / filter helpers for Chatting Content + Chatting Assignments.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { VA_STATUS_BADGE } from "@/lib/va-tasks-tokens";

export function chattingStatusKey(s: string): string {
  return (s || "").trim().toLowerCase();
}

export function chattingStatusLabel(s: string): string {
  const k = chattingStatusKey(s);
  if (k === "pending_approval") return "Pending approval";
  if (!k) return "—";
  return k.replace(/_/g, " ");
}

export function chattingPriorityClass(p: string): string {
  const x = (p || "").toLowerCase();
  if (x === "urgent") return "border-rose-500/40 bg-rose-500/15 text-rose-200";
  if (x === "high") return "border-amber-500/35 bg-amber-500/12 text-amber-200";
  if (x === "low") return "border-white/15 bg-white/[0.06] text-white/65";
  return "border-[#D4AF8C]/30 bg-[#D4AF8C]/10 text-[#D4AF8C]";
}

export function ChattingStatusBadge({ status, className }: { status: string; className?: string }) {
  const k = chattingStatusKey(status);
  const label = chattingStatusLabel(status);
  const variant =
    k === "completed"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
      : k === "pending" || k === "pending_approval"
        ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
        : k === "scheduled"
          ? "border-sky-500/30 bg-sky-500/15 text-sky-300"
          : k === "rejected"
            ? "border-rose-500/35 bg-rose-500/15 text-rose-300"
            : k === "cancelled"
              ? "border-red-500/30 bg-red-500/15 text-red-300"
              : "border-white/15 bg-white/[0.06] text-white/70";

  return (
    <span className={cn(VA_STATUS_BADGE, "capitalize", variant, className)}>
      {label}
    </span>
  );
}

export function ymdFromField(value: string | null | undefined): string | null {
  if (value == null || typeof value !== "string") return null;
  const t = value.trim();
  if (t.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const d = Date.parse(t);
  if (!Number.isFinite(d)) return null;
  return new Date(d).toISOString().slice(0, 10);
}

export function dateInOrOverlapsRange(
  createdRaw: string,
  deadlineRaw: string | null | undefined,
  fromYmd: string,
  toYmd: string,
): boolean {
  if (!fromYmd && !toYmd) return true;
  const created = ymdFromField(createdRaw);
  const deadline = ymdFromField(deadlineRaw ?? null);

  const inRange = (ymd: string | null): boolean => {
    if (!ymd) return false;
    if (fromYmd && ymd < fromYmd) return false;
    if (toYmd && ymd > toYmd) return false;
    return true;
  };

  return inRange(created) || inRange(deadline);
}
