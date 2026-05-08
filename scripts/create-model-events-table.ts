import dotenv from "dotenv";

dotenv.config();

type MetaTable = { id: string; name: string };

async function metaFetch(path: string, init?: RequestInit): Promise<Response> {
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  const token = process.env.AIRTABLE_TOKEN?.trim();
  if (!baseId || !token) throw new Error("Missing AIRTABLE_BASE_ID or AIRTABLE_TOKEN");
  return fetch(`https://api.airtable.com/v0/meta/bases/${baseId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function createTable() {
  const tablesRes = await metaFetch("/tables");
  const tablesJson = (await tablesRes.json()) as { tables?: MetaTable[] };
  const tables = tablesJson.tables ?? [];

  const existing = tables.find((t) => t.name === "model_personal_events");
  if (existing) {
    console.log(`Table already exists: model_personal_events (${existing.id})`);
    return;
  }
  const modelss = tables.find((t) => t.name === "modelss");
  if (!modelss) throw new Error('Could not find "modelss" table in this base.');

  const body = {
    name: "model_personal_events",
    fields: [
      { name: "event_id", type: "singleLineText" },
      {
        name: "model_id",
        type: "multipleRecordLinks",
        options: { linkedTableId: modelss.id },
      },
      { name: "model_user_id", type: "singleLineText" },
      {
        name: "event_type",
        type: "singleSelect",
        options: {
          choices: [
            { name: "nails", color: "pinkLight2" },
            { name: "lashes", color: "purpleLight2" },
            { name: "hairdresser", color: "blueLight2" },
            { name: "surgery", color: "redLight2" },
            { name: "fillers", color: "yellowLight2" },
            { name: "custom", color: "grayLight2" },
          ],
        },
      },
      { name: "custom_label", type: "singleLineText" },
      {
        name: "event_date",
        type: "date",
        options: {
          dateFormat: { name: "iso" },
        },
      },
      { name: "event_time", type: "singleLineText" },
      { name: "notes", type: "multilineText" },
      { name: "reminder_sent", type: "checkbox", options: { color: "greenBright", icon: "check" } },
      {
        name: "created_at",
        type: "dateTime",
        options: {
          dateFormat: { name: "iso" },
          timeFormat: { name: "24hour" },
          timeZone: "Europe/Athens",
        },
      },
    ],
  };

  const createRes = await metaFetch("/tables", { method: "POST", body: JSON.stringify(body) });
  const data = await createRes.json();
  console.log("Create table response:", JSON.stringify(data, null, 2));
}

createTable().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
