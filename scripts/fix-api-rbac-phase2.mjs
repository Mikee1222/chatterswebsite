#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const API_DIR = path.resolve(import.meta.dirname, "..", "app/api");

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (ent.name === "route.ts") acc.push(full);
  }
  return acc;
}

const VA_PERM_MAP = [
  ["va/mistakes/", "mistakes:view"],
  ["va/fines-bonuses/", "fines:view"],
  ["va/task-phases/", "va-tasks:view"],
  ["va/phase-items/", "va-tasks:view"],
  ["va/marketing/accounts/", "marketing:view"],
  ["va/content/", "content:manage"],
  ["va/content-assignments/", "content:manage"],
  ["va/schedule/", "content:manage"],
  ["va/custom/", "custom-requests:approve"],
];

function resolveVaPerm(file) {
  const rel = path.relative(API_DIR, file).replace(/\\/g, "/");
  for (const [prefix, perm] of VA_PERM_MAP) {
    if (rel.startsWith(prefix)) return perm;
  }
  return null;
}

let fixed = 0;

for (const file of walk(API_DIR)) {
  let content = fs.readFileSync(file, "utf8");
  const original = content;
  const rel = path.relative(API_DIR, file).replace(/\\/g, "/");

  content = content.replace(
    /return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);, \{ status: 403 \}\);\n  \}/g,
    ""
  );
  content = content.replace(
    /return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);, \{ status: 403 \}\);/g,
    'return NextResponse.json({ error: "Forbidden" }, { status: 403 });'
  );

  // Remove duplicate consecutive hasPermission lines
  content = content.replace(
    /(if \(!\(await hasPermission\([^)]+\)\)\) return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);)\n  \1/g,
    "$1"
  );

  if (content.includes("isStaffAdmin")) {
    let perm = "sops:manage";
    if (rel.includes("fines-bonuses")) perm = rel.includes("review") ? "fines:review" : "fines:manage";
    content = content.replace(
      /function isStaffAdmin\(session: \{ role: string \} \| null\): boolean \{\n  return session != null && \(session\.role === "admin" \|\| session\.role === "manager"\);\n\}\n\n?/g,
      ""
    );
    if (!content.includes('from "@/lib/rbac"')) {
      content = content.replace(
        /(import .+ from "@\/lib\/auth";\n)/,
        '$1import { hasPermission } from "@/lib/rbac";\n'
      );
    }
    content = content.replace(
      /if \(!isStaffAdmin\(session\)\) \{\n    return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);\n  \}/g,
      `if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });\n  if (!(await hasPermission(session, "${perm}"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });`
    );
  }

  const vaPerm = resolveVaPerm(file);
  if (vaPerm && content.includes('getEffectiveStaffRole(session) !== "virtual_assistant"')) {
    if (!content.includes('from "@/lib/rbac"')) {
      content = content.replace(
        /(import .+ from "@\/lib\/auth";\n)/,
        '$1import { hasPermission } from "@/lib/rbac";\n'
      );
    }
    content = content.replace(
      /if \(!session \|\| getEffectiveStaffRole\(session\) !== "virtual_assistant"\) \{\n    return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);\n  \}/g,
      `if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });\n  if (!(await hasPermission(session, "${vaPerm}"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });`
    );
    content = content.replace(
      /if \(!session \|\| getEffectiveStaffRole\(session\) !== "virtual_assistant"\) \{\n    return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);\n  \}/g,
      `if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });\n  if (!(await hasPermission(session, "${vaPerm}"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });`
    );
  }

  // VA content/create uses Forbidden for both
  if (rel === "va/content/create/route.ts") {
    content = content.replace(
      /if \(!session \|\| getEffectiveStaffRole\(session\) !== "virtual_assistant"\) \{\n    return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);\n  \}/g,
      `if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });\n  if (!(await hasPermission(session, "content:manage"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });`
    );
  }

  // debug routes
  if (rel.startsWith("debug/")) {
    if (!content.includes('from "@/lib/rbac"')) {
      content = content.replace(/(import .+ from "@\/lib\/auth";\n)/, '$1import { hasPermission } from "@/lib/rbac";\n');
    }
    content = content.replace(
      /if \(!session \|\| \(session\.role !== "admin" && session\.role !== "manager"\)\) \{\n    return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);\n  \}/g,
      'if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });\n  if (!(await hasPermission(session, "notifications:diagnostic"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });'
    );
    content = content.replace(
      /if \(!user \|\| \(user\.role !== "admin" && user\.role !== "manager"\)\) \{\n    return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);\n  \}/g,
      'if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });\n  if (!(await hasPermission(user, "notifications:diagnostic"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });'
    );
  }

  // of-subscribers remove redundant role check
  if (rel === "of-subscribers/route.ts") {
    content = content.replace(
      /\n  if \(user\.role !== "admin" && user\.role !== "manager" && user\.role !== "chatter"\) \{\n    return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);\n  \}/,
      ""
    );
  }

  // mass-lists GET fix
  if (rel === "mass-lists/route.ts") {
    content = content.replace(
      /export async function GET\(\) \{\n  const user = await getSessionFromCookies\(\);\n  if \(!user\) return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);\n  if \(!\(await hasPermission\(user, "mass-lists:manage"\)\)\) return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);\n  try \{\n    if \(isAdminOrManager\(user\.role\)\) \{\n      const lists = await getAllMassListsAdmin\(\);\n      return NextResponse\.json\(lists\);\n    \}\n    if \(isChatterOrVa\(user\.role\)\) \{\n      const lists = await getAllMassLists\(\);\n      return NextResponse\.json\(lists\);\n    \}\n    return NextResponse\.json\(\{ error: "Forbidden" \}, \{ status: 403 \}\);/s,
      `export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (await hasPermission(user, "mass-lists:manage")) {
      const lists = await getAllMassListsAdmin();
      return NextResponse.json(lists);
    }
    if (await hasAnyPermission(user, ["mass-lists:view"])) {
      const lists = await getAllMassLists();
      return NextResponse.json(lists);
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });`
    );
  }

  // pricing GET fix
  if (rel === "pricing/route.ts") {
    if (!content.includes("hasPermission")) {
      content = content.replace(/(import .+ from "@\/lib\/auth";\n)/, '$1import { hasPermission } from "@/lib/rbac";\n');
    }
    content = content.replace(
      /const admin = isAdminOrManager\(user\.role\);/,
      'const admin = await hasPermission(user, "pricing:manage");'
    );
  }

  // model-tiers GET fix
  if (rel === "model-tiers/route.ts") {
    content = content.replace(
      /const rows = isAdminOrManager\(user\.role\) \? await getAllModelTiersAdmin\(\) : await getAllModelTiers\(\);/,
      'const rows = (await hasPermission(user, "models:manage")) ? await getAllModelTiersAdmin() : await getAllModelTiers();'
    );
    if (!content.includes('hasPermission(user, "models:view")')) {
      content = content.replace(
        /export async function GET\(\) \{\n  const user = await getSessionFromCookies\(\);\n  if \(!user\) return NextResponse\.json\(\{ error: "Unauthorized" \}, \{ status: 401 \}\);/,
        `export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(user, "models:view")) && !(await hasPermission(user, "models:manage"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }`
      );
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    fixed++;
  }
}

console.log("fixed", fixed);
