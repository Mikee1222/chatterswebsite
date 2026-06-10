import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { listRecords, type AirtableRecord } from "@/lib/airtable-server";
import { escapeAirtableString } from "@/lib/airtable-linked";
import { getUserByAirtableId } from "@/services/users";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";

const MAX = 5;

type SearchHit = { id: string; label: string; sublabel?: string };

type SearchResponse = {
  models: SearchHit[];
  whales: SearchHit[];
  customs: SearchHit[];
  users: SearchHit[];
};

function lowerFindFormula(fieldName: string, qLower: string): string {
  const lit = escapeAirtableString(qLower);
  return `FIND(LOWER("${lit}"), LOWER({${fieldName}} & "")) > 0`;
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("q")?.trim() ?? "";
  if (raw.length === 0) {
    const empty: SearchResponse = { models: [], whales: [], customs: [], users: [] };
    return NextResponse.json(empty);
  }

  const qLower = raw.toLowerCase();
  const staffMode = getEffectiveStaffRole(session);

  const canSearchUsers = await hasPermission(session, "accounts:view");
  const chatterRecordId = (session.airtableUserId ?? session.id)?.trim() || "";

  let modelLinkedRecordId: string | null = null;
  if (session.role === "model" && session.airtableUserId) {
    try {
      const prof = await getUserByAirtableId(session.airtableUserId);
      modelLinkedRecordId = prof?.linked_model_id?.trim() || null;
    } catch {
      modelLinkedRecordId = null;
    }
  }

  const modelFields = ["model_name", "model_id"];
  const whaleFields = ["username", "whale_id"];
  const customFields = ["request_title", "fan_username", "created_at"];
  const userFields = ["full_name", "email"];

  try {
    const modelsPromise = (async (): Promise<SearchHit[]> => {
      let formula = lowerFindFormula("model_name", qLower);
      if (session.role === "model") {
        if (!modelLinkedRecordId) return [];
        formula = `AND(RECORD_ID() = "${escapeAirtableString(modelLinkedRecordId)}", ${formula})`;
      }
      const { records } = await listRecords<{ model_name?: string; model_id?: string }>("modelss", {
        filterByFormula: formula,
        pageSize: MAX,
        fields: modelFields,
      });
      return records.map((r) => ({
        id: r.id,
        label: (r.fields.model_name ?? "").trim() || "Model",
        sublabel: (r.fields.model_id ?? "").trim() || undefined,
      }));
    })();

    const whalesPromise = (async (): Promise<SearchHit[]> => {
      if (session.role === "model" || staffMode === "virtual_assistant") {
        return [];
      }
      let formula = lowerFindFormula("username", qLower);
      if (staffMode === "chatter" && chatterRecordId) {
        const escC = escapeAirtableString(chatterRecordId);
        formula = `AND(${formula}, FIND("${escC}", ARRAYJOIN({assigned_chatter}) & "") > 0)`;
      }
      const { records } = await listRecords<{ username?: string; whale_id?: string }>("whales", {
        filterByFormula: formula,
        pageSize: MAX,
        fields: whaleFields,
      });
      return records.map((r) => ({
        id: r.id,
        label: (r.fields.username ?? "").trim() || "Whale",
        sublabel: (r.fields.whale_id ?? "").trim() || undefined,
      }));
    })();

    const customsPromise = (async (): Promise<SearchHit[]> => {
      const titlePart = lowerFindFormula("request_title", qLower);
      const fanPart = lowerFindFormula("fan_username", qLower);
      let formula = `OR(${titlePart}, ${fanPart})`;
      if (staffMode === "chatter" && chatterRecordId) {
        const escC = escapeAirtableString(chatterRecordId);
        formula = `AND(${formula}, FIND("${escC}", ARRAYJOIN({requested_by_chatter}) & "") > 0)`;
      } else if (session.role === "model" && modelLinkedRecordId) {
        const escM = escapeAirtableString(modelLinkedRecordId);
        formula = `AND(${formula}, FIND("${escM}", ARRAYJOIN({assigned_model}) & "") > 0)`;
      }
      const { records } = await listRecords<{ request_title?: string; fan_username?: string }>(
        "custom_requests",
        {
          filterByFormula: formula,
          pageSize: MAX,
          sort: [{ field: "created_at", direction: "desc" }],
          fields: customFields,
        }
      );
      return records.map((r) => {
        const f = r.fields;
        const title = (f.request_title ?? "").trim();
        const fan = (f.fan_username ?? "").trim();
        return {
          id: r.id,
          label: title || fan || "Custom request",
          sublabel: title && fan ? fan : undefined,
        };
      });
    })();

    const usersPromise = (async (): Promise<SearchHit[]> => {
      if (!canSearchUsers) return [];
      const namePart = lowerFindFormula("full_name", qLower);
      const emailPart = lowerFindFormula("email", qLower);
      const formula = `OR(${namePart}, ${emailPart})`;
      const { records } = await listRecords<{ full_name?: string; email?: string }>("users", {
        filterByFormula: formula,
        pageSize: MAX,
        fields: userFields,
      });
      return records.map((r: AirtableRecord<{ full_name?: string; email?: string }>) => ({
        id: r.id,
        label: (r.fields.full_name ?? "").trim() || (r.fields.email ?? "").trim() || "User",
        sublabel: (r.fields.email ?? "").trim() || undefined,
      }));
    })();

    const [modelsB, whalesB, customsB, usersB] = await Promise.all([
      modelsPromise,
      whalesPromise,
      customsPromise,
      usersPromise,
    ]);

    const body: SearchResponse = {
      models: modelsB,
      whales: whalesB,
      customs: customsB,
      users: usersB,
    };
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/search]", msg);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
