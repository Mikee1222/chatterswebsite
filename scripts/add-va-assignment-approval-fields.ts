import dotenv from "dotenv";

dotenv.config();

type ChoiceRow = { id?: string; name: string; color?: string };

type MetaField = { id: string; name: string; type: string; options?: { choices?: ChoiceRow[] } };

type MetaTable = { id: string; name: string; fields: MetaField[] };

const dateTimeAthens = {
  dateFormat: { name: "iso" as const },
  timeFormat: { name: "24hour" as const },
  timeZone: "Europe/Athens",
};

async function run() {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim();
  if (!token || !baseId) {
    console.error("Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID");
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  async function loadTables(): Promise<MetaTable[]> {
    const tablesRes = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, { headers });
    if (!tablesRes.ok) {
      console.error("tables fetch failed", tablesRes.status, await tablesRes.text());
      return [];
    }
    const { tables } = (await tablesRes.json()) as { tables?: MetaTable[] };
    return tables ?? [];
  }

  let tables = await loadTables();
  let table = tables.find((t) => t.name === "va_content_assignments");
  if (!table) {
    console.error("table va_content_assignments not found");
    return;
  }

  const fieldsUrl = `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${table.id}/fields`;
  const existingFieldNames = new Set(table.fields.map((f) => f.name.toLowerCase()));

  async function postField(body: Record<string, unknown>, label: string) {
    const key = String(body.name ?? label).toLowerCase();
    if (existingFieldNames.has(key)) {
      console.log(label, "— already exists, skip");
      return;
    }
    const r = await fetch(fieldsUrl, { method: "POST", headers, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { name?: string; error?: { message?: string } };
    if (!r.ok) {
      console.error(label, r.status, j);
    } else {
      console.log(label, j.name ?? j);
      if (typeof body.name === "string") existingFieldNames.add(body.name.toLowerCase());
    }
  }

  await postField({ name: "rejection_reason", type: "multilineText" }, "rejection_reason");
  await postField({ name: "admin_edit_notes", type: "multilineText" }, "admin_edit_notes");
  await postField({ name: "reviewed_by", type: "singleLineText" }, "reviewed_by");
  await postField(
    {
      name: "reviewed_at",
      type: "dateTime",
      options: dateTimeAthens,
    },
    "reviewed_at"
  );

  tables = await loadTables();
  table = tables.find((t) => t.name === "va_content_assignments");
  if (!table) {
    console.error("table va_content_assignments not found after field creates");
    return;
  }

  const statusField = table.fields.find((f) => f.name === "status");
  if (!statusField?.id) {
    console.error("status field not found");
    return;
  }
  if (statusField.type !== "singleSelect") {
    console.error("status field is not singleSelect:", statusField.type);
    return;
  }

  const existingChoices = (statusField.options?.choices ?? []) as ChoiceRow[];
  const seen = new Set(existingChoices.map((c) => (c.name ?? "").trim().toLowerCase()));
  const toAdd: ChoiceRow[] = [];
  if (!seen.has("pending_approval")) {
    seen.add("pending_approval");
    toAdd.push({ name: "pending_approval", color: "grayLight2" });
  }
  if (!seen.has("rejected")) {
    seen.add("rejected");
    toAdd.push({ name: "rejected", color: "grayLight2" });
  }
  if (toAdd.length === 0) {
    console.log("status choices pending_approval + rejected already present");
    return;
  }

  const merged = [...existingChoices.map((c) => ({ ...c })), ...toAdd];

  const patchRes = await fetch(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${table.id}/fields/${statusField.id}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        type: "singleSelect",
        options: { choices: merged },
      }),
    }
  );
  if (!patchRes.ok) {
    const errText = await patchRes.text();
    console.error("status PATCH failed", patchRes.status, errText);
    console.warn(
      "\nAdd these two options manually in Airtable → va_content_assignments → status (single select):\n" +
        '  • pending_approval\n' +
        "  • rejected\n" +
        "(Some PATs cannot PATCH single-select options; the app still expects these exact option names.)\n"
    );
  } else {
    console.log("status field updated with:", toAdd.map((c) => c.name).join(", "));
  }
}

run().catch(console.error);
