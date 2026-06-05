#!/usr/bin/env tsx
import { config } from "dotenv";
config({ path: ".env.local" });
const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!TOKEN || !BASE_ID) {
  console.error("Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID");
  process.exit(1);
}

// Fetch one submission to see all field names
const res = await fetch(
  `https://api.airtable.com/v0/${BASE_ID}/payment_submissions?pageSize=1`,
  { headers: { Authorization: `Bearer ${TOKEN}` } }
);
const data = await res.json();
if (!data.records?.length) {
  console.log("No payment_submissions records found");
  process.exit(0);
}
const rec = data.records[0];
console.log("Record ID:", rec.id);
console.log("Field names:", Object.keys(rec.fields));
console.log("Status field value:", rec.fields.status);
console.log("All fields:", JSON.stringify(rec.fields, null, 2));

// Also try to update it directly
console.log("\nTrying direct PATCH...");
const updateRes = await fetch(
  `https://api.airtable.com/v0/${BASE_ID}/payment_submissions/${rec.id}`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: { status: rec.fields.status } }),
  }
);
const updateData = await updateRes.json();
console.log("Update response status:", updateRes.status);
console.log("Update response fields:", JSON.stringify(updateData.fields ?? updateData, null, 2));

// Test approve if currently pending_review
if (rec.fields.status === "pending_review") {
  console.log("\nTrying direct PATCH to approved...");
  const approveRes = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/payment_submissions/${rec.id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: { status: "approved" } }),
    }
  );
  const approveData = await approveRes.json();
  console.log("Approve response status:", approveRes.status);
  console.log("Approve response fields:", JSON.stringify(approveData.fields ?? approveData, null, 2));

  // Revert back
  console.log("\nReverting to pending_review...");
  const revertRes = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/payment_submissions/${rec.id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: { status: "pending_review" } }),
    }
  );
  const revertData = await revertRes.json();
  console.log("Revert response status:", revertRes.status);
  console.log("Revert status:", revertData.fields?.status);
}
