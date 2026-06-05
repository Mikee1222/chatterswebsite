"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";
import type { ClientAttentionItem } from "@/types/client-portal";

type Props = {
  items: ClientAttentionItem[];
};

export function ClientAttentionItemsBox({ items: initialItems }: Props) {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const visibleItems = initialItems.filter((item) => !removedIds.has(item.id));

  if (visibleItems.length === 0) return null;

  const severityColor = (severity: ClientAttentionItem["severity"]) => {
    switch (severity) {
      case "high":
        return "bg-red-500/15 text-red-300 border-red-500/30";
      case "medium":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      default:
        return "bg-pink-500/15 text-pink-300 border-pink-500/30";
    }
  };

  const handleClick = async (item: ClientAttentionItem, e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setRemovedIds((prev) => new Set(prev).add(item.id));

    const action =
      item.type === "invoice"
        ? "invoice_viewed"
        : item.type === "payment_due"
          ? "cycle_notified"
          : "submission_seen";

    try {
      await fetch("/api/client/submit-payment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, recordId: item.recordId }),
      });
      router.refresh();
      router.push(item.link);
    } catch {
      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-white">
        <AlertCircle className="h-5 w-5 text-pink-400" />
        What needs your attention
      </h2>
      <div className="space-y-3">
        {visibleItems.map((item) => (
          <Link
            key={item.id}
            href={item.link}
            onClick={(e) => handleClick(item, e)}
            className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] p-4 transition-all hover:border-pink-400/40"
          >
            <div className="flex flex-1 items-start gap-3">
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${severityColor(item.severity)}`}
              >
                {item.severity === "high" ? "High" : item.severity === "medium" ? "Medium" : "Low"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{item.title}</p>
                <p className="text-sm text-gray-400">{item.description}</p>
              </div>
            </div>
            <ArrowRight className="ml-4 h-5 w-5 shrink-0 text-gray-500 transition-colors group-hover:text-pink-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
