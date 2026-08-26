/**
 * One-shot: cache Winner Hub thumbnails that still point at ephemeral IG CDN URLs.
 * Uses current clariosuite_top_posts.image_url (must be freshly synced).
 *
 * Usage: npx tsx scripts/backfill-winner-thumbnails.ts
 */
import { config as loadEnv } from "dotenv";
import "./_polyfill-websocket";
loadEnv({ path: ".env.local" });
loadEnv();
process.env.DATA_BACKEND = "supabase";

import { refreshWinnerThumbnailsFromTopPosts } from "../services/winner-auto-detect";

async function main() {
  const result = await refreshWinnerThumbnailsFromTopPosts();
  console.log(
    JSON.stringify(
      {
        scanned: result.scanned,
        cached: result.cached,
        skipped: result.skipped,
        errors: result.errors,
      },
      null,
      2,
    ),
  );
  if (result.errors.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
