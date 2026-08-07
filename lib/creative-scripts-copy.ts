import type { WinnerVideoRecord } from "@/services/winner-videos";

export function formatCreativeScriptCopy(video: WinnerVideoRecord): string {
  const model = video.assigned_creator_name?.trim() || "—";
  const type = video.script_video_type?.trim() || "—";
  const script = video.script_text?.trim() || "—";
  const tos = video.text_on_screen_suggestion?.trim();
  const brief = video.script_brief?.trim();
  const lines = [`Model: ${model}`, `Type: ${type}`, "", script];
  if (tos) {
    lines.push("", "--- Text on Screen Suggestion ---", tos);
  }
  if (brief) {
    lines.push("", "--- Brief ---", brief);
  }
  const briefFile = video.script_brief_attachment_url?.trim();
  if (briefFile) {
    lines.push(
      "",
      "--- Brief attachment ---",
      video.script_brief_attachment_filename?.trim() || briefFile,
    );
  }
  return lines.join("\n");
}
