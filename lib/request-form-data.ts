import { NextResponse } from "next/server";

/**
 * Parse multipart request body. Returns a 400 JSON response when the body is
 * not valid multipart (missing/mismatched boundary, empty body, etc.).
 */
export async function readRequestFormData(
  req: Request
): Promise<FormData | NextResponse> {
  try {
    return await req.formData();
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.cause instanceof Error
          ? err.cause.message
          : err.message
        : String(err);
    console.error("[readRequestFormData] FormData parse failed:", detail);
    return NextResponse.json(
      {
        error:
          "Invalid upload body (multipart parse failed). Try again without forcing Content-Type.",
      },
      { status: 400 }
    );
  }
}
