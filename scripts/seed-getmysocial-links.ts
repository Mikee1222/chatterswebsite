/**
 * Seed GetMySocial Link A/B mappings for Silia/Lina/Frika/Frost/Lydia.
 * Resolves model_id from modelss by exact name (airtable_id preferred via publicId).
 *
 * Usage: npx tsx scripts/seed-getmysocial-links.ts
 */

import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { publicId } from "@/lib/supabase-data";

const SEED: Array<{
  modelName: string;
  role: "A" | "B";
  linkId: string;
  shortcode: string;
  label: string;
  ofHint: string;
}> = [
  {
    modelName: "Silia",
    role: "A",
    linkId: "lnk_69ddd2775be2a494e5818c1c",
    shortcode: "siliamenegaki",
    label: "Silia Link A",
    ofHint: "onlyfans.com/silia.menegaki/c6",
  },
  {
    modelName: "Silia",
    role: "B",
    linkId: "lnk_6a8213da5446911b489bd533",
    shortcode: "vasiliamenegaki",
    label: "Silia Link B",
    ofHint: "onlyfans.com/silia.menegaki/c6",
  },
  {
    modelName: "Lina",
    role: "A",
    linkId: "lnk_69dd9aefde24559d5daac431",
    shortcode: "linaki",
    label: "Lina Link A",
    ofHint: "onlyfans.com/linakii/c23",
  },
  {
    modelName: "Lina",
    role: "B",
    linkId: "lnk_6a82137a5446911b489bcbb0",
    shortcode: "melinagnkp",
    label: "Lina Link B",
    ofHint: "onlyfans.com/linakii/c23",
  },
  {
    modelName: "Frika",
    role: "A",
    linkId: "lnk_69ddb533de24559d5db0f96a",
    shortcode: "missfrika",
    label: "Frika Link A",
    ofHint: "onlyfans.com/missfrika/c12",
  },
  {
    modelName: "Frika",
    role: "B",
    linkId: "lnk_6a0dd6f1a5835045d49bdb6e",
    shortcode: "frika",
    label: "Frika Link B",
    ofHint: "onlyfans.com/missfrika/c16",
  },
  {
    modelName: "Frost",
    role: "A",
    linkId: "lnk_69ddcb0f224b77d287ce3336",
    shortcode: "frost",
    label: "Frost Link A",
    ofHint: "onlyfans.com/zhannafrostt/c20",
  },
  {
    modelName: "Frost",
    role: "B",
    linkId: "lnk_6a08155d8e155f9f4734d311",
    shortcode: "missfrost",
    label: "Frost Link B",
    ofHint: "onlyfans.com/zhannafrostt/c24",
  },
  {
    modelName: "Lydia",
    role: "A",
    linkId: "lnk_69ddbc3ede24559d5db2bd5e",
    shortcode: "lydiafwt",
    label: "Lydia Link A",
    ofHint: "onlyfans.com/lydiafwt/c22",
  },
  {
    modelName: "Lydia",
    role: "B",
    linkId: "lnk_69e0f0b1bf2a1d59ef0d9375",
    shortcode: "lydiaki",
    label: "Lydia Link B",
    ofHint: "onlyfans.com/lydiafwt/c22",
  },
];

async function main() {
  const sb = getSupabaseServiceClient();
  const names = [...new Set(SEED.map((s) => s.modelName))];
  const { data: models, error } = await sb
    .from("modelss")
    .select("id,airtable_id,model_id,model_name")
    .in("model_name", names);
  if (error) throw new Error(error.message);

  const byName = new Map<string, { id: string; airtable_id: string | null; model_name: string }>();
  for (const m of models ?? []) {
    byName.set(String(m.model_name), {
      id: String(m.id),
      airtable_id: (m.airtable_id as string | null) ?? null,
      model_name: String(m.model_name),
    });
  }

  const missing = names.filter((n) => !byName.has(n));
  if (missing.length) {
    console.error("Missing models:", missing.join(", "));
    process.exit(1);
  }

  const now = new Date().toISOString();
  const rows = SEED.map((s) => {
    const m = byName.get(s.modelName)!;
    return {
      model_id: publicId(m),
      getmysocial_link_id: s.linkId,
      link_role: s.role,
      link_label: s.label,
      shortcode: s.shortcode,
      of_destination_hint: s.ofHint,
      is_primary: s.role === "A",
      updated_at: now,
    };
  });

  const { data, error: upsertErr } = await sb
    .from("getmysocial_links")
    .upsert(rows, { onConflict: "getmysocial_link_id" })
    .select("model_id,getmysocial_link_id,link_role,shortcode,link_label");
  if (upsertErr) throw new Error(upsertErr.message);

  console.log(`Seeded ${data?.length ?? 0} GetMySocial links:`);
  for (const r of data ?? []) {
    console.log(
      `  ${r.link_role} ${r.shortcode} (${r.getmysocial_link_id}) → model ${r.model_id}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
