/**
 * Mocked Video Analyzer checks (no live model, no sensitive clips).
 * Run: npx tsx scripts/test-video-analysis-refusal.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  analysisToIdeaContext,
  isNeutralRefusalMessage,
  manualDescriptionToIdeaContext,
  NEUTRAL_ANALYSIS_REFUSAL_MESSAGE,
  parseVideoAnalysisModelResponse,
} from "../lib/video-analysis-refusal";
import {
  informativeHashSetSimilarity,
  isLowInfoHash,
  hashSetSimilarity,
  MIN_INFORMATIVE_HASHES_FOR_DUP,
} from "../lib/video-frame-hash";
import {
  frameCountForDuration,
  isTechnicallyBlankLuma,
  sampleTimestamps,
  MIN_VIDEO_SAMPLE_FRAMES,
} from "../lib/video-frame-sampling";
import {
  ANALYSIS_STATUS_VALUES,
  VIDEO_ANALYSIS_SYSTEM_PROMPT,
  VIDEO_ANALYSIS_TOOL,
  VIDEO_ANALYSIS_TOOL_NAME,
} from "../lib/video-analysis-schema";

const RAW_REFUSAL =
  "Could not analyse. This content series focuses primarily on close-up body framing. Please resubmit content with varied framing.";

function checkSuccess() {
  const parsed = parseVideoAnalysisModelResponse(
    JSON.stringify({
      analysis_status: "ok",
      setting: "sunny balcony",
      outfit: "white sundress",
      activity: "waving at camera",
      mood_vibe: "playful",
      objects_props: ["plant"],
      visible_text: [],
      suggested_hooks: ["come say hi"],
      suggested_caption_angles: ["day-in-the-life"],
      shot_types: [
        { type: "close-up", count: 7 },
        { type: "medium", count: 2 },
        { type: "full-body", count: 1 },
      ],
      framing_variety: "low",
      camera_movement: "mostly static",
      number_of_distinct_scenes: 1,
      platform_risk: { level: "low", notes: "standard social clip" },
      attire: { coverage: "fully_clothed", notes: "sundress" },
      quality_flags: {
        blur: false,
        dark: false,
        wrong_orientation: false,
        not_9_16: false,
        watermark: false,
      },
    }),
  );
  assert.equal(parsed.refused, false);
  assert.equal(parsed.reason, "success");
  assert.equal(parsed.analysis.setting, "sunny balcony");
  assert.equal(parsed.analysis.refusal, undefined);
  assert.equal(parsed.analysis.analysis_status, "ok");
  assert.ok(parsed.analysis.shot_types?.some((s) => s.type === "close-up" && s.count === 7));
  assert.equal(parsed.analysis.framing_variety, "low");
  assert.equal(parsed.rawModelResponse, null);
  const ctx = analysisToIdeaContext(parsed.analysis);
  assert.match(ctx, /sunny balcony/);
  assert.match(ctx, /close-up/);
  assert.ok(!ctx.toLowerCase().includes("could not analyse"));
  console.log("ok success mostly close-up shot_types");
}

function checkFramesUnreadable() {
  const parsed = parseVideoAnalysisModelResponse(
    JSON.stringify({
      analysis_status: "frames_unreadable",
      setting: "",
      outfit: "",
      activity: "",
      mood_vibe: "",
      objects_props: [],
      visible_text: [],
      suggested_hooks: [],
      suggested_caption_angles: [],
      shot_types: [],
      framing_variety: "low",
      camera_movement: "unknown",
      number_of_distinct_scenes: 0,
      platform_risk: { level: "low", notes: "" },
      attire: { coverage: "unclear", notes: "" },
      quality_flags: {
        blur: false,
        dark: true,
        wrong_orientation: false,
        not_9_16: false,
        watermark: false,
      },
    }),
  );
  assert.equal(parsed.refused, true);
  assert.equal(parsed.reason, "frames_unreadable");
  assert.equal(parsed.analysis.refusal_message, NEUTRAL_ANALYSIS_REFUSAL_MESSAGE);
  assert.ok(isNeutralRefusalMessage(parsed.analysis.refusal_message));
  console.log("ok frames_unreadable");
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
  console.log("ok genuine model refusal → neutral + manual path");
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

function checkBlankFrameReplacementLogic() {
  // Near-uniform black / white = blank; textured = informative
  const black = new Array(32 * 32).fill(0);
  const white = new Array(32 * 32).fill(255);
  const textured = Array.from({ length: 32 * 32 }, (_, i) => (i % 17) * 12);
  assert.equal(isTechnicallyBlankLuma(black), true);
  assert.equal(isTechnicallyBlankLuma(white), true);
  assert.equal(isTechnicallyBlankLuma(textured), false);
  console.log("ok blank first frame replaced (technical variance)");
}

function checkLowInfoHashNoDupBanner() {
  const lowA = ["ffffffffffffffff", "0000000000000000", "ffffffffffffffff"];
  const lowB = ["ffffffffffffffff", "0000000000000000", "ffffffffffffffff"];
  assert.equal(isLowInfoHash("ffffffffffffffff"), true);
  assert.equal(isLowInfoHash("0000000000000000"), true);
  assert.equal(isLowInfoHash("a1b2c3d4e5f60718"), false);
  // Not enough informative hashes → no banner
  assert.equal(informativeHashSetSimilarity(lowA, lowB), 0);

  const informative = [
    "a1b2c3d4e5f60718",
    "1122334455667788",
    "99aabbccddeeff00",
    "ffffffffffffffff", // ignored
  ];
  const same = [
    "a1b2c3d4e5f60718",
    "1122334455667788",
    "99aabbccddeeff00",
    "0000000000000000",
  ];
  assert.ok(informativeHashSetSimilarity(informative, same) >= 90);
  assert.ok(MIN_INFORMATIVE_HASHES_FOR_DUP >= 3);
  console.log("ok low-info hash no dup banner");
}

function checkRefusedNotCountedAsAnalysed() {
  // Document product rule: findDuplicateAnalysis filters status=['success'] only.
  // Similarity helper itself is status-agnostic — callers filter by status.
  const a = ["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb", "cccccccccccccccc"];
  const b = ["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb", "cccccccccccccccc"];
  assert.equal(hashSetSimilarity(a, b), 100);
  assert.equal(informativeHashSetSimilarity(a, b), 100);
  const serviceSrc = readFileSync(
    join(process.cwd(), "services/creative-studio-video.ts"),
    "utf8",
  );
  assert.match(serviceSrc, /findBestHashMatch\(modelId, hashes, \["success"\]\)/);
  assert.match(serviceSrc, /informativeHashSetSimilarity/);
  console.log("ok refused not counted as analysed (status filter)");
}

function checkOneUsageRowPerCall() {
  const serviceSrc = readFileSync(
    join(process.cwd(), "services/creative-studio-video.ts"),
    "utf8",
  );
  assert.ok(
    !/import\s*\{[^}]*logAiUsage/.test(serviceSrc) && !/void\s+logAiUsage\s*\(/.test(serviceSrc),
    "creative-studio-video must not double-call logAiUsage (recordUsage in callAnthropicVision only)",
  );
  assert.match(serviceSrc, /callAnthropicVision/);
  assert.match(serviceSrc, /AI_ASSISTANT_MODEL/);
  assert.ok(!serviceSrc.includes("AI_FAST_MODEL"));
  console.log("ok one usage row per call (no double logAiUsage)");
}

function checkPromptSchemaNoRefusalInvite() {
  assert.ok(!VIDEO_ANALYSIS_SYSTEM_PROMPT.toLowerCase().includes("refusal:true"));
  assert.ok(!VIDEO_ANALYSIS_SYSTEM_PROMPT.includes("set refusal"));
  assert.equal(VIDEO_ANALYSIS_TOOL.name, VIDEO_ANALYSIS_TOOL_NAME);
  assert.deepEqual(ANALYSIS_STATUS_VALUES, ["ok", "frames_unreadable"]);
  const schema = VIDEO_ANALYSIS_TOOL.input_schema as {
    properties?: { analysis_status?: { enum?: string[] } };
  };
  assert.deepEqual(schema.properties?.analysis_status?.enum, ["ok", "frames_unreadable"]);
  console.log("ok forced schema / no refusal invite");
}

function checkFrameSamplingCounts() {
  assert.equal(frameCountForDuration(5), MIN_VIDEO_SAMPLE_FRAMES);
  assert.equal(frameCountForDuration(30), 10);
  assert.equal(frameCountForDuration(100), 12);
  assert.equal(frameCountForDuration(200), 14);
  const times = sampleTimestamps(10, 10);
  assert.equal(times.length, 10);
  assert.ok(times[0]! < 0.5);
  assert.ok(times[times.length - 1]! > 9);
  console.log("ok frame sampling 10+ with start/mid/end");
}

function checkMigrationRelabelsRefused() {
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20261025140000_creative_studio_video_false_refusal_fix.sql",
    ),
    "utf8",
  );
  assert.match(sql, /status = 'refused'/);
  assert.match(sql, /analysis->>'refusal'\) = 'true'/);
  assert.match(sql, /status = 'success'/);
  assert.match(sql, /sampling_meta/);
  // Condition-based — no hardcoded UUIDs
  assert.ok(!/7a12213b/.test(sql));
  assert.ok(!/b1123148/.test(sql));
  console.log("ok migration relabels refused rows");
}

function checkUiNeverShowsRaw() {
  const cases = [
    parseVideoAnalysisModelResponse(RAW_REFUSAL),
    parseVideoAnalysisModelResponse("Sorry, I cannot analyse this."),
    parseVideoAnalysisModelResponse(JSON.stringify({ refusal: true, refusal_message: RAW_REFUSAL })),
    parseVideoAnalysisModelResponse(""),
    parseVideoAnalysisModelResponse(null),
    parseVideoAnalysisModelResponse(JSON.stringify({ analysis_status: "frames_unreadable" })),
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
  checkFramesUnreadable();
  checkRefusalText();
  checkPartialRefusal();
  checkAllFramesRefused();
  checkAllFramesFailedFlag();
  checkNonJson();
  checkRefusalFlagJson();
  checkManualDescription();
  checkBlankFrameReplacementLogic();
  checkLowInfoHashNoDupBanner();
  checkRefusedNotCountedAsAnalysed();
  checkOneUsageRowPerCall();
  checkPromptSchemaNoRefusalInvite();
  checkFrameSamplingCounts();
  checkMigrationRelabelsRefused();
  checkUiNeverShowsRaw();
  console.log("\nAll video-analysis refusal / false-refusal checks passed.");
}

main();
