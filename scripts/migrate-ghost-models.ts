import { config as loadEnv } from "dotenv";
loadEnv();
loadEnv({ path: ".env.local" });
const TOKEN = process.env.AIRTABLE_TOKEN?.trim();
const BASE_ID = process.env.AIRTABLE_BASE_ID?.trim();
const API = `https://api.airtable.com/v0/${BASE_ID}`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } as Record<string,string>;

async function main() {
  const modelsRes = await fetch(`${API}/modelss?pageSize=100`, { headers: H });
  const modelsData = await modelsRes.json() as any;
  const realModels = modelsData.records.filter((r: any) => r.fields.model_id);
  const ghostModels = modelsData.records.filter((r: any) => !r.fields.model_id);
  console.log("Real models:", realModels.length);
  console.log("Ghost models:", ghostModels.length);

  const nameToReal = new Map<string, string>();
  for (const real of realModels) {
    const name = (real.fields.model_name ?? "").trim().toLowerCase();
    nameToReal.set(name, real.id);
  }

  const ghostToReal = new Map<string, string>();
  for (const ghost of ghostModels) {
    const name = (ghost.fields.model_name ?? "").trim().toLowerCase();
    const realId = nameToReal.get(name);
    if (realId) {
      ghostToReal.set(ghost.id, realId);
      console.log("Ghost", ghost.id, ghost.fields.model_name, "-> Real", realId);
    } else {
      console.log("No match for ghost:", ghost.id, ghost.fields.model_name);
    }
  }

  let offset: string | undefined;
  let updated = 0;

  for (;;) {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (offset) qs.set("offset", offset);
    const res = await fetch(`${API}/billing_cycle_revenues?${qs}`, { headers: H });
    const data = await res.json() as any;

    for (const rec of data.records ?? []) {
      const modelLinks: string[] = rec.fields.model ?? [];
      const hasGhost = modelLinks.some((id: string) => ghostToReal.has(id));
      if (!hasGhost) continue;
      const newLinks = modelLinks.map((id: string) => ghostToReal.get(id) ?? id);
      console.log("Updating", rec.id, JSON.stringify(modelLinks), "->", JSON.stringify(newLinks));
      const patchRes = await fetch(`${API}/billing_cycle_revenues/${rec.id}`, {
        method: "PATCH",
        headers: H,
        body: JSON.stringify({ fields: { model: newLinks } }),
      });
      if (patchRes.ok) { updated++; console.log("OK"); }
      else { console.error("FAILED:", await patchRes.text()); }
      await new Promise(r => setTimeout(r, 250));
    }

    if (!data.offset) break;
    offset = data.offset;
  }

  console.log("Done! Updated:", updated);
}

main().catch(console.error);
