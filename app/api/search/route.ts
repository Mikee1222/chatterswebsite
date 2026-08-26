import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getUserPermissions } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { getUserByAirtableId, listAllUsers } from "@/services/users";
import { listAllModelss } from "@/services/modelss";
import { listAllWhales } from "@/services/whales";
import { listAllCustomRequests } from "@/services/custom-requests";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { fuzzyMatchAny } from "@/lib/fuzzy-search";
import { buildNavItemsForUser } from "@/lib/nav-config";
import { listAllRecords } from "@/lib/airtable-server";
import { SOP_FUNCTIONS_TABLE } from "@/services/sops";
import { isSupabaseBackend } from "@/lib/data-backend";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { listCredentialEntries } from "@/services/credential-entries";
import { listApplicationForms } from "@/services/application-forms";
import { getAllWinnerVideos } from "@/services/winner-videos";
import { getAllTaskTemplatesAdmin } from "@/services/task-templates";
import { ROUTES } from "@/lib/routes";

const MAX = 6;

export type SearchHit = {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  score?: number;
};

export type SearchResponse = {
  models: SearchHit[];
  people: SearchHit[];
  pages: SearchHit[];
  sops: SearchHit[];
  credentials: SearchHit[];
  candidates: SearchHit[];
  winners: SearchHit[];
  templates: SearchHit[];
  whales: SearchHit[];
  customs: SearchHit[];
};

function emptyResponse(): SearchResponse {
  return {
    models: [],
    people: [],
    pages: [],
    sops: [],
    credentials: [],
    candidates: [],
    winners: [],
    templates: [],
    whales: [],
    customs: [],
  };
}

function topScored(
  items: Array<SearchHit & { score: number }>,
  limit = MAX,
): SearchHit[] {
  return items
    .filter((i) => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _s, ...rest }) => rest);
}

export async function GET(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("q")?.trim() ?? "";
  if (raw.length === 0) {
    return NextResponse.json(emptyResponse());
  }

  const q = raw;
  const staffMode = getEffectiveStaffRole(session);
  const perms = await getUserPermissions(session);
  const permSet = new Set(perms);
  const has = (p: string) => permSet.has(p as (typeof perms)[number]);

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
      return topScored(
        all
          .filter((m) => {
            if (session.role === "model" && modelLinkedRecordId && m.id !== modelLinkedRecordId) {
              return false;
            }
            return true;
          })
          .map((m) => {
            const label = (m.model_name ?? "").trim() || "Model";
            const sub = (m.model_id ?? "").trim() || undefined;
            const score = fuzzyMatchAny([label, sub, m.platform], q);
            return {
              id: m.id,
              label,
              sublabel: sub,
              href: ROUTES.admin.modelDetail(m.id),
              score,
            };
          }),
      );
    })();

    const peoplePromise = (async (): Promise<SearchHit[]> => {
      if (!has(PERMISSIONS.ACCOUNTS_VIEW)) return [];
      const all = await listAllUsers();
      return topScored(
        all.map((u) => {
          const label = (u.full_name ?? "").trim() || (u.email ?? "").trim() || "User";
          const role = (u.role ?? "").trim();
          const score = fuzzyMatchAny([label, u.email, role], q);
          return {
            id: u.id,
            label,
            sublabel: [role, u.email].filter(Boolean).join(" · ") || undefined,
            href: ROUTES.admin.accountDetail(u.id),
            score,
          };
        }),
      );
    })();

    const pagesPromise = (async (): Promise<SearchHit[]> => {
      const items = buildNavItemsForUser(session.role, perms);
      return topScored(
        items.map((item) => ({
          id: item.href,
          label: item.label,
          sublabel: item.navSection ?? item.href,
          href: item.href,
          score: fuzzyMatchAny([item.label, item.href, item.navSection], q),
        })),
      );
    })();

    const sopsPromise = (async (): Promise<SearchHit[]> => {
      if (!has(PERMISSIONS.SOPS_VIEW) && !has(PERMISSIONS.SOPS_MANAGE)) return [];
      try {
        let rows: Array<{ id: string; name?: string; function_id?: string }> = [];
        if (isSupabaseBackend()) {
          const sb = getSupabaseServiceClient();
          const { data } = await sb
            .from("sop_functions")
            .select("id,name,function_id,is_active")
            .eq("is_active", true)
            .limit(400);
          rows = (data ?? []) as typeof rows;
        } else {
          const records = await listAllRecords<{
            name?: string;
            function_id?: string;
            is_active?: boolean;
          }>(SOP_FUNCTIONS_TABLE, { _caller: "search-sops" });
          rows = records
            .filter((r) => r.fields.is_active !== false)
            .map((r) => ({
              id: r.id,
              name: r.fields.name,
              function_id: r.fields.function_id,
            }));
        }
        const hrefBase = has(PERMISSIONS.SOPS_MANAGE)
          ? ROUTES.admin.sopLibrary
          : ROUTES.sops;
        return topScored(
          rows.map((r) => {
            const label = (r.name ?? "").trim() || "SOP function";
            return {
              id: r.id,
              label,
              sublabel: r.function_id?.trim() || undefined,
              href: `${hrefBase}?fn=${encodeURIComponent(r.id)}`,
              score: fuzzyMatchAny([label, r.function_id], q),
            };
          }),
        );
      } catch {
        return [];
      }
    })();

    const credentialsPromise = (async (): Promise<SearchHit[]> => {
      if (!has(PERMISSIONS.CREDENTIALS_VIEW)) return [];
      try {
        const entries = await listCredentialEntries();
        const models = await listAllModelss().catch(() => []);
        const modelNameById = new Map(models.map((m) => [m.id, m.model_name]));
        return topScored(
          entries.map((e) => {
            const modelName = e.model_id
              ? modelNameById.get(e.model_id) ?? e.model_id
              : undefined;
            // NEVER include credential values — labels/categories/models only
            const score = fuzzyMatchAny([e.label, e.category, modelName], q);
            return {
              id: e.id,
              label: e.label || "Credential",
              sublabel: [e.category, modelName].filter(Boolean).join(" · ") || undefined,
              href: `${ROUTES.admin.credentialsVault}?id=${encodeURIComponent(e.id)}`,
              score,
            };
          }),
        );
      } catch {
        return [];
      }
    })();

    const candidatesPromise = (async (): Promise<SearchHit[]> => {
      if (!has(PERMISSIONS.APPLICATIONS_VIEW)) return [];
      try {
        const forms = await listApplicationForms();
        const sb = getSupabaseServiceClient();
        const { data: responses } = await sb
          .from("application_form_responses")
          .select("id, form_id, status, submitted_at")
          .order("submitted_at", { ascending: false })
          .limit(200);
        const responseRows = (responses ?? []) as Array<{
          id: string;
          form_id: string;
          status: string;
          submitted_at: string;
        }>;
        if (responseRows.length === 0) return [];
        const ids = responseRows.map((r) => r.id);
        const { data: answers } = await sb
          .from("application_form_answers")
          .select("response_id, answer_text")
          .in("response_id", ids);
        const textByResponse = new Map<string, string[]>();
        for (const a of (answers ?? []) as Array<{
          response_id: string;
          answer_text: string | null;
        }>) {
          const list = textByResponse.get(a.response_id) ?? [];
          if (a.answer_text) list.push(a.answer_text);
          textByResponse.set(a.response_id, list);
        }
        const formById = new Map(forms.map((f) => [f.id, f]));
        return topScored(
          responseRows.map((r) => {
            const texts = textByResponse.get(r.id) ?? [];
            const label =
              texts.find((t) => t.trim().length > 1)?.trim().slice(0, 60) || "Candidate";
            const formTitle = formById.get(r.form_id)?.title ?? "Application";
            const score = fuzzyMatchAny([label, formTitle, r.status, ...texts.slice(0, 5)], q);
            return {
              id: r.id,
              label,
              sublabel: `${formTitle} · ${r.status}`,
              href: ROUTES.admin.applicationFormResponseDetail(r.form_id, r.id),
              score,
            };
          }),
        );
      } catch {
        return [];
      }
    })();

    const winnersPromise = (async (): Promise<SearchHit[]> => {
      if (
        !has(PERMISSIONS.WINNER_VIDEOS_MANAGE) &&
        !has(PERMISSIONS.WINNER_VIDEOS_SUBMIT) &&
        !has(PERMISSIONS.WINNER_SOURCING_MANAGE)
      ) {
        return [];
      }
      try {
        const all = await getAllWinnerVideos({});
        return topScored(
          all.map((v) => {
            const label =
              (v.reference_model_name ?? "").trim() ||
              (v.video_link ?? "").trim().slice(0, 40) ||
              "Winner video";
            const score = fuzzyMatchAny(
              [v.reference_model_name, v.video_link, v.status, v.bunch_name],
              q,
            );
            return {
              id: v.id,
              label,
              sublabel: [v.status, v.bunch_name].filter(Boolean).join(" · ") || undefined,
              href: `${ROUTES.admin.winnerVideos}?id=${encodeURIComponent(v.id)}`,
              score,
            };
          }),
        );
      } catch {
        return [];
      }
    })();

    const templatesPromise = (async (): Promise<SearchHit[]> => {
      if (!has(PERMISSIONS.TASK_TEMPLATES_MANAGE)) return [];
      try {
        const all = await getAllTaskTemplatesAdmin();
        return topScored(
          all.map((t) => {
            const label = (t.name ?? "").trim() || "Task template";
            return {
              id: t.id,
              label,
              sublabel: t.category || undefined,
              href: `${ROUTES.admin.taskTemplates}?id=${encodeURIComponent(t.id)}`,
              score: fuzzyMatchAny([label, t.category], q),
            };
          }),
        );
      } catch {
        return [];
      }
    })();

    const whalesPromise = (async (): Promise<SearchHit[]> => {
      if (session.role === "model" || staffMode === "virtual_assistant") return [];
      const all = await listAllWhales();
      return topScored(
        all
          .filter((w) => {
            if (staffMode === "chatter" && chatterRecordId && w.assigned_chatter_id !== chatterRecordId) {
              return false;
            }
            return true;
          })
          .map((w) => {
            const label = (w.username ?? "").trim() || "Whale";
            return {
              id: w.id,
              label,
              sublabel: (w.whale_id ?? "").trim() || undefined,
              href: ROUTES.admin.whaleDetail(w.id),
              score: fuzzyMatchAny([label, w.whale_id], q),
            };
          }),
      );
    })();

    const customsPromise = (async (): Promise<SearchHit[]> => {
      const all = await listAllCustomRequests();
      return topScored(
        all
          .filter((c) => {
            if (staffMode === "chatter" && chatterRecordId) {
              if (c.requested_by_chatter_id !== chatterRecordId) return false;
            } else if (session.role === "model" && modelLinkedRecordId) {
              if (c.assigned_model_id !== modelLinkedRecordId) return false;
            }
            return true;
          })
          .map((c) => {
            const title = (c.request_title ?? "").trim();
            const fan = (c.fan_username ?? "").trim();
            return {
              id: c.id,
              label: title || fan || "Custom request",
              sublabel: title && fan ? fan : undefined,
              href: `${ROUTES.admin.customRequests}?id=${encodeURIComponent(c.id)}`,
              score: fuzzyMatchAny([title, fan], q),
            };
          }),
      );
    })();

    const [
      models,
      people,
      pages,
      sops,
      credentials,
      candidates,
      winners,
      templates,
      whales,
      customs,
    ] = await Promise.all([
      modelsPromise,
      peoplePromise,
      pagesPromise,
      sopsPromise,
      credentialsPromise,
      candidatesPromise,
      winnersPromise,
      templatesPromise,
      whalesPromise,
      customsPromise,
    ]);

    const body: SearchResponse = {
      models,
      people,
      pages,
      sops,
      credentials,
      candidates,
      winners,
      templates,
      whales,
      customs,
    };
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/search]", msg);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
