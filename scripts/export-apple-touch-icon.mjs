#!/usr/bin/env node
/**
 * Regenerate iOS apple-touch icons (180×180) from the 512×512 Gunzo PNG logo.
 * Usage: npm run icon:apple
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const source = path.join(publicDir, "icon-512-v2.png");
const targets = [
  "apple-touch-icon-v2.png",
  "apple-touch-icon-precomposed-v2.png",
];

for (const name of targets) {
  const out = path.join(publicDir, name);
  execFileSync("sips", ["-z", "180", "180", source, "--out", out], { stdio: "inherit" });
  console.log(`Wrote ${name}`);
}
