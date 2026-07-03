import type { WinnerVideoRecord } from "@/services/winner-videos";

export function formatCreativeScriptCopy(video: WinnerVideoRecord): string {
  const model = video.assigned_creator_name?.trim() || "—";
  const type = video.script_video_type?.trim() || "—";
  const script = video.script_text?.trim() || "—";
  return [`Model: ${model}`, `Type: ${type}`, "", script].join("\n");
}
