/**
 * Unit checks for Hermes agent API allowlist (DEFAULT DENY).
 *   npx tsx scripts/test-agent-allowlist.ts
 */

import { AGENT_ALLOWLIST, isAgentAllowlisted, matchAgentAllowlist } from "../lib/agent-allowlist";
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

const BRIEF_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const POST_UUID = "11111111-2222-3333-4444-555555555555";
const ITEM_UUID = "99999999-8888-7777-6666-555555555555";
const ITEM_REC = "recABCDEFGHIJKLMN"; // rec + 14 alnum
const ITEM_LOGICAL = "item_1710000000_ab12";

// --- Allowlist: allow ---
assert("GET /api/posting-briefs", isAgentAllowlisted("GET", "/api/posting-briefs"));
assert(
  "GET /api/posting-briefs/[uuid]",
  isAgentAllowlisted("GET", `/api/posting-briefs/${BRIEF_UUID}`),
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
  isAgentAllowlisted(
    "POST",
    `/api/posting-briefs/${BRIEF_UUID}/posts/${POST_UUID}/posted`,
  ),
);
assert("POST task-shift/start", isAgentAllowlisted("POST", "/api/va/task-shift/start"));
assert(
  "POST phase-items complete (uuid)",
  isAgentAllowlisted("POST", `/api/va/phase-items/${ITEM_UUID}/complete`),
);
assert(
  "POST phase-items complete (rec)",
  isAgentAllowlisted("POST", `/api/va/phase-items/${ITEM_REC}/complete`),
);
assert(
  "POST phase-items complete (item_)",
  isAgentAllowlisted("POST", `/api/va/phase-items/${ITEM_LOGICAL}/complete`),
);
assert(
  "POST report-shadowban",
  isAgentAllowlisted("POST", "/api/va/marketing/report-shadowban"),
);
assert(
  "POST report-restriction-lifted",
  isAgentAllowlisted("POST", "/api/va/marketing/report-restriction-lifted"),
);

// --- Static siblings must NOT match [id] ---
assert(
  "GET /api/posting-briefs/meta denied",
  !isAgentAllowlisted("GET", "/api/posting-briefs/meta"),
);
assert(
  "GET /api/posting-briefs/prefill-from-editing denied",
  !isAgentAllowlisted("GET", "/api/posting-briefs/prefill-from-editing"),
);
assert(
  "GET /api/posting-briefs/abc-123 denied (not uuid)",
  !isAgentAllowlisted("GET", "/api/posting-briefs/abc-123"),
);

// --- Allowlist: deny ---
assert(
  "DELETE /posted denied",
  !isAgentAllowlisted(
    "DELETE",
    `/api/posting-briefs/${BRIEF_UUID}/posts/${POST_UUID}/posted`,
  ),
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
  !isAgentAllowlisted("POST", `/api/va/phase-items/${ITEM_UUID}`),
);

// DELETE/PATCH/PUT on every allowlisted path
const samplePaths: { method: "GET" | "POST"; path: string }[] = [
  { method: "GET", path: "/api/posting-briefs" },
  { method: "GET", path: `/api/posting-briefs/${BRIEF_UUID}` },
  { method: "GET", path: "/api/va/story-link-schedule" },
  { method: "GET", path: "/api/va/marketing/phones" },
  { method: "GET", path: "/api/va/marketing/accounts" },
  { method: "GET", path: "/api/va/task-phases" },
  { method: "GET", path: "/api/winner-videos" },
  {
    method: "POST",
    path: `/api/posting-briefs/${BRIEF_UUID}/posts/${POST_UUID}/posted`,
  },
  { method: "POST", path: "/api/va/task-shift/start" },
  { method: "POST", path: `/api/va/phase-items/${ITEM_UUID}/complete` },
  { method: "POST", path: "/api/va/marketing/report-shadowban" },
  { method: "POST", path: "/api/va/marketing/report-restriction-lifted" },
];
assert(
  "sample paths cover full allowlist",
  samplePaths.length === AGENT_ALLOWLIST.length,
);
for (const { path } of samplePaths) {
  for (const bad of ["DELETE", "PATCH", "PUT"] as const) {
    assert(`${bad} ${path} denied`, !isAgentAllowlisted(bad, path));
  }
}

// Trailing slashes, double slashes, encoded slashes
assert(
  "trailing slash list denied",
  !isAgentAllowlisted("GET", "/api/posting-briefs/"),
);
assert(
  "trailing slash brief id denied",
  !isAgentAllowlisted("GET", `/api/posting-briefs/${BRIEF_UUID}/`),
);
assert(
  "double slash denied",
  !isAgentAllowlisted("GET", "/api//posting-briefs"),
);
assert(
  "double slash in id path denied",
  !isAgentAllowlisted("GET", `/api/posting-briefs//${BRIEF_UUID}`),
);
assert(
  "encoded slash %2f denied",
  !isAgentAllowlisted("GET", "/api/posting-briefs%2f" + BRIEF_UUID),
);
assert(
  "encoded slash %2F in middle denied",
  !isAgentAllowlisted(
    "POST",
    `/api/posting-briefs/${BRIEF_UUID}%2Fposts%2F${POST_UUID}%2Fposted`,
  ),
);

const posted = matchAgentAllowlist(
  "POST",
  `/api/posting-briefs/${BRIEF_UUID}/posts/${POST_UUID}/posted`,
);
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
