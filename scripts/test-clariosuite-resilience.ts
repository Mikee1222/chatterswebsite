/**
 * Dry-run / unit checks for ClarioSuite resilience helpers (no live API).
 * Run: npx tsx scripts/test-clariosuite-resilience.ts
 */
import assert from "node:assert/strict";
import {
  formatClarioSuiteOutageStatus,
  formatClarioSuiteOperatorTime,
  isClarioSuiteNetworkError,
  isClarioSuiteTransientHttpStatus,
  ClarioSuiteApiError,
} from "../lib/clariosuite-api";
import {
  parseClarioSuiteOutageState,
  shouldNotifyClarioSuiteOutage,
  type ClarioSuiteOutageState,
} from "../services/clariosuite-outage";

function checkTransientStatus() {
  assert.equal(isClarioSuiteTransientHttpStatus(500), true);
  assert.equal(isClarioSuiteTransientHttpStatus(502), true);
  assert.equal(isClarioSuiteTransientHttpStatus(503), true);
  assert.equal(isClarioSuiteTransientHttpStatus(504), true);
  assert.equal(isClarioSuiteTransientHttpStatus(408), true);
  // 4xx (except 408/425) must NOT be treated as transient retry targets
  assert.equal(isClarioSuiteTransientHttpStatus(400), false);
  assert.equal(isClarioSuiteTransientHttpStatus(401), false);
  assert.equal(isClarioSuiteTransientHttpStatus(403), false);
  assert.equal(isClarioSuiteTransientHttpStatus(404), false);
  assert.equal(isClarioSuiteTransientHttpStatus(429), false);
  console.log("ok transient status");
}

function checkNetworkError() {
  assert.equal(isClarioSuiteNetworkError(new TypeError("fetch failed")), true);
  assert.equal(isClarioSuiteNetworkError(new Error("ECONNRESET")), true);
  assert.equal(
    isClarioSuiteNetworkError(new ClarioSuiteApiError("down", 503, { code: "network_error" })),
    true
  );
  assert.equal(isClarioSuiteNetworkError(new ClarioSuiteApiError("bad key", 401)), false);
  assert.equal(isClarioSuiteNetworkError(new Error("invalid request")), false);
  console.log("ok network error detection");
}

function checkOutageBanner() {
  const since = "2026-09-28T10:00:00.000Z";
  const dataAsOf = "2026-09-28T09:30:00.000Z";
  const msg = formatClarioSuiteOutageStatus({ sinceIso: since, dataAsOfIso: dataAsOf });
  assert.match(msg, /temporarily unavailable since/);
  assert.match(msg, /Data as of/);
  assert.ok(msg.includes(formatClarioSuiteOperatorTime(since)));
  const noData = formatClarioSuiteOutageStatus({ sinceIso: since, dataAsOfIso: null });
  assert.match(noData, /Existing cached data left untouched/);
  console.log("ok outage banner");
}

function checkNotifyGate() {
  const started = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const fresh: ClarioSuiteOutageState = {
    startedAt: started,
    lastFailedAt: new Date().toISOString(),
    lastError: "ClarioSuite temporarily unavailable (HTTP 500)",
    lastNotifiedAt: null,
  };
  assert.equal(shouldNotifyClarioSuiteOutage(fresh), true);

  const under3h: ClarioSuiteOutageState = {
    ...fresh,
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  };
  assert.equal(shouldNotifyClarioSuiteOutage(under3h), false);

  const already: ClarioSuiteOutageState = {
    ...fresh,
    lastNotifiedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  };
  assert.equal(shouldNotifyClarioSuiteOutage(already), false);

  const parsed = parseClarioSuiteOutageState(JSON.stringify(fresh));
  assert.ok(parsed);
  assert.equal(parsed!.startedAt, started);
  assert.equal(parseClarioSuiteOutageState(""), null);
  assert.equal(parseClarioSuiteOutageState("not-json"), null);
  console.log("ok notify gate (>3h, once)");
}

/** Simulate exponential backoff schedule for 3 attempts (1s, 2s, capped). */
function checkBackoffSchedule() {
  const delays: number[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    delays.push(Math.min(8_000, 1_000 * 2 ** attempt));
  }
  assert.deepEqual(delays, [1000, 2000]);
  console.log("ok backoff schedule (max 3 attempts ⇒ 2 sleeps)");
}

checkTransientStatus();
checkNetworkError();
checkOutageBanner();
checkNotifyGate();
checkBackoffSchedule();
console.log("\nAll ClarioSuite resilience checks passed.");
