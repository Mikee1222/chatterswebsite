/**
 * Prove Move-into-bunch picker would show options with provided_count gate
 * (vs soft remaining_count which is currently 0 for all open bunches).
 */
import { config as loadEnv } from "dotenv";
import "./_polyfill-websocket";
loadEnv({ path: ".env.local" });
loadEnv();
process.env.DATA_BACKEND = "supabase";
import { listVideoBunches } from "../services/winner-sourcing";

async function main() {
  const bunches = await listVideoBunches();
  const open = bunches.filter((b) => b.status === "open");
  const soft = open.filter((b) => (b.remaining_count ?? 0) > 0);
  const slotRoom = open.filter((b) => (b.provided_count ?? 0) < b.target_video_count);
  console.log(
    JSON.stringify(
      {
        open: open.length,
        softRemainingGt0: soft.length,
        slotRoomGt0: slotRoom.length,
        softNames: soft.map((b) => b.name),
        slotRoomTargets: slotRoom.map((b) => ({
          name: b.name,
          model: b.model_name,
          provided: b.provided_count,
          target: b.target_video_count,
          remaining_soft: b.remaining_count,
          slot_room: b.target_video_count - (b.provided_count ?? 0),
        })),
      },
      null,
      2,
    ),
  );
  if (slotRoom.length < 1) throw new Error("Expected at least one bunch with approved-slot room");
  if (soft.length === 0 && slotRoom.length > 0) {
    console.log("OK — old filter empty; new provided_count filter has options.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
