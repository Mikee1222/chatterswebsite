import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  generateCaptions,
  generateTextOnScreen,
} from "@/services/creative-studio";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.CREATIVE_STUDIO_USE))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    mode?: "captions" | "text_on_screen";
    modelId?: string;
    platform?: string;
    format?: string;
    ideaContext?: string;
    toneTweak?: string;
    variations?: number;
    hashtagCount?: number;
    maxChars?: number;
    outputLanguage?: string;
  };

  const modelId = body.modelId?.trim();
  if (!modelId) return Response.json({ error: "modelId required" }, { status: 400 });

  const userId = session.airtableUserId ?? session.id;

  try {
    if (body.mode === "text_on_screen") {
      const result = await generateTextOnScreen({
        modelId,
        ideaContext: body.ideaContext,
        toneTweak: body.toneTweak,
        maxChars: body.maxChars,
        variations: body.variations,
        outputLanguage: body.outputLanguage,
        userId,
      });
      return Response.json(result);
    }

    const result = await generateCaptions({
      modelId,
      platform: body.platform?.trim() || "Instagram",
      format: body.format,
      ideaContext: body.ideaContext,
      toneTweak: body.toneTweak,
      variations: body.variations,
      hashtagCount: body.hashtagCount,
      outputLanguage: body.outputLanguage,
      userId,
    });
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    const status = msg.includes("Rate limit") ? 429 : 500;
    return Response.json({ error: msg }, { status });
  }
}
