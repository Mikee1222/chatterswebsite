import dotenv from "dotenv";

dotenv.config();

async function checkFields() {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_TOKEN;
  if (!baseId || !token) {
    throw new Error("Missing AIRTABLE_BASE_ID or AIRTABLE_TOKEN");
  }

  const res = await fetch(`https://api.airtable.com/v0/${baseId}/users?maxRecords=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as {
    records?: Array<{ fields?: Record<string, unknown> }>;
    error?: { type?: string; message?: string };
  };

  if (!res.ok) {
    throw new Error(`Airtable ${res.status}: ${JSON.stringify(data.error ?? data)}`);
  }

  console.log("Users table fields:", Object.keys(data.records?.[0]?.fields ?? {}));
}

checkFields().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
