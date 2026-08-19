"use client";

import * as React from "react";
import { ArrowRightLeft, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InflowwSalesReassignment } from "@/services/infloww-sales-reassignments";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function employeeName(id: string | null, name: string | null): string {
  if (name) return name;
  if (id) return `Employee ${id.slice(-6)}`;
  return "—";
}

function ReassignmentRow({ row }: { row: InflowwSalesReassignment }) {
  const opName = employeeName(row.operationEmployeeId, row.operationEmployeeName);
  const beforeName = employeeName(row.beforeEmployeeId, row.beforeEmployeeName);
  const afterName = employeeName(row.afterEmployeeId, row.afterEmployeeName);

  const summary =
    row.operationType === "Include"
      ? `${opName} assigned transaction ${row.transactionId.slice(-8)} to ${afterName}`
      : `${opName} reassigned transaction ${row.transactionId.slice(-8)} from ${beforeName} to ${afterName}`;

  return (
    <div className="flex items-start gap-4 rounded-xl border border-white/8 bg-white/4 px-5 py-4">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D4AF8C]/20 bg-[#D4AF8C]/8">
        <ArrowRightLeft className="h-4 w-4 text-[#D4AF8C]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white">{summary}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>
            Type: <span className="text-gray-400">{row.operationType}</span>
          </span>
          {row.beforeEmployeeId && (
            <span>
              From: <span className="text-gray-400">{beforeName}</span>
            </span>
          )}
          {row.afterEmployeeId && (
            <span>
              To: <span className="text-gray-400">{afterName}</span>
            </span>
          )}
          <span>
            Tx:{" "}
            <span className="font-mono text-gray-400">{row.transactionId.slice(-12)}</span>
          </span>
        </div>
      </div>
      <time className="shrink-0 text-xs text-gray-500">{fmtDate(row.createdTime)}</time>
    </div>
  );
}

interface Props {
  reassignments: InflowwSalesReassignment[];
}

export function AdminSalesReassignmentsClient({ reassignments }: Props) {
  if (reassignments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/8 bg-white/4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <Info className="h-6 w-6 text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">No reassignment events yet</p>
          <p className="mt-1 text-xs text-gray-500">
            Manual sales reassignments will appear here once synced.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        {reassignments.length} reassignment event{reassignments.length !== 1 ? "s" : ""}
      </p>
      <div className="space-y-2">
        {reassignments.map((r) => (
          <ReassignmentRow key={r.id} row={r} />
        ))}
      </div>
    </div>
  );
}
