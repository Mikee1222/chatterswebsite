import fs from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

/** Load `.env.e2e` then `.env.local` (e2e wins). Safe to call multiple times. */
export function loadE2EEnv(cwd = process.cwd()): void {
  const e2ePath = path.join(cwd, ".env.e2e");
  const localPath = path.join(cwd, ".env.local");
  if (fs.existsSync(localPath)) loadDotenv({ path: localPath, override: false });
  if (fs.existsSync(e2ePath)) loadDotenv({ path: e2ePath, override: true });
}
