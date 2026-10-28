import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  resolveSttProvider,
  STT_MAX_FILE_BYTES,
  transcribeMedia,
} from "@/lib/speech-to-text";
import { assertCreativeRateLimit } from "@/services/creative-studio";

export const maxDuration = 120;

/**
 * POST multipart/form-data { file, language? }
 * Streams the clip to the speech-to-text provider; nothing is stored here.
 */
export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_STUDIO_USE))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!resolveSttProvider()) {
    return Response.json(
      {
        error:
          "Transcription is not configured. Ask the admin to set OPENAI_API_KEY (or GROQ_API_KEY).",
        code: "stt_not_configured",
      },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > STT_MAX_FILE_BYTES) {
    return Response.json(
      {
        error: `Video is too large for transcription (max ${Math.round(STT_MAX_FILE_BYTES / 1024 / 1024)} MB). Trim or compress it.`,
        code: "file_too_large",
      },
      { status: 413 },
    );
  }

  const language = String(form?.get("language") ?? "").trim().slice(0, 8) || undefined;
  const filename =
    file instanceof File && file.name ? file.name.replace(/[^\w.\-]/g, "_").slice(0, 120) : "video.mp4";

  try {
    await assertCreativeRateLimit(session.airtableUserId ?? session.id);
    const result = await transcribeMedia({ file, filename, language });
    return Response.json({
      text: result.text,
      segments: result.segments,
      language: result.language,
      durationSec: result.durationSec,
      sttModel: `${result.provider}:${result.model}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Transcription failed";
    if (msg.includes("Rate limit")) return Response.json({ error: msg }, { status: 429 });
    if (msg === "FILE_TOO_LARGE") {
      return Response.json({ error: "Video too large", code: "file_too_large" }, { status: 413 });
    }
    console.error("[creative-studio] transcribe failed", msg);
    return Response.json({ error: "Transcription failed. Try again or paste the words manually." }, { status: 502 });
  }
}
