/**
 * Hermes agent token CLI — create / revoke / list.
 * Secrets from env (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 * Plaintext printed once to stdout only — never logged to files.
 *
 *   npx tsx scripts/agent-token.ts create --user-email hermes@example.com [--label "prod"]
 *   npx tsx scripts/agent-token.ts revoke --id <uuid>
 *   npx tsx scripts/agent-token.ts list [--user-email hermes@example.com] [--all]
 */

import { loadEnvConfig } from "@next/env";
import {
  createAgentToken,
  findUserUuidByEmail,
  listAgentTokens,
  revokeAgentToken,
} from "../services/agent-tokens";

loadEnvConfig(process.cwd());

function usage(): never {
  console.error(`Usage:
  npx tsx scripts/agent-token.ts create --user-email <email> [--label <text>]
  npx tsx scripts/agent-token.ts revoke --id <uuid>
  npx tsx scripts/agent-token.ts list [--user-email <email>] [--all]`);
  process.exit(1);
}

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  return argv[i + 1];
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd) usage();

  if (cmd === "create") {
    const email = argValue(argv, "--user-email");
    if (!email) usage();
    const label = argValue(argv, "--label");
    const { token, row } = await createAgentToken({
      userEmail: email!,
      label: label ?? null,
      createdBy: "cli",
    });
    // Plaintext once to stdout only
    process.stdout.write(`${token}\n`);
    process.stderr.write(
      `created id=${row.id} prefix=${row.token_prefix} expires=${row.expires_at}\n`,
    );
    return;
  }

  if (cmd === "revoke") {
    const id = argValue(argv, "--id");
    if (!id) usage();
    const row = await revokeAgentToken(id!);
    if (!row) {
      console.error("Token not found or already revoked");
      process.exit(1);
    }
    console.log(`revoked ${row.id} at ${row.revoked_at}`);
    return;
  }

  if (cmd === "list") {
    const email = argValue(argv, "--user-email");
    const includeRevoked = argv.includes("--all");
    let userId: string | undefined;
    if (email) {
      userId = (await findUserUuidByEmail(email)) ?? undefined;
      if (!userId) {
        console.error(`No user for ${email}`);
        process.exit(1);
      }
    }
    const rows = await listAgentTokens({ userId, includeRevoked });
    for (const r of rows) {
      const status = r.revoked_at
        ? "revoked"
        : Date.parse(r.expires_at) <= Date.now()
          ? "expired"
          : "active";
      console.log(
        [
          r.id,
          r.token_prefix,
          status,
          r.label ?? "",
          `created=${r.created_at}`,
          `expires=${r.expires_at}`,
          `last_used=${r.last_used_at ?? "—"}`,
        ].join("\t"),
      );
    }
    return;
  }

  usage();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
