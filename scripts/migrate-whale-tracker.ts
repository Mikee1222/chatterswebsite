#!/usr/bin/env node
/**
 * One-off hardcoded migration: PATCH whales.assignments from Whale Tracker intent.
 *
 *   npx tsx scripts/migrate-whale-tracker.ts
 *   npx tsx scripts/migrate-whale-tracker.ts --dry-run
 *
 * Requires AIRTABLE_TOKEN and AIRTABLE_BASE_ID in .env (loaded via dotenv/config).
 */

import "dotenv/config";

const WHALES_TABLE = "whales";
const USERS_TABLE = "users";
const MODELSS_TABLE = "modelss";

const DRY_RUN = process.argv.includes("--dry-run");

const AIRTABLE_API = "https://api.airtable.com/v0";

const CHATTER_NAMES = [
  "Hlias Zarifes",
  "Giannis Katsikas",
  "Anastasis Haroupas",
  "Panos Nanos",
] as const;

const MODEL_NAMES = [
  "Frost",
  "Lydia",
  "Silia",
  "Marillia",
  "Frika",
  "Lina",
  "Diana",
  "Eirini",
  "Stefania",
] as const;

/** username → chatter full_name, model display name (null = do not set / skip model). */
const WHALE_ASSIGNMENTS: { username: string; chatter: string; model: string | null }[] = [
  { username: "apostolos kousathanas@u181154924", chatter: "Hlias Zarifes", model: "Silia" },
  { username: "P@u392048533", chatter: "Hlias Zarifes", model: "Silia" },
  { username: "Mike@mikevi90", chatter: "Anastasis Haroupas", model: "Silia" },
  { username: "Michos@u488216041", chatter: "Giannis Katsikas", model: "Silia" },
  { username: "DG@u166229549", chatter: "Hlias Zarifes", model: "Silia" },
  { username: "Terry@u508241562", chatter: "Hlias Zarifes", model: "Silia" },
  { username: "Kostas_A@1980@u413977443", chatter: "Anastasis Haroupas", model: "Silia" },
  { username: "Valerios@u20166052", chatter: "Giannis Katsikas", model: "Silia" },
  { username: "Yianni@u437503718", chatter: "Giannis Katsikas", model: "Silia" },
  { username: "Asygrathtos@u338518335", chatter: "Hlias Zarifes", model: "Silia" },
  { username: "Cool dude@u330822990", chatter: "Anastasis Haroupas", model: "Marillia" },
  { username: "LFPG@u187164600", chatter: "Hlias Zarifes", model: "Marillia" },
  { username: "George @u432065551", chatter: "Hlias Zarifes", model: "Frost" },
  { username: "Gus32 @kitr90", chatter: "Panos Nanos", model: "Frost" },
  { username: "kalakis @kalakis", chatter: "Hlias Zarifes", model: "Frost" },
  { username: "ΣΑΚΗΣ @sakis42", chatter: "Hlias Zarifes", model: "Frost" },
  { username: "LoveDr @u259489555", chatter: "Anastasis Haroupas", model: "Frost" },
  { username: "@klau_147", chatter: "Hlias Zarifes", model: "Lina" },
  { username: "mdmb @u271803829", chatter: "Hlias Zarifes", model: "Lina" },
  { username: "ΑΝΤΩΝΙΟΣ ΦΛΩΡΟΣ @u489479789", chatter: "Hlias Zarifes", model: "Lina" },
  { username: "Dimos1313@u494800275", chatter: "Anastasis Haroupas", model: "Lydia" },
  { username: "Geo@u44242873", chatter: "Giannis Katsikas", model: "Lydia" },
  { username: "Pan Tak@u19194144", chatter: "Anastasis Haroupas", model: "Lydia" },
  { username: "Diavolsd@u262767164", chatter: "Anastasis Haroupas", model: "Lydia" },
  { username: "@renovaltio", chatter: "Hlias Zarifes", model: "Lydia" },
  { username: "Lef@u372156824", chatter: "Anastasis Haroupas", model: "Lydia" },
  { username: "@u281314271", chatter: "Anastasis Haroupas", model: "Lydia" },
  { username: "@u439826363", chatter: "Anastasis Haroupas", model: "Lydia" },
  { username: "@u99595648", chatter: "Panos Nanos", model: "Lydia" },
  { username: "Seawolf @u451366997", chatter: "Hlias Zarifes", model: "Frika" },
  { username: "EmeraldBoi @emeraldboi", chatter: "Hlias Zarifes", model: "Frika" },
  { username: "Manolis Elenis @u307255037", chatter: "Anastasis Haroupas", model: "Frika" },
  { username: "Aeton M @u147397304", chatter: "Hlias Zarifes", model: "Frika" },
  { username: "@kritis1234", chatter: "Anastasis Haroupas", model: "Frika" },
  { username: "Untamed GaiusM @u115383316", chatter: "Panos Nanos", model: "Frika" },
  { username: "sleep_not @u366188582", chatter: "Hlias Zarifes", model: "Frika" },
  { username: "Qiu Tee@u357874293", chatter: "Giannis Katsikas", model: "Frost" },
  { username: "Mo@u391265447", chatter: "Panos Nanos", model: "Lina" },
  { username: "Laclover@u372133453", chatter: "Hlias Zarifes", model: "Stefania" },
  { username: "George@u527408905", chatter: "Anastasis Haroupas", model: "Stefania" },
  { username: "ANASTASIOS@u527651438", chatter: "Anastasis Haroupas", model: "Eirini" },
  { username: "ChaCha @u536384206", chatter: "Giannis Katsikas", model: "Diana" },
  { username: "alexander zodiac @u311706862", chatter: "Hlias Zarifes", model: "Diana" },
  { username: "Kafros@u136481952", chatter: "Giannis Katsikas", model: "Eirini" },
  { username: "Loizos Kkountis @u130394200", chatter: "Hlias Zarifes", model: "Diana" },
  { username: "Eua Kaliki @u389109199", chatter: "Hlias Zarifes", model: "Lina" },
  { username: "@originalkrazyking", chatter: "Hlias Zarifes", model: "Frika" },
  { username: "Skulix@u405663684", chatter: "Anastasis Haroupas", model: "Diana" },
  { username: "stavris@u55615654", chatter: "Anastasis Haroupas", model: "Diana" },
  { username: "Ken@u479578412", chatter: "Hlias Zarifes", model: "Diana" },
  { username: "Apo@u417897256", chatter: "Panos Nanos", model: "Marillia" },
  { username: "For Pipatsou@u90163311", chatter: "Giannis Katsikas", model: "Marillia" },
  { username: "supernova from outta space@supernova55", chatter: "Giannis Katsikas", model: "Diana" },
  { username: "epow318@u266620439", chatter: "Hlias Zarifes", model: "Silia" },
  { username: "Aylon7777@u314057260", chatter: "Giannis Katsikas", model: "Eirini" },
  { username: "Mik@u211256248", chatter: "Anastasis Haroupas", model: "Frost" },
  { username: "Takis@u527041798", chatter: "Hlias Zarifes", model: "Silia" },
  { username: "Mangas@u408862937", chatter: "Hlias Zarifes", model: "Silia" },
  { username: "Νίκος Κατσαρός@u77938483", chatter: "Hlias Zarifes", model: "Silia" },
  { username: "Jim the sheep owner@daraios", chatter: "Anastasis Haroupas", model: "Frost" },
  { username: "Xristoforos@xristoforos1994", chatter: "Anastasis Haroupas", model: "Diana" },
  { username: "Shummys@u328113213", chatter: "Hlias Zarifes", model: "Diana" },
  { username: "Geo Theo@u339936915", chatter: "Hlias Zarifes", model: "Diana" },
  { username: "Nikos@nikolas00", chatter: "Anastasis Haroupas", model: "Diana" },
  { username: "Xaris@u362087838", chatter: "Giannis Katsikas", model: "Diana" },
  { username: "Pantelis@u132327871", chatter: "Anastasis Haroupas", model: "Diana" },
  { username: "TravellerBoy@u10663863", chatter: "Hlias Zarifes", model: "Diana" },
  { username: "Peter ford@u178762062", chatter: "Giannis Katsikas", model: "Diana" },
  { username: "Jay@u541124613", chatter: "Giannis Katsikas", model: "Frika" },
  { username: "Gas Coral@u546493663", chatter: "Hlias Zarifes", model: "Eirini" },
  { username: "pavlos m94@pavlosm94", chatter: "Giannis Katsikas", model: "Silia" },
  { username: "janni", chatter: "Anastasis Haroupas", model: "Frost" },
  { username: "Stratos@u552844142", chatter: "Giannis Katsikas", model: "Lina" },
  { username: "🏍️@u530242785", chatter: "Anastasis Haroupas", model: "Diana" },
  { username: "Eldrins@u553490650", chatter: "Hlias Zarifes", model: "Lina" },
  { username: "@u16040418", chatter: "Hlias Zarifes", model: "Marillia" },
  { username: "@u177900636", chatter: "Hlias Zarifes", model: "Lina" },
  { username: "Ntinoss@kostantinosss", chatter: "Giannis Katsikas", model: "Frost" },
  { username: "Christod@u463085406", chatter: "Giannis Katsikas", model: "Silia" },
  { username: "Apostolispap@u460105728", chatter: "Giannis Katsikas", model: "Silia" },
  { username: "Lefty@leftygkoumas", chatter: "Hlias Zarifes", model: "Marillia" },
  { username: "A.b.@u412847247", chatter: "Hlias Zarifes", model: "Marillia" },
  { username: "Tasos@u554565399", chatter: "Giannis Katsikas", model: "Frost" },
  { username: "Peter@u554738919", chatter: "Giannis Katsikas", model: "Frost" },
  { username: "Μαρκελος", chatter: "Anastasis Haroupas", model: "Silia" },
  { username: "Vincent", chatter: "Anastasis Haroupas", model: "Frost" },
  { username: "Stef@u113251900", chatter: "Giannis Katsikas", model: "Silia" },
  { username: "Xaris anthis", chatter: "Anastasis Haroupas", model: "Frika" },
  { username: "Peter@u377303009", chatter: "Giannis Katsikas", model: "Diana" },
  { username: "Arnold@u320619023", chatter: "Giannis Katsikas", model: "Marillia" },
  { username: "Sotiris Dimopoulos@steez69", chatter: "Giannis Katsikas", model: "Eirini" },
  {
    username: "παανγιωτης case study H Maestro@u367451770",
    chatter: "Hlias Zarifes",
    model: "Eirini",
  },
  { username: "chryvas@u317735934", chatter: "Hlias Zarifes", model: "Eirini" },
  {
    username: "νασος case study H nassos roussos@u544303078",
    chatter: "Hlias Zarifes",
    model: "Frost",
  },
  { username: "Citizen Pan@u550833711", chatter: "Giannis Katsikas", model: null },
  { username: "CK", chatter: "Anastasis Haroupas", model: "Diana" },
  { username: "Α.Τ", chatter: "Anastasis Haroupas", model: "Lydia" },
  { username: "Untamed gaius", chatter: "Anastasis Haroupas", model: "Frika" },
  { username: "xtrm1911", chatter: "Anastasis Haroupas", model: "Diana" },
];

function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function normalizeUsername(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function getConfig(): { baseId: string; token: string } {
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!baseId || !token) {
    throw new Error("AIRTABLE_BASE_ID and AIRTABLE_TOKEN must be set in environment (.env)");
  }
  return { baseId, token };
}

type AirtableRecord = { id: string; fields: Record<string, unknown> };

async function listAllRecords(table: string): Promise<AirtableRecord[]> {
  const { baseId, token } = getConfig();
  const out: AirtableRecord[] = [];
  let offset: string | undefined;
  for (;;) {
    const qs = new URLSearchParams();
    if (offset) qs.set("offset", offset);
    const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(table)}?${qs}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const text = await res.text();
    if (!res.ok) throw new Error(`Airtable ${table} list ${res.status}: ${text}`);
    const data = JSON.parse(text) as { records?: { id: string; fields: Record<string, unknown> }[]; offset?: string };
    const recs = data.records ?? [];
    for (const r of recs) out.push({ id: r.id, fields: r.fields });
    offset = data.offset;
    if (!offset) break;
  }
  return out;
}

async function patchRecord(
  table: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const { baseId, token } = getConfig();
  const url = `${AIRTABLE_API}/${baseId}/${encodeURIComponent(table)}/${recordId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Airtable PATCH ${table}/${recordId} ${res.status}: ${text}`);
}

function buildUserMaps(records: AirtableRecord[]): {
  byFullName: Map<string, { id: string; chatterName: string }>;
} {
  const byFullName = new Map<string, { id: string; chatterName: string }>();
  for (const r of records) {
    const f = r.fields;
    const full = str(f.full_name);
    const nm = str(f.name);
    const label = full || nm;
    if (!label) continue;
    byFullName.set(label, { id: r.id, chatterName: full || nm });
  }
  return { byFullName };
}

function buildModelMaps(records: AirtableRecord[]): Map<string, { id: string; modelName: string }> {
  const byLabel = new Map<string, { id: string; modelName: string }>();
  for (const r of records) {
    const f = r.fields;
    const modelName = str(f.model_name);
    const name = str(f.name);
    const primary = modelName || name;
    if (!primary) continue;
    byLabel.set(primary, { id: r.id, modelName: primary });
    if (name && name !== primary) byLabel.set(name, { id: r.id, modelName: primary });
    if (modelName && modelName !== primary) byLabel.set(modelName, { id: r.id, modelName: primary });
  }
  return byLabel;
}

function buildWhaleByUsername(records: AirtableRecord[]): Map<string, { id: string; username: string }> {
  const m = new Map<string, { id: string; username: string }>();
  for (const r of records) {
    const u = str(r.fields.username);
    if (!u) continue;
    m.set(normalizeUsername(u), { id: r.id, username: u });
  }
  return m;
}

function assertChatterNamesResolved(byFullName: Map<string, { id: string; chatterName: string }>): void {
  for (const n of CHATTER_NAMES) {
    if (!byFullName.has(n)) {
      throw new Error(
        `users table: no row with full_name (or name) exactly "${n}". Found keys sample: ${[...byFullName.keys()].slice(0, 8).join(", ")}`
      );
    }
  }
}

function assertModelNamesResolved(byLabel: Map<string, { id: string; modelName: string }>): void {
  for (const n of MODEL_NAMES) {
    if (!byLabel.has(n)) {
      throw new Error(
        `modelss table: no row with model_name/name matching "${n}". Found keys sample: ${[...byLabel.keys()].slice(0, 12).join(", ")}`
      );
    }
  }
}

async function main(): Promise<void> {
  if (DRY_RUN) console.log("=== DRY RUN (no PATCH requests) ===\n");

  console.log("Fetching users…");
  const userRecs = await listAllRecords(USERS_TABLE);
  const { byFullName: userByFullName } = buildUserMaps(userRecs);
  assertChatterNamesResolved(userByFullName);
  console.log(`  ${userRecs.length} row(s); resolved ${CHATTER_NAMES.length} chatter name(s)\n`);

  console.log("Fetching modelss…");
  const modelRecs = await listAllRecords(MODELSS_TABLE);
  const modelByLabel = buildModelMaps(modelRecs);
  assertModelNamesResolved(modelByLabel);
  console.log(`  ${modelRecs.length} row(s); resolved ${MODEL_NAMES.length} model name(s)\n`);

  console.log("Fetching whales…");
  const whaleRecs = await listAllRecords(WHALES_TABLE);
  const whaleByNorm = buildWhaleByUsername(whaleRecs);
  console.log(`  ${whaleRecs.length} row(s); ${whaleByNorm.size} indexed by normalized username\n`);

  let patched = 0;
  let dryWould = 0;
  let whaleNotFound = 0;
  let errors = 0;

  for (const row of WHALE_ASSIGNMENTS) {
    const key = normalizeUsername(row.username);
    const whale = whaleByNorm.get(key);
    if (!whale) {
      whaleNotFound++;
      console.log(`SKIP whale not found: ${JSON.stringify(row.username)}`);
      continue;
    }

    const chatter = userByFullName.get(row.chatter);
    if (!chatter) {
      errors++;
      console.error(`FAIL no user for chatter name: ${row.chatter}`);
      continue;
    }

    let model: { id: string; modelName: string } | null = null;
    if (row.model != null) {
      model = modelByLabel.get(row.model) ?? null;
      if (!model) {
        errors++;
        console.error(`FAIL no model for: ${row.model} (whale ${row.username})`);
        continue;
      }
    }

    const fields: Record<string, unknown> = {
      assigned_chatter: [chatter.id],
      assigned_chatter_name: chatter.chatterName,
    };
    if (model) {
      fields.assigned_model = [model.id];
      fields.assigned_model_name = model.modelName;
    }

    try {
      if (DRY_RUN) {
        dryWould++;
        console.log(
          `DRY-RUN PATCH ${whale.username} → chatter=${row.chatter} (${chatter.id})` +
            (model ? ` model=${row.model} (${model.id})` : " model=(skip)")
        );
      } else {
        await patchRecord(WHALES_TABLE, whale.id, fields);
        patched++;
        console.log(`OK ${whale.username} → whales/${whale.id}`);
      }
    } catch (e) {
      errors++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`FAIL ${row.username}: ${msg}`);
    }
  }

  console.log("\n========== SUMMARY ==========");
  console.log(`Assignments in list:     ${WHALE_ASSIGNMENTS.length}`);
  if (DRY_RUN) console.log(`Would PATCH:              ${dryWould}`);
  else console.log(`Successfully PATCHed:     ${patched}`);
  console.log(`Whale username not found: ${whaleNotFound}`);
  console.log(`Errors:                   ${errors}`);
  console.log("==============================\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
