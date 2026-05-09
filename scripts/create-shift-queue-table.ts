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

  const existing = tables.find((t) => t.name === "shift_queue");
  if (existing) {
    console.log(`Table already exists: shift_queue (${existing.id})`);
    return;
  }

  const dateTimeOptions = {
    dateFormat: { name: "iso" as const },
    timeFormat: { name: "24hour" as const },
    timeZone: "Europe/Athens",
  };

  const body = {
    name: "shift_queue",
    fields: [
      { name: "queue_id", type: "singleLineText" },
      { name: "chatter_id", type: "singleLineText" },
      { name: "chatter_name", type: "singleLineText" },
      { name: "selected_model_ids", type: "multilineText" },
      { name: "selected_model_names", type: "multilineText" },
      {
        name: "status",
        type: "singleSelect",
        options: {
          choices: [
            { name: "waiting", color: "blueLight2" },
            { name: "started", color: "greenLight2" },
            { name: "cancelled", color: "grayLight2" },
            { name: "expired", color: "orangeLight2" },
          ],
        },
      },
      { name: "waiting_for_shift_id", type: "singleLineText" },
      { name: "waiting_for_chatter_name", type: "singleLineText" },
      { name: "created_at", type: "dateTime", options: dateTimeOptions },
      { name: "started_at", type: "dateTime", options: dateTimeOptions },
      { name: "cancelled_at", type: "dateTime", options: dateTimeOptions },
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
