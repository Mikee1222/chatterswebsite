/**
 * Mocked Video Analyzer refusal-handling checks (no live model, no explicit material).
 * Run: npx tsx scripts/test-video-analysis-refusal.ts
 */
import assert from "node:assert/strict";
import {
  analysisToIdeaContext,
  isNeutralRefusalMessage,
  manualDescriptionToIdeaContext,
  NEUTRAL_ANALYSIS_REFUSAL_MESSAGE,
  parseVideoAnalysisModelResponse,
} from "../lib/video-analysis-refusal";
import { hashSetSimilarity } from "../lib/video-frame-hash";

const RAW_REFUSAL =
  "Could not analyse. This content series focuses primarily on close-up body framing. Please resubmit content with varied framing.";

function checkSuccess() {
  const parsed = parseVideoAnalysisModelResponse(
    JSON.stringify({
      setting: "sunny balcony",
      outfit: "white sundress",
      activity: "waving at camera",
      mood_vibe: "playful",
      objects_props: ["plant"],
      visible_text: [],
      suggested_hooks: ["come say hi"],
      suggested_caption_angles: ["day-in-the-life"],
    }),
  );
  assert.equal(parsed.refused, false);
  assert.equal(parsed.reason, "success");
  assert.equal(parsed.analysis.setting, "sunny balcony");
  assert.equal(parsed.analysis.refusal, undefined);
  assert.equal(parsed.rawModelResponse, null);
  const ctx = analysisToIdeaContext(parsed.analysis);
  assert.match(ctx, /sunny balcony/);
  assert.ok(!ctx.toLowerCase().includes("could not analyse"));
  console.log("ok success");
}

function checkRefusalText() {
  const parsed = parseVideoAnalysisModelResponse(RAW_REFUSAL);
  assert.equal(parsed.refused, true);
  assert.ok(parsed.reason === "refusal_text" || parsed.reason === "non_json");
  assert.equal(parsed.analysis.refusal, true);
  assert.equal(parsed.analysis.refusal_message, NEUTRAL_ANALYSIS_REFUSAL_MESSAGE);
  assert.ok(isNeutralRefusalMessage(parsed.analysis.refusal_message));
  // Raw stored internally — never the user-facing message
  assert.ok(parsed.rawModelResponse?.includes("close-up body framing"));
  assert.ok(!NEUTRAL_ANALYSIS_REFUSAL_MESSAGE.includes("close-up body framing"));
  assert.equal(analysisToIdeaContext(parsed.analysis), "");
  console.log("ok refusal text");
}

function checkPartialRefusal() {
  const parsed = parseVideoAnalysisModelResponse(
    JSON.stringify({
      frame_analyses: [
        {
          ok: true,
          setting: "kitchen",
          outfit: "hoodie",
          activity: "making coffee",
          mood_vibe: "casual",
        },
        { ok: false, refusal: true, refusal_message: "unable to analyse this frame" },
        { refused: true },
      ],
    }),
  );
  assert.equal(parsed.refused, false);
  assert.equal(parsed.reason, "partial_refusal");
  assert.equal(parsed.analysis.setting, "kitchen");
  assert.equal(parsed.analysis.outfit, "hoodie");
  assert.ok(!String(parsed.analysis.refusal_message ?? "").includes("unable to analyse"));
  console.log("ok partial refusal");
}

function checkAllFramesRefused() {
  const parsed = parseVideoAnalysisModelResponse(
    JSON.stringify({
      frames: [
        { refusal: true },
        { ok: false },
        { refused: true, refusal_message: RAW_REFUSAL },
      ],
    }),
  );
  assert.equal(parsed.refused, true);
  assert.equal(parsed.reason, "all_frames_failed");
  assert.equal(parsed.analysis.refusal_message, NEUTRAL_ANALYSIS_REFUSAL_MESSAGE);
  assert.ok(!JSON.stringify(parsed.analysis).includes("close-up body"));
  console.log("ok all frames refused");
}

function checkAllFramesFailedFlag() {
  const parsed = parseVideoAnalysisModelResponse(null, { allFramesFailed: true });
  assert.equal(parsed.refused, true);
  assert.equal(parsed.reason, "all_frames_failed");
  assert.equal(parsed.analysis.refusal_message, NEUTRAL_ANALYSIS_REFUSAL_MESSAGE);
  console.log("ok allFramesFailed option");
}

function checkNonJson() {
  const parsed = parseVideoAnalysisModelResponse("not json at all — just prose about a clip");
  assert.equal(parsed.refused, true);
  assert.equal(parsed.reason, "non_json");
  assert.equal(parsed.analysis.refusal_message, NEUTRAL_ANALYSIS_REFUSAL_MESSAGE);
  assert.ok(parsed.rawModelResponse?.includes("not json"));
  console.log("ok non-json");
}

function checkRefusalFlagJson() {
  const parsed = parseVideoAnalysisModelResponse(
    JSON.stringify({
      refusal: true,
      refusal_message: RAW_REFUSAL,
    }),
  );
  assert.equal(parsed.refused, true);
  assert.equal(parsed.reason, "refusal_flag");
  assert.equal(parsed.analysis.refusal_message, NEUTRAL_ANALYSIS_REFUSAL_MESSAGE);
  assert.ok(parsed.rawModelResponse?.includes("close-up"));
  console.log("ok refusal flag json");
}

function checkManualDescription() {
  const ctx = manualDescriptionToIdeaContext({
    whatHappens: "smiling and waving",
    setting: "park bench",
    outfit: "jeans and tee",
    mood: "cheerful",
    props: "coffee cup",
    visibleText: "hello",
  });
  assert.match(ctx, /\[from your description\]/);
  assert.match(ctx, /smiling and waving/);
  assert.match(ctx, /park bench/);
  assert.match(ctx, /jeans and tee/);
  console.log("ok manual description");
}

function checkDuplicateHashLogicNotes() {
  // Document expected product rule: only success hashes should match as "analysed".
  // Similarity helper itself is status-agnostic — callers filter by status.
  const a = ["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb"];
  const b = ["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb"];
  assert.equal(hashSetSimilarity(a, b), 100);
  console.log("ok hash similarity helper");
}

function checkUiNeverShowsRaw() {
  const cases = [
    parseVideoAnalysisModelResponse(RAW_REFUSAL),
    parseVideoAnalysisModelResponse("Sorry, I cannot analyse this."),
    parseVideoAnalysisModelResponse(JSON.stringify({ refusal: true, refusal_message: RAW_REFUSAL })),
    parseVideoAnalysisModelResponse(""),
    parseVideoAnalysisModelResponse(null),
  ];
  for (const p of cases) {
    assert.equal(p.refused, true);
    assert.equal(p.analysis.refusal_message, NEUTRAL_ANALYSIS_REFUSAL_MESSAGE);
    const blob = JSON.stringify(p.analysis);
    assert.ok(!blob.includes("close-up body"));
    assert.ok(!blob.includes("Please resubmit"));
  }
  console.log("ok UI-safe analysis payload");
}

function main() {
  checkSuccess();
  checkRefusalText();
  checkPartialRefusal();
  checkAllFramesRefused();
  checkAllFramesFailedFlag();
  checkNonJson();
  checkRefusalFlagJson();
  checkManualDescription();
  checkDuplicateHashLogicNotes();
  checkUiNeverShowsRaw();
  console.log("\nAll video-analysis refusal checks passed.");
}

main();
