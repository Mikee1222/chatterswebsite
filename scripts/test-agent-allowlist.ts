/**
 * Unit checks for Hermes agent API allowlist (DEFAULT DENY).
 *   npx tsx scripts/test-agent-allowlist.ts
 */

import { isAgentAllowlisted, matchAgentAllowlist } from "../lib/agent-allowlist";
import {
  agentTokenDisplayPrefix,
  generateAgentTokenPlaintext,
  hashAgentToken,
  isAgentTokenFormat,
  AGENT_TOKEN_PREFIX,
  AGENT_TOKEN_RANDOM_LEN,
} from "../lib/agent-token-crypto";

let failed = 0;

function assert(name: string, ok: boolean) {
  console.log(`${name}: ${ok ? "PASS" : "FAIL"}`);
  if (!ok) failed += 1;
}

// --- Allowlist: allow ---
assert("GET /api/posting-briefs", isAgentAllowlisted("GET", "/api/posting-briefs"));
assert(
  "GET /api/posting-briefs/[id]",
  isAgentAllowlisted("GET", "/api/posting-briefs/abc-123"),
);
assert(
  "GET story-link-schedule",
  isAgentAllowlisted("GET", "/api/va/story-link-schedule"),
);
assert("GET phones", isAgentAllowlisted("GET", "/api/va/marketing/phones"));
assert("GET accounts", isAgentAllowlisted("GET", "/api/va/marketing/accounts"));
assert("GET task-phases", isAgentAllowlisted("GET", "/api/va/task-phases"));
assert("GET winner-videos", isAgentAllowlisted("GET", "/api/winner-videos"));
assert(
  "POST posted",
  isAgentAllowlisted("POST", "/api/posting-briefs/bid/posts/pid/posted"),
);
assert("POST task-shift/start", isAgentAllowlisted("POST", "/api/va/task-shift/start"));
assert(
  "POST phase-items complete",
  isAgentAllowlisted("POST", "/api/va/phase-items/item1/complete"),
);
assert(
  "POST report-shadowban",
  isAgentAllowlisted("POST", "/api/va/marketing/report-shadowban"),
);
assert(
  "POST report-restriction-lifted",
  isAgentAllowlisted("POST", "/api/va/marketing/report-restriction-lifted"),
);

// --- Allowlist: deny ---
assert(
  "DELETE /posted denied",
  !isAgentAllowlisted("DELETE", "/api/posting-briefs/bid/posts/pid/posted"),
);
assert("POST /api/winner-videos denied", !isAgentAllowlisted("POST", "/api/winner-videos"));
assert("GET /api/admin/roles denied", !isAgentAllowlisted("GET", "/api/admin/roles"));
assert(
  "POST /api/admin/agent-tokens denied",
  !isAgentAllowlisted("POST", "/api/admin/agent-tokens"),
);
assert("GET /admin/agent-tokens (page) denied", !isAgentAllowlisted("GET", "/admin/agent-tokens"));
assert("GET /va-tasks denied", !isAgentAllowlisted("GET", "/va-tasks"));
assert(
  "POST phase-items without complete denied",
  !isAgentAllowlisted("POST", "/api/va/phase-items/item1"),
);

const posted = matchAgentAllowlist("POST", "/api/posting-briefs/x/posts/y/posted");
assert(
  "posted pattern name",
  posted?.pattern === "POST /api/posting-briefs/[id]/posts/[postId]/posted",
);

// --- Token crypto ---
const tok = generateAgentTokenPlaintext();
assert("token starts with gz_agent_", tok.startsWith(AGENT_TOKEN_PREFIX));
assert(
  "token length",
  tok.length === AGENT_TOKEN_PREFIX.length + AGENT_TOKEN_RANDOM_LEN,
);
assert("token format ok", isAgentTokenFormat(tok));
assert("wrong prefix rejected", !isAgentTokenFormat("gz_other_" + "a".repeat(40)));
assert("short rejected", !isAgentTokenFormat(AGENT_TOKEN_PREFIX + "abc"));
assert("hash is 64 hex", /^[a-f0-9]{64}$/.test(hashAgentToken(tok)));
assert("prefix len 12", agentTokenDisplayPrefix(tok).length === 12);
assert("modulo-bias alphabet only", /^gz_agent_[A-Za-z0-9]+$/.test(tok));

if (failed > 0) {
  console.error(`\n${failed} failure(s)`);
  process.exit(1);
}
console.log("\nAll agent allowlist/crypto checks passed.");
