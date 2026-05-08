import dotenv from "dotenv";
dotenv.config();

async function createFeedbackTable() {
  const response = await fetch(
    `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "feedback",
        fields: [
          { name: "feedback_id", type: "singleLineText" },
          { name: "user_id", type: "singleLineText" },
          { name: "user_name", type: "singleLineText" },
          {
            name: "user_role",
            type: "singleSelect",
            options: {
              choices: [
                { name: "chatter", color: "blueLight2" },
                { name: "virtual_assistant", color: "purpleLight2" },
                { name: "model", color: "pinkLight2" },
                { name: "admin", color: "grayLight2" },
              ],
            },
          },
          {
            name: "type",
            type: "singleSelect",
            options: {
              choices: [
                { name: "bug", color: "redLight2" },
                { name: "suggestion", color: "greenLight2" },
                { name: "other", color: "grayLight2" },
              ],
            },
          },
          { name: "page", type: "singleLineText" },
          { name: "title", type: "singleLineText" },
          { name: "description", type: "multilineText" },
          { name: "screenshots", type: "multipleAttachments" },
          {
            name: "status",
            type: "singleSelect",
            options: {
              choices: [
                { name: "new", color: "blueLight2" },
                { name: "in_review", color: "yellowLight2" },
                { name: "resolved", color: "greenLight2" },
                { name: "wont_fix", color: "grayLight2" },
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
        ],
      }),
    }
  );
  const data = await response.json();
  console.log("Table created:", JSON.stringify(data, null, 2));
}

createFeedbackTable().catch(console.error);

