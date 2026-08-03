import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { getUserByAirtableId, listAllUsers } from "@/services/users";
import { listAllModelss } from "@/services/modelss";
import { listAllWhales } from "@/services/whales";
import { listAllCustomRequests } from "@/services/custom-requests";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";

const MAX = 5;

type SearchHit = { id: string; label: string; sublabel?: string };

type SearchResponse = {
  models: SearchHit[];
  whales: SearchHit[];
  customs: SearchHit[];
  users: SearchHit[];
};

function includesQ(haystack: string | undefined | null, qLower: string): boolean {
  return (haystack ?? "").toLowerCase().includes(qLower);
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

  try {
    const modelsPromise = (async (): Promise<SearchHit[]> => {
      if (session.role === "model" && !modelLinkedRecordId) return [];
      const all = await listAllModelss();
      return all
        .filter((m) => {
          if (session.role === "model" && modelLinkedRecordId && m.id !== modelLinkedRecordId) {
            return false;
          }
          return includesQ(m.model_name, qLower);
        })
        .slice(0, MAX)
        .map((m) => ({
          id: m.id,
          label: (m.model_name ?? "").trim() || "Model",
          sublabel: (m.model_id ?? "").trim() || undefined,
        }));
    })();

    const whalesPromise = (async (): Promise<SearchHit[]> => {
      if (session.role === "model" || staffMode === "virtual_assistant") {
        return [];
      }
      const all = await listAllWhales();
      return all
        .filter((w) => {
          if (staffMode === "chatter" && chatterRecordId && w.assigned_chatter_id !== chatterRecordId) {
            return false;
          }
          return includesQ(w.username, qLower);
        })
        .slice(0, MAX)
        .map((w) => ({
          id: w.id,
          label: (w.username ?? "").trim() || "Whale",
          sublabel: (w.whale_id ?? "").trim() || undefined,
        }));
    })();

    const customsPromise = (async (): Promise<SearchHit[]> => {
      const all = await listAllCustomRequests();
      return all
        .filter((c) => {
          if (staffMode === "chatter" && chatterRecordId) {
            if (c.requested_by_chatter_id !== chatterRecordId) return false;
          } else if (session.role === "model" && modelLinkedRecordId) {
            if (c.assigned_model_id !== modelLinkedRecordId) return false;
          }
          return includesQ(c.request_title, qLower) || includesQ(c.fan_username, qLower);
        })
        .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
        .slice(0, MAX)
        .map((c) => {
          const title = (c.request_title ?? "").trim();
          const fan = (c.fan_username ?? "").trim();
          return {
            id: c.id,
            label: title || fan || "Custom request",
            sublabel: title && fan ? fan : undefined,
          };
        });
    })();

    const usersPromise = (async (): Promise<SearchHit[]> => {
      if (!canSearchUsers) return [];
      const all = await listAllUsers();
      return all
        .filter((u) => includesQ(u.full_name, qLower) || includesQ(u.email, qLower))
        .slice(0, MAX)
        .map((u) => ({
          id: u.id,
          label: (u.full_name ?? "").trim() || (u.email ?? "").trim() || "User",
          sublabel: (u.email ?? "").trim() || undefined,
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
