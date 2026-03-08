/**
 * USD ↔ EUR conversion. Isolated so live exchange API can be plugged in later.
 * Do not use for production pricing; placeholder only.
 * Whale session currency is usd/eur only.
 */

const PLACEHOLDER_USD_TO_EUR = 0.92;
const PLACEHOLDER_EUR_TO_USD = 1 / PLACEHOLDER_USD_TO_EUR;

export function usdToEur(usd: number): number {
  return usd * PLACEHOLDER_USD_TO_EUR;
}

export function eurToUsd(eur: number): number {
  return eur * PLACEHOLDER_EUR_TO_USD;
}

export function getUsdToEurRate(): number {
  return PLACEHOLDER_USD_TO_EUR;
}
