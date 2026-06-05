#!/usr/bin/env tsx
import { config as loadEnv } from "dotenv";
loadEnv();
loadEnv({ path: ".env.local" });

const TOKEN = process.env.AIRTABLE_TOKEN?.trim();
const BASE_ID = process.env.AIRTABLE_BASE_ID?.trim();
if (!TOKEN || !BASE_ID) { console.error("Missing env vars"); process.exit(1); }

async function main() {
  const MODELSS_BY_NAME: Record<string, string> = {
    "gavriela":   "rec0IuyyDDK9AgmAd",
    "katerina k": "rec2LJI8PmRlHE9q5",
    "stella":     "rec3LzkuHyMkUgb4m",
    "antigoni":   "rec4xhKEJllCmeDjC",
    "eirini":     "rec7jwVGwQZ5uYXKl",
    "elisavet":   "recG1jdOuQAE5UV2Y",
    "diana":      "recOzM1qmbUIzWUiR",
    "stefania":   "recRYzE3HViBXRl0k",
    "marillia":   "recgmObP5ezDeEPDs",
    "chrysa":     "recq7xz385YNmqqE2",
    "ariadni":    "recxGew2CD6UlBoPf",
  };

  const CLIENTS_BY_NAME: Record<string, string> = {
    "kostas":         "recOyo8VoVkZB6VUu",
    "leo":            "recFQLaEM8Jgt7vMO",
    "john":           "recG4XhFFX32qC6vL",
    "george xatzidis": "recAyEZVBoqgZy6Ho",
    "alex":           "rectmag7DEI1AUlFq",
  };

  const MAPPINGS: Record<string, { client: string; model: string }> = {
    "rec5DoLaKN6lZlGbc": { client: "recAyEZVBoqgZy6Ho", model: "recG1jdOuQAE5UV2Y" },
    "recAjHyClMx5sPvmQ": { client: "recFQLaEM8Jgt7vMO", model: "recRYzE3HViBXRl0k" },
    "recD8mzTkVbCQ0brS": { client: "recFQLaEM8Jgt7vMO", model: "recxGew2CD6UlBoPf" },
    "recDyBEmloRxt9ghk": { client: "recFQLaEM8Jgt7vMO", model: "rec4xhKEJllCmeDjC" },
    "recmZQa6FqWzDvht8": { client: "recG4XhFFX32qC6vL", model: "recq7xz385YNmqqE2" },
    "recCmp2LXbQTyZsCU": { client: "recFQLaEM8Jgt7vMO", model: "recxGew2CD6UlBoPf" },
    "rec3E0oSJmOsVatBd": { client: "recFQLaEM8Jgt7vMO", model: "recRYzE3HViBXRl0k" },
    "rec99GExJhzTm7ZTZ": { client: "recG4XhFFX32qC6vL", model: "recq7xz385YNmqqE2" },
    "recDTwFC7yb6znYvx": { client: "recFQLaEM8Jgt7vMO", model: "rec4xhKEJllCmeDjC" },
    "recRnNjfBZWDAhGzG": { client: "recAyEZVBoqgZy6Ho", model: "recG1jdOuQAE5UV2Y" },
  };

  const TO_DELETE = [
    "recIHerekYTORZ4kd",
    "recJQBEa3abEAPGij",
    "reczv82bxvZXueqLH",
    "recGZTxfDTEo0Q9Cw",
    "recdKAApq3U1clDl1",
    "recnWsSItzgvLX0PQ",
  ];

  const API = `https://api.airtable.com/v0/${BASE_ID}`;
  const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

  console.log("Deleting inactive records...");
  for (const id of TO_DELETE) {
    const res = await fetch(`${API}/client_models/${id}`, { method: "DELETE", headers: H });
    console.log(res.ok ? `✅ Deleted ${id}` : `❌ Failed to delete ${id}: ${await res.text()}`);
    await new Promise(r => setTimeout(r, 250));
  }

  console.log("\nUpdating active records...");
  for (const [id, { client, model }] of Object.entries(MAPPINGS)) {
    const res = await fetch(`${API}/client_models/${id}`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({ fields: { client: [client], model: [model] } }),
    });
    if (res.ok) {
      console.log(`✅ Updated ${id}`);
    } else {
      console.error(`❌ Failed ${id}: ${await res.text()}`);
    }
    await new Promise(r => setTimeout(r, 250));
  }

  console.log("\n✅ Migration complete!");
}

main().catch(e => { console.error(e); process.exit(1); });
