#!/usr/bin/env tsx
/**
 * Seeds modelss payment method fields from known model mappings.
 * Usage: npx tsx scripts/seed-model-payment-methods.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv();
loadEnv({ path: ".env.local" });

const TOKEN = process.env.AIRTABLE_TOKEN?.trim();
const BASE_ID = process.env.AIRTABLE_BASE_ID?.trim();
if (!TOKEN || !BASE_ID) { console.error("Missing env vars"); process.exit(1); }

const API = `https://api.airtable.com/v0/${BASE_ID}`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

type SeedRow = {
  id: string;
  name: string;
  paypal_email?: string;
  paypal_link?: string;
  revolut_tag?: string;
  payment_notes?: string;
  payment_threshold_eur?: number;
};

const SEED: SeedRow[] = [
  {
    id: "rec4xhKEJllCmeDjC",
    name: "Antigoni",
    paypal_email: "stefaniakatsi123@gmail.com",
    payment_threshold_eur: 200,
  },
  {
    id: "recxGew2CD6UlBoPf",
    name: "Ariandi",
    paypal_email: "stefaniakatsi123@gmail.com",
    payment_threshold_eur: 200,
  },
  {
    id: "recOzM1qmbUIzWUiR",
    name: "Diana",
    revolut_tag: "@andrean2jw",
    payment_threshold_eur: 200,
  },
  {
    id: "rec7jwVGwQZ5uYXKl",
    name: "Eirini",
    paypal_link: "https://paypal.me/eirinizefh",
    payment_threshold_eur: 200,
  },
  {
    id: "recKFg3u1BA2kE9ch",
    name: "Frika",
    paypal_email: "vamaliamaavalea@gmail.com",
    payment_threshold_eur: 200,
  },
  {
    id: "rec3R1BEED9weYPfE",
    name: "Frost",
    paypal_link: "https://paypal.me/JoannaFrost66",
    revolut_tag: "@ioannikxjm",
    payment_threshold_eur: 200,
  },
  {
    id: "recMwsL1eFVGlkkOZ",
    name: "Lina",
    paypal_email: "itslinalinaki@gmail.com",
    paypal_link: "https://paypal.me/Linakrt01",
    payment_threshold_eur: 200,
  },
  {
    id: "recm7xLOotXa1vQHc",
    name: "Lydia",
    paypal_email: "lydiafwtiadou@gmail.com",
    payment_threshold_eur: 200,
  },
  {
    id: "recgmObP5ezDeEPDs",
    name: "Marilia",
    paypal_email: "mariliazefh@gmail.com",
    payment_threshold_eur: 200,
  },
  {
    id: "recSogqHMrMPeJWwi",
    name: "Silia",
    paypal_link: "https://paypal.me/SiliaMenegakh",
    payment_threshold_eur: 200,
  },
  {
    id: "recRYzE3HViBXRl0k",
    name: "Stefania",
    paypal_email: "stefaniakatsi123@gmail.com",
    payment_threshold_eur: 200,
  },
  {
    id: "rec3LzkuHyMkUgb4m",
    name: "Stella",
    paypal_link: "https://paypal.me/stellanikolaidou777",
    payment_threshold_eur: 200,
  },
];

async function main() {
  let updated = 0;
  let failed = 0;

  for (const row of SEED) {
    const fields: Record<string, unknown> = {
      payment_threshold_eur: row.payment_threshold_eur ?? 200,
    };
    if (row.paypal_email) fields.paypal_email = row.paypal_email;
    if (row.paypal_link) fields.paypal_link = row.paypal_link;
    if (row.revolut_tag) fields.revolut_tag = row.revolut_tag;
    if (row.payment_notes) fields.payment_notes = row.payment_notes;

    const res = await fetch(`${API}/modelss/${row.id}`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({ fields }),
    });
    if (res.ok) {
      console.log(`✅ ${row.name} (${row.id})`);
      updated++;
    } else {
      console.error(`❌ ${row.name}: ${await res.text()}`);
      failed++;
    }
    await new Promise((r) => setTimeout(r, 220));
  }

  console.log(`\nDone: ${updated} updated, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
