#!/usr/bin/env npx tsx
/**
 * One-off smoke test for SOP linked writes (departments, roles, functions).
 * NOT for commit — delete or keep locally only.
 *
 *   npx tsx scripts/smoke-sops.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { listAllRecords } from "@/lib/airtable-server";
import {
  createSopDepartment,
  createSopRole,
  createFunction,
  getFunctionsByRole,
  getSopRoleBySlug,
  deleteSopDepartment,
  deleteSopRole,
  deleteFunction,
} from "@/services/sops";

const TEST_SLUG = `test-sop-smoke-${Date.now()}`;

function log(label: string, data: unknown) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(data, null, 2));
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERT FAILED: ${message}`);
  }
}

async function main() {
  let deptId: string | null = null;
  let roleId: string | null = null;
  let fnId: string | null = null;

  try {
    console.log("[smoke-sops] Starting SOP linked-write smoke test…");

    const dept = await createSopDepartment({
      name: "TEST Dept",
      color: "blue",
      sort_order: 9999,
      is_active: true,
    });
    deptId = dept.id;
    log("Created department", dept);

    const users = await listAllRecords<{ full_name?: string }>("users", {
      _caller: "smoke-sops",
    });
    assert(users.length > 0, "No users found in users table");
    const userId = users[0]!.id;
    log("Using user", { id: userId, full_name: users[0]!.fields?.full_name });

    const role = await createSopRole({
      name: "TEST Role",
      slug: TEST_SLUG,
      description: "Smoke test role",
      icon: "briefcase",
      color: "blue",
      auth_roles: ["chatter", "virtual_assistant"],
      assigned_user_ids: [userId],
      sort_order: 9999,
      is_active: true,
    });
    roleId = role.id;
    log("Created role", role);

    const fn = await createFunction({
      sop_role_id: role.id,
      name: "TEST Function",
      department_id: dept.id,
      kpi: "Complete smoke test",
      sop_content: "Step 1: run script\nStep 2: verify links",
      loom_url: "https://www.loom.com/share/smoke-test",
      cadence_type: "weekly",
      cadence_note: "Every Monday",
      sort_order: 9999,
      is_active: true,
    });
    fnId = fn.id;
    log("Created function", fn);

    const functionsByRole = await getFunctionsByRole(role.id);
    log("getFunctionsByRole", functionsByRole);

    const roleBySlug = await getSopRoleBySlug(TEST_SLUG);
    log("getSopRoleBySlug", roleBySlug);

    const testFn = functionsByRole.find((f) => f.id === fn.id);
    assert(!!testFn, "getFunctionsByRole did not return created function");
    assert(
      testFn!.department_id === dept.id,
      `function department link empty/wrong: got "${testFn!.department_id}", expected "${dept.id}"`
    );
    assert(
      testFn!.sop_role_id === role.id,
      `function sop_role link empty/wrong: got "${testFn!.sop_role_id}", expected "${role.id}"`
    );
    assert(
      testFn!.cadence_type === "weekly",
      `cadence_type not saved: got "${testFn!.cadence_type}"`
    );

    assert(!!roleBySlug, "getSopRoleBySlug returned null");
    assert(
      roleBySlug!.assigned_user_ids.includes(userId),
      `role assigned_users missing user id: got ${JSON.stringify(roleBySlug!.assigned_user_ids)}`
    );
    const authRoles = roleBySlug!.auth_roles.sort().join(",");
    assert(
      authRoles === "chatter,virtual_assistant",
      `role auth_roles wrong: got "${authRoles}"`
    );

    console.log("\n[smoke-sops] ✅ All verifications passed");
  } finally {
    console.log("\n[smoke-sops] Cleaning up TEST records…");
    if (fnId) {
      await deleteFunction(fnId);
      console.log(`  deleted function ${fnId}`);
    }
    if (roleId) {
      await deleteSopRole(roleId);
      console.log(`  deleted role ${roleId}`);
    }
    if (deptId) {
      await deleteSopDepartment(deptId);
      console.log(`  deleted department ${deptId}`);
    }
    console.log("[smoke-sops] Done.");
  }
}

main().catch((err) => {
  console.error("\n[smoke-sops] ❌ FAILED:", err);
  process.exit(1);
});
