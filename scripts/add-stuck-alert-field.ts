import dotenv from "dotenv";

dotenv.config();

async function run() {
  const headers = {
    Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
    "Content-Type": "application/json",
  };

  const tablesRes = await fetch(
    `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
    { headers }
  );
  const { tables } = await tablesRes.json();
  const table = tables.find((t: any) => t.name === "custom_requests");
  if (!table) {
    console.error("custom_requests table not found");
    return;
  }

  const existing = table.fields.find((f: any) => f.name === "stuck_alert_sent");
  if (existing) {
    console.log("stuck_alert_sent already exists");
    return;
  }

  const res = await fetch(
    `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables/${table.id}/fields`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "stuck_alert_sent",
        type: "checkbox",
        options: { icon: "check", color: "greenBright" },
      }),
    }
  );
  const data = await res.json();
  console.log("stuck_alert_sent:", data.name ?? data.error);
}

run().catch(console.error);
