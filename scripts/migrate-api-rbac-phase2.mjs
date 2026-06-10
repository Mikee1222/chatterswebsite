#!/usr/bin/env node
/**
 * RBAC Phase 2: migrate app/api route auth checks to hasPermission().
 * Run: node scripts/migrate-api-rbac-phase2.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const API_DIR = path.join(ROOT, "app/api");

const SKIP = new Set([
  "cron",
  "debug-auth",
  "test-break-reminder",
]);

const SKIP_FILES = new Set([
  "client/fx/route.ts",
  "client/crypto-price/route.ts",
  "push/vapid-public/route.ts",
  "auth/switch-role/route.ts",
]);

/** @returns {string | string[] | null | "session-only" | "skip"} */
function resolvePermission(relPath) {
  const p = relPath.replace(/\\/g, "/");
  if (SKIP_FILES.has(p)) return "skip";

  const top = p.split("/")[0];
  if (SKIP.has(top)) return "skip";

  // Model routes: requireModelApiContext handles auth — skip role-only migration
  if (top === "model") return "skip";

  if (p.startsWith("admin/billing/") || p.startsWith("admin/submissions/") || p.startsWith("admin/rebills/") || p.startsWith("admin/tips/")) {
    return "billing:manage";
  }
  if (p.startsWith("admin/clients/")) return "clients:manage";
  if (p.startsWith("admin/mistake-reasons/")) return "mistakes:reasons-manage";
  if (p.startsWith("admin/mistakes/")) return "mistakes:manage";
  if (p.startsWith("admin/challenges/")) return "challenges:manage";
  if (p.startsWith("admin/rewards/")) return "rewards:manage";
  if (p === "admin/fines-bonuses/[id]/review/route.ts") return "fines:review";
  if (p.startsWith("admin/fines-bonuses/")) return "fines:manage";
  if (p.startsWith("admin/models/")) return "models:manage";
  if (p.startsWith("admin/marketing/")) return "marketing:manage";
  if (p.startsWith("admin/sops/")) return "sops:manage";
  if (p.startsWith("admin/task-phases/") || p.startsWith("admin/va-tasks/")) return "va-tasks:manage";
  if (p.startsWith("admin/va-content/") || p.startsWith("admin/va-content-assignments/")) return "content:manage";
  if (p.startsWith("admin/whales/")) return "whales:manage";
  if (p.startsWith("admin/payment-methods/")) return "payments:manage";
  if (p.startsWith("admin/custom-requests/") || p.startsWith("admin/custom/")) return "custom-requests:manage";
  if (p.startsWith("admin/content-requests/") || p.startsWith("admin/expense-requests/")) return "content:manage";
  if (p.startsWith("admin/sync-of-subscribers/")) return "earnings:view";
  if (p === "admin/proxy-image/route.ts") return "settings:view";
  if (p.startsWith("debug/") || p === "admin/test-notifications/route.ts") return "notifications:diagnostic";

  if (p.startsWith("chatter/shift-queue")) return "shifts:start";
  if (p === "chatter/active-models/route.ts") return "shifts:active-view";
  if (p === "chatter/fines-bonuses/route.ts") return "fines:view";
  if (p === "chatter/tips/route.ts" || p === "chatter/rebills/route.ts" || p === "chatter/extra-revenue/route.ts") return "shifts:view";
  if (p === "chatter/model-payment-info/route.ts") return "payments:view";

  if (p.startsWith("va/whales/")) return "whales:view";
  if (p.startsWith("va/mistakes/")) return "mistakes:view";
  if (p.startsWith("va/fines-bonuses/")) return "fines:view";
  if (p.startsWith("va/task-phases/") || p.startsWith("va/phase-items/")) return "va-tasks:view";
  if (p.startsWith("va/content/") || p.startsWith("va/content-assignments/") || p.startsWith("va/schedule/")) return "content:manage";
  if (p === "va/marketing/report-shadowban/route.ts") return ["marketing:manage", "marketing:shadowban-report"];
  if (p.startsWith("va/marketing/")) return "marketing:view";
  if (p.startsWith("va/custom/")) return "custom-requests:approve";

  if (p.startsWith("client/")) return ["payments:submit", "clients:view"];

  if (p.startsWith("notifications/") || p.startsWith("push/")) return "settings:view";
  if (p === "realtime-token/route.ts") return "settings:view";
  if (p.startsWith("feedback/")) {
    if (p === "feedback/route.ts") return "settings:view";
    return "feedback:manage";
  }

  if (p.startsWith("mass-lists/")) return "mass-lists:manage";
  if (p.startsWith("pricing/")) return "pricing:manage";
  if (p.startsWith("infloww/")) return "earnings:view";
  if (p === "of-subscribers/route.ts") return ["earnings:view", "whales:view"];
  if (p === "search/route.ts") return "skip"; // handled manually
  if (p.startsWith("sops/")) return "sops:view";
  if (p.startsWith("model-groups/") || p.startsWith("model-tiers/")) return "models:manage";
  if (p === "models/[id]/route.ts") return "models:view";
  if (p === "whales/[id]/route.ts") return "whales:manage";
  if (p === "rewards/[id]/route.ts") return "rewards:view";
  if (p === "custom-requests/[id]/route.ts") return "custom-requests:view";

  return null;
}

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (ent.name === "route.ts") acc.push(full);
  }
  return acc;
}

function ensureImports(content) {
  let out = content;
  const needsHasPermission = out.includes("hasPermission(");
  const needsHasAny = out.includes("hasAnyPermission(");

  if (!needsHasPermission && !needsHasAny) return out;

  if (!out.includes('from "@/lib/rbac"')) {
    const rbacImports = [
      needsHasPermission ? "hasPermission" : null,
      needsHasAny ? "hasAnyPermission" : null,
    ].filter(Boolean);
    const importLine = `import { ${rbacImports.join(", ")} } from "@/lib/rbac";\n`;
    const authImport = out.match(/import .+ from "@\/lib\/auth";\n/);
    if (authImport) {
      out = out.replace(authImport[0], authImport[0] + importLine);
    } else {
      out = importLine + out;
    }
  }

  return out;
}

function removeLocalAuthHelpers(content) {
  return content
    .replace(
      /function isAdminOrManager\([^)]*\)[^{]*\{[^}]*\}\n\n?/g,
      ""
    )
    .replace(
      /function isAdminOrManager\([^)]*\)[^{]*\{[^}]*\}\n/g,
      ""
    )
    .replace(
      /function isAdminOnly\([^)]*\)[^{]*\{[^}]*\}\n\n?/g,
      ""
    )
    .replace(
      /function isAdmin\([^)]*\)[^{]*\{[^}]*\}\n\n?/g,
      ""
    )
    .replace(
      /function isAdminRole\([^)]*\)[^{]*\{[^}]*\}\n\n?/g,
      ""
    )
    .replace(
      /function isChatterOrVa\([^)]*\)[^{]*\{[^}]*\}\n\n?/g,
      ""
    );
}

function buildPermissionCheck(perm, sessionVar = "session") {
  if (Array.isArray(perm)) {
    const lit = perm.map((p) => `"${p}"`).join(", ");
    return `if (!(await hasAnyPermission(${sessionVar}, [${lit}]))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });`;
  }
  return `if (!(await hasPermission(${sessionVar}, "${perm}"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });`;
}

function buildAuthBlock(perm, sessionVar = "session", unauthorizedFirst = true) {
  const lines = [];
  if (unauthorizedFirst) {
    lines.push(`if (!${sessionVar}) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`);
  }
  if (perm !== "session-only") {
    lines.push(buildPermissionCheck(perm, sessionVar));
  }
  return lines.join("\n  ");
}

function migrateFile(filePath, permission) {
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;

  if (content.includes("hasPermission(") || content.includes("hasAnyPermission(")) {
    return { changed: false, reason: "already migrated" };
  }

  // Skip files without session auth
  if (!content.includes("getSessionFromCookies") && !content.includes("requireModelApiContext")) {
    return { changed: false, reason: "no session auth" };
  }

  if (permission === "skip") {
    return { changed: false, reason: "skipped" };
  }

  content = removeLocalAuthHelpers(content);

  const replacements = [
    // Combined unauthorized + forbidden admin/manager
    [
      /if \(!(\w+) \|\| \(\1\.role !== "admin" && \1\.role !== "manager"\)\) \{\s*return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);\s*\}/g,
      (m, v) => {
        const block = buildAuthBlock(permission, v);
        return block;
      },
    ],
    [
      /if \(!(\w+) \|\| \(\1\.role !== "admin" && \1\.role !== "manager"\)\) \{\s*return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);\s*\}/g,
      (m, v) => buildAuthBlock(permission, v),
    ],
    [
      /if \(!isAdminOrManager\((\w+)\)\) \{\s*return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);\s*\}/g,
      (m, v) => buildPermissionCheck(permission, v),
    ],
    [
      /if \(!isAdminOnly\((\w+)\)\) \{\s*return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);\s*\}/g,
      (m, v) => buildPermissionCheck(permission, v),
    ],
    [
      /if \(!isAdmin\((\w+)\)\) \{\s*return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);\s*\}/g,
      (m, v) => buildPermissionCheck(permission, v),
    ],
    [
      /if \(!(\w+) \|\| !isAdminRole\(\1\.role\)\) \{\s*return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);\s*\}/g,
      (m, v) => buildAuthBlock(permission, v, true),
    ],
    [
      /if \(!isAdminOrManager\((\w+)\.role\)\)[^{]*\{[^}]*Forbidden[^}]*\}/g,
      (m, v) => buildPermissionCheck(permission, v),
    ],
    [
      /if \(!isAdminOrManager\((\w+)\.role\)\) return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);/g,
      (m, v) => buildPermissionCheck(permission, v),
    ],
    // getEffectiveStaffRole chatter
    [
      /if \(!(\w+) \|\| getEffectiveStaffRole\(\1\) !== "chatter"\) \{\s*return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);\s*\}/g,
      (m, v) => buildAuthBlock(permission, v),
    ],
    [
      /if \(!(\w+) \|\| getEffectiveStaffRole\(\1\) !== "chatter"\) \{\s*return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);\s*\}/g,
      (m, v) => buildAuthBlock(permission, v),
    ],
    // VA staff role
    [
      /if \(!(\w+) \|\| getEffectiveStaffRole\(\1\) !== "virtual_assistant"\) \{\s*return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);\s*\}/g,
      (m, v) => buildAuthBlock(permission, v),
    ],
    // client role
    [
      /if \(!(\w+) \|\| \1\.role !== "client"\) \{\s*return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);\s*\}/g,
      (m, v) => buildAuthBlock(permission, v),
    ],
    // admin manager infloww style
    [
      /if \(\1\.role !== "admin" && \1\.role !== "manager"\) \{\s*return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);\s*\}/g,
      null,
    ],
    // Session only add permission after unauthorized check
    [
      /const (\w+) = await getSessionFromCookies\(\);\s*if \(!\1\) \{\s*return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);\s*\}/g,
      (m, v) => {
        if (permission === "session-only") return m;
        return `const ${v} = await getSessionFromCookies();\n  if (!${v}) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });\n  ${buildPermissionCheck(permission, v)}`;
      },
    ],
  ];

  for (const [pattern, replacer] of replacements) {
    if (replacer) content = content.replace(pattern, replacer);
  }

  // infloww: user already checked, then role check
  content = content.replace(
    /if \((\w+)\.role !== "admin" && \1\.role !== "manager"\) \{\s*return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);\s*\}/g,
    (m, v) => buildPermissionCheck(permission, v)
  );

  // of-subscribers multi-role
  content = content.replace(
    /if \(\1\.role !== "admin" && \1\.role !== "manager" && \1\.role !== "chatter"\) \{\s*return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);\s*\}/g,
    (m, v) => buildPermissionCheck(permission, v)
  );

  content = ensureImports(content);

  if (content === original) {
    return { changed: false, reason: "no pattern matched", permission };
  }

  fs.writeFileSync(filePath, content);
  return { changed: true, permission };
}

const files = walk(API_DIR);
const results = { migrated: 0, skipped: [], failed: [] };

for (const file of files) {
  const rel = path.relative(API_DIR, file).replace(/\\/g, "/");
  const perm = resolvePermission(rel);
  if (perm === "skip") {
    results.skipped.push(rel);
    continue;
  }
  if (perm === null) {
    const content = fs.readFileSync(file, "utf8");
    if (content.includes("getSessionFromCookies") && (content.includes("Forbidden") || content.includes("role"))) {
      results.failed.push({ rel, reason: "no permission mapping" });
    }
    continue;
  }
  const r = migrateFile(file, perm);
  if (r.changed) results.migrated++;
  else if (r.reason === "no pattern matched") results.failed.push({ rel, permission: perm });
}

console.log(JSON.stringify(results, null, 2));
