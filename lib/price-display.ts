import type { PriceMenuRow } from "@/services/price-menus";
import { formatPriceDisplay } from "@/lib/price-parse";

export function rowNormalLabel(row: PriceMenuRow): string {
  return formatPriceDisplay({
    min: row.price_min,
    max: row.price_max,
    plus: row.price_plus,
    raw: row.raw_price_normal,
  });
}

export function rowNegLabel(row: PriceMenuRow): string {
  return formatPriceDisplay({
    min: row.neg_min,
    max: row.neg_max,
    text: row.neg_text,
    raw: row.raw_price_negotiation,
  });
}

export const SPENDER_ORDER = ["high", "medium", "low", "medium_low"] as const;

export function spenderLabel(s: string): string {
  if (s === "medium_low") return "Medium-Low";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
