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

  const existing = tables.find((t) => t.name === "model_expense_requests");
  if (existing) {
    console.log(`Table already exists: model_expense_requests (${existing.id})`);
    return;
  }
  const modelss = tables.find((t) => t.name === "modelss");
  if (!modelss) throw new Error('Could not find "modelss" table in this base.');

  const body = {
    name: "model_expense_requests",
    fields: [
      { name: "request_id", type: "singleLineText" },
      {
        name: "model_id",
        type: "multipleRecordLinks",
        options: { linkedTableId: modelss.id },
      },
      { name: "model_user_id", type: "singleLineText" },
      { name: "va_content_assignment_id", type: "singleLineText" },
      { name: "assignment_title", type: "singleLineText" },
      {
        name: "type",
        type: "singleSelect",
        options: {
          choices: [
            { name: "airbnb", color: "blueLight2" },
            { name: "other", color: "grayLight2" },
          ],
        },
      },
      { name: "airbnb_link", type: "url" },
      { name: "notes", type: "multilineText" },
      {
        name: "status",
        type: "singleSelect",
        options: {
          choices: [
            { name: "pending", color: "yellowLight2" },
            { name: "approved", color: "greenLight2" },
            { name: "rejected", color: "redLight2" },
          ],
        },
      },
      { name: "admin_notes", type: "multilineText" },
      {
        name: "created_at",
        type: "dateTime",
        options: {
          dateFormat: { name: "iso" },
          timeFormat: { name: "24hour" },
          timeZone: "Europe/Athens",
        },
      },
      {
        name: "updated_at",
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
