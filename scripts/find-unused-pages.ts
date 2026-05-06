/**
 * Audit every page.tsx under app/(dashboard)/model for references across the codebase.
 *
 * Usage: npm run find:unused
 * Or: npm run clean:unused (prompts before deleting unused page.tsx only)
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(__filename));
const MODEL_DIR = join(ROOT, "app", "(dashboard)", "model");
/** POSIX prefix inside repo for route parsing */
const MODEL_PREFIX = "app/(dashboard)/model/";

const MAX_SCAN_FILES = 8000;

const PRIORITY_FILES = [
  "lib/routes.ts",
  "lib/nav-config.ts",
  "components/sidebar.tsx",
  "components/mobile-app-shell.tsx",
  "middleware.ts",
  "components/model-quick-actions-modal.tsx",
] as const;

type PageInfo = {
  filePath: string;
  posixRel: string;
  routePath: string;
  referenced: boolean;
  placeholder: boolean;
  contentHash: string;
};

function toPosix(p: string): string {
  return p.split(sep).join("/");
}

/** Node Dirent.name typing varies; always use a string for path joins. */
function direntName(ent: { name: string | NodeJS.ArrayBufferView }): string {
  return String(ent.name);
}

function discoverModelPages(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const n = direntName(ent);
      const full = join(d, n);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && n === "page.tsx") out.push(full);
    }
  };
  walk(dir);
  return out.sort();
}

function pageFileToRoute(pageFile: string): { routePath: string; posixRel: string } {
  const posixRel = toPosix(relative(ROOT, pageFile));
  const idx = posixRel.indexOf(MODEL_PREFIX);
  const under = idx >= 0 ? posixRel.slice(idx + MODEL_PREFIX.length) : posixRel;
  if (under === "page.tsx") {
    return { routePath: "/model", posixRel };
  }
  const dirPart = under.replace(/\/page\.tsx$/, "");
  const routePath = `/model/${dirPart}`;
  return { routePath, posixRel };
}

/** True if `routePath` (e.g. /model) is referenced without being a longer /model/... path. */
function routePathReferenced(content: string, routePath: string): boolean {
  if (routePath !== "/model") {
    return content.includes(routePath);
  }
  if (
    content.includes('"/model"') ||
    content.includes("'/model'") ||
    content.includes("`/model`") ||
    content.includes("ROUTES.model.home") ||
    content.includes("ROUTES.model.dashboard")
  ) {
    return true;
  }
  // /model followed by query, hash, quote, delimiter, or end — not /model/… or /models
  const re = /\/model(?=[\s?#'"`),;\]\}]|$)/;
  return re.test(content);
}

function posixRelReferenced(content: string, posixRel: string): boolean {
  return content.includes(posixRel);
}

function collectTsFilesRecursive(dir: string, acc: string[], limit: { n: number }) {
  if (limit.n >= MAX_SCAN_FILES) return;
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (limit.n >= MAX_SCAN_FILES) return;
    const n = direntName(ent);
    const full = join(dir, n);
    if (ent.isDirectory()) {
      if (n === "node_modules" || n === ".next") continue;
      collectTsFilesRecursive(full, acc, limit);
    } else if (ent.isFile() && (n.endsWith(".ts") || n.endsWith(".tsx"))) {
      acc.push(full);
      limit.n += 1;
    }
  }
}

function loadReferenceCorpus(): { content: string; truncated: boolean; fileCount: number } {
  const chunks: string[] = [];
  const seen = new Set<string>();
  let truncated = false;

  const addFile = (rel: string) => {
    const abs = join(ROOT, rel);
    if (seen.has(abs) || !existsSync(abs)) return;
    seen.add(abs);
    try {
      chunks.push(readFileSync(abs, "utf8"));
    } catch {
      /* skip */
    }
  };

  for (const rel of PRIORITY_FILES) addFile(rel);

  const componentsDir = join(ROOT, "components");
  if (existsSync(componentsDir)) {
    try {
      for (const ent of readdirSync(componentsDir, { withFileTypes: true })) {
        const cn = direntName(ent);
        if (ent.isFile() && cn.startsWith("model-") && cn.endsWith(".tsx")) {
          addFile(join("components", cn));
        }
      }
    } catch {
      /* skip */
    }
  }

  const scanRoots = ["app", "components", "lib"].map((d) => join(ROOT, d));
  const extra: string[] = [];
  const limit = { n: 0 };
  for (const root of scanRoots) {
    if (existsSync(root)) collectTsFilesRecursive(root, extra, limit);
  }
  if (limit.n >= MAX_SCAN_FILES) truncated = true;

  for (const abs of extra) {
    if (seen.has(abs)) continue;
    seen.add(abs);
    try {
      chunks.push(readFileSync(abs, "utf8"));
    } catch {
      /* skip */
    }
  }

  return { content: chunks.join("\n"), truncated, fileCount: seen.size };
}

function stripImports(src: string): string {
  const lines = src.split(/\r?\n/);
  const out: string[] = [];
  let inImport = false;
  for (const line of lines) {
    const t = line.trim();
    if (inImport) {
      if (t.endsWith(";") || t.endsWith("}") || (t.includes("from") && t.includes('"')) || (t.includes("from") && t.includes("'"))) {
        inImport = false;
      }
      continue;
    }
    if (t.startsWith("import ") || t.startsWith("import type ")) {
      if (!t.endsWith(";") && !line.includes(" from ")) inImport = true;
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

function isPlaceholderPage(src: string): boolean {
  const body = stripImports(src).replace(/\/\/.*$/gm, "").trim();
  if (/return\s+null\s*;/.test(body) && body.length < 400) return true;
  const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (withoutComments.length >= 200) return false;
  if (/return\s+null\s*;/.test(withoutComments)) return true;
  // Tiny stub: minimal JSX
  if (withoutComments.length < 200 && /<p[\s>]/.test(withoutComments)) return true;
  if (withoutComments.length < 120) return true;
  return false;
}

function hashContent(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

function findDuplicateHashes(pages: PageInfo[]): Map<string, string[]> {
  const by = new Map<string, string[]>();
  for (const p of pages) {
    const list = by.get(p.contentHash) ?? [];
    list.push(p.posixRel);
    by.set(p.contentHash, list);
  }
  const dups = new Map<string, string[]>();
  for (const [h, files] of by) {
    if (files.length > 1) dups.set(h, files);
  }
  return dups;
}

async function main() {
  const args = process.argv.slice(2);
  const wantDelete = args.includes("--delete");

  if (!existsSync(MODEL_DIR)) {
    console.error(`❌ Model directory missing: ${MODEL_DIR}`);
    process.exit(1);
  }

  const pageFiles = discoverModelPages(MODEL_DIR);
  const corpus = loadReferenceCorpus();

  const pages: PageInfo[] = pageFiles.map((abs) => {
    const src = readFileSync(abs, "utf8");
    const { routePath, posixRel } = pageFileToRoute(abs);
    const referenced =
      routePathReferenced(corpus.content, routePath) || posixRelReferenced(corpus.content, posixRel);
    return {
      filePath: abs,
      posixRel,
      routePath,
      referenced,
      placeholder: isPlaceholderPage(src),
      contentHash: hashContent(src),
    };
  });

  const used = pages.filter((p) => p.referenced);
  const unused = pages.filter((p) => !p.referenced);
  const placeholders = pages.filter((p) => p.placeholder);
  const unusedSolid = unused.filter((p) => !p.placeholder);

  console.log("\n📋 Model pages audit\n");
  console.log(`   Scanned reference corpus: ${corpus.fileCount} files${corpus.truncated ? " (⚠️ cap reached)" : ""}`);
  console.log(`   Pages found: ${pages.length}\n`);

  console.log("✅ Used (referenced)");
  if (used.length === 0) console.log("   (none)");
  else for (const p of used) console.log(`   • ${p.routePath}  ←  ${p.posixRel}`);

  console.log("\n🗑️  Unused");
  if (unused.length === 0) console.log("   (none)");
  else for (const p of unused) console.log(`   • ${p.routePath}  ←  ${p.posixRel}`);

  if (placeholders.length) {
    console.log("\n⚠️  Placeholder (tiny / return null — excluded from --delete)");
    for (const p of placeholders) {
      const tag = p.referenced ? "used" : "unused";
      console.log(`   • ${p.routePath}  (${tag})`);
    }
  }

  const dupMap = findDuplicateHashes(pages);
  if (dupMap.size) {
    console.log("\n📎 Duplicate content (same hash)");
    for (const files of dupMap.values()) {
      console.log(`   • ${files.join(" | ")}`);
    }
  } else {
    console.log("\n📎 Duplicates: none (by file hash)");
  }

  if (wantDelete) {
    const targets = unusedSolid;
    if (targets.length === 0) {
      console.log("\nNothing to delete (no unused non-placeholder pages).");
      process.exit(0);
    }
    console.log(`\n⚠️  Will delete ${targets.length} unused page.tsx file(s) (not placeholders).`);
    const rl = createInterface({ input, output });
    const ans = await rl.question(`Type DELETE to remove ${targets.length} files: `);
    rl.close();
    if (ans.trim() !== "DELETE") {
      console.log("Aborted (confirmation not matched).");
      process.exit(1);
    }
    for (const p of targets) {
      try {
        unlinkSync(p.filePath);
        console.log(`   Removed ${p.posixRel}`);
      } catch (e) {
        console.error(`   Failed ${p.posixRel}:`, e);
      }
    }
    console.log("\nDone.\n");
  } else {
    console.log("\n— Pass --delete to remove unused non-placeholder page.tsx files (with confirmation).\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
