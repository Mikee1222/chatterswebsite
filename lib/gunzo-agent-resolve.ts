/**
 * Gunzo Agent — fuzzy name → record id resolution for models and chatters/VAs.
 * Used before tool execution so the agent can pass natural names instead of ids.
 */

import { fuzzyScore } from "@/lib/fuzzy-search";
import type { ModelRecord, UserRecord } from "@/types";
import { listAllModelss } from "@/services/modelss";
import { listAllUsers } from "@/services/users";
import { getAllAccounts } from "@/services/marketing";
import type { GunzoToolName } from "@/lib/gunzo-agent-tools";

export type GunzoResolveErrorResult = {
  ok: false;
  summary: string;
  error: string;
  data?: unknown;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AIRTABLE_RE = /^rec[a-zA-Z0-9]{10,}$/;

export type ResolveOption = {
  id: string;
  display_name: string;
  hint?: string;
};

export type EntityResolveResult =
  | { status: "resolved"; id: string; display_name: string }
  | { status: "ambiguous"; query: string; options: ResolveOption[] }
  | { status: "not_found"; query: string; suggestions: string[] };

export type ModelCatalogEntry = {
  id: string;
  model_id: string;
  model_name: string;
  team: string;
  status: string;
  aliases: string[];
};

export type UserCatalogEntry = {
  id: string;
  public_id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  infloww_employee_id: string;
  aliases: string[];
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

function looksLikeRecordId(value: string): boolean {
  const v = value.trim();
  return Boolean(v) && (UUID_RE.test(v) || AIRTABLE_RE.test(v) || v.startsWith("model_"));
}

/** Extract searchable aliases from a model display name + optional stage names. */
export function extractModelAliases(modelName: string, extra: string[] = []): string[] {
  const out = new Set<string>();
  const name = modelName.trim();
  if (!name) return [];

  out.add(name);

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    out.add(parts[0]!);
  }

  const paren = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (paren) {
    const base = paren[1]!.trim();
    const qualifier = paren[2]!.trim();
    if (base) {
      out.add(base);
      out.add(`${base} (${qualifier})`);
      out.add(`${base} ${qualifier}`);
    }
  }

  const first = parts[0]?.toLowerCase();
  if (first === "melina") {
    out.add("Melina");
    out.add("Lina");
  }

  for (const alias of extra) {
    const a = alias.trim();
    if (a) out.add(a);
  }

  return [...out];
}

/** Extract searchable aliases for a chatter/VA user row. */
export function extractUserAliases(user: Pick<UserRecord, "full_name" | "email" | "user_id">): string[] {
  const out = new Set<string>();
  const full = user.full_name.trim();
  if (full) {
    out.add(full);
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      out.add(parts[0]!);
      out.add(`${parts[0]!} ${parts[parts.length - 1]!}`);
    }
  }
  const email = user.email.trim();
  if (email) {
    out.add(email);
    const local = email.split("@")[0]?.trim();
    if (local) out.add(local);
  }
  if (user.user_id.trim()) out.add(user.user_id.trim());
  return [...out];
}

export function buildModelCatalog(
  models: ModelRecord[],
  stageNamesByModelId: Map<string, string[]> = new Map(),
): ModelCatalogEntry[] {
  return models
    .filter((m) => m.model_name?.trim())
    .map((m) => ({
      id: m.id,
      model_id: m.model_id?.trim() ?? "",
      model_name: m.model_name.trim(),
      team: m.team ?? "gunzo_team",
      status: m.status ?? "",
      aliases: extractModelAliases(m.model_name, stageNamesByModelId.get(m.id) ?? []),
    }));
}

export function buildUserCatalog(users: UserRecord[]): UserCatalogEntry[] {
  return users
    .filter((u) => u.full_name?.trim() || u.email?.trim())
    .map((u) => {
      const infloww =
        u.infloww_employee_id != null && Number.isFinite(Number(u.infloww_employee_id))
          ? String(u.infloww_employee_id)
          : "";
      const aliases = extractUserAliases(u);
      if (infloww) aliases.push(infloww);
      return {
        id: u.id,
        public_id: u.id,
        user_id: u.user_id?.trim() ?? "",
        full_name: u.full_name?.trim() ?? "",
        email: u.email?.trim() ?? "",
        role: u.role ?? "",
        infloww_employee_id: infloww,
        aliases: [...new Set(aliases)],
      };
    });
}

function modelHint(entry: ModelCatalogEntry): string {
  const bits = [
    entry.team === "chatting_agency" ? "Chatting Agency" : "Gunzo Team",
    entry.status ? entry.status : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

function userHint(entry: UserCatalogEntry): string {
  const bits = [entry.role, entry.email].filter(Boolean);
  return bits.join(" · ");
}

function scoreCatalogMatch(
  query: string,
  entry: { id: string; aliases: string[]; extraIds?: string[] },
): number {
  const q = query.trim();
  if (!q) return 0;

  for (const id of [entry.id, ...(entry.extraIds ?? [])]) {
    if (id && id.toLowerCase() === q.toLowerCase()) return 1000;
  }

  let best = 0;
  for (const alias of entry.aliases) {
    const s = fuzzyScore(alias, q);
    if (s > best) best = s;
    if (alias.toLowerCase() === q.toLowerCase()) best = Math.max(best, 950);
  }
  return best;
}

function pickEntityMatch<T extends { id: string }>(
  query: string,
  scored: Array<{ score: number; entry: T; display_name: string; hint?: string }>,
  suggestions: string[],
): EntityResolveResult {
  const q = query.trim();
  const viable = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

  if (!viable.length) {
    return { status: "not_found", query: q, suggestions: suggestions.slice(0, 8) };
  }

  const top = viable[0]!;
  const second = viable[1];

  const topExact = viable.filter((v) => v.score >= 950);
  if (topExact.length > 1) {
    return {
      status: "ambiguous",
      query: q,
      options: topExact.map((v) => ({
        id: v.entry.id,
        display_name: v.display_name,
        hint: v.hint,
      })),
    };
  }

  if (second && top.score - second.score < 80 && top.score < 950) {
    const close = viable.filter((v) => top.score - v.score < 80);
    if (close.length > 1) {
      return {
        status: "ambiguous",
        query: q,
        options: close.map((v) => ({
          id: v.entry.id,
          display_name: v.display_name,
          hint: v.hint,
        })),
      };
    }
  }

  if (top.score < 200) {
    return { status: "not_found", query: q, suggestions: suggestions.slice(0, 8) };
  }

  return {
    status: "resolved",
    id: top.entry.id,
    display_name: top.display_name,
  };
}

/** Pure resolver — testable without DB. */
export function resolveModelNameFromCatalog(
  query: string,
  catalog: ModelCatalogEntry[],
): EntityResolveResult {
  const q = query.trim();
  if (!q) return { status: "not_found", query: q, suggestions: [] };

  if (looksLikeRecordId(q)) {
    const byId = catalog.find(
      (m) => m.id.toLowerCase() === q.toLowerCase() || m.model_id.toLowerCase() === q.toLowerCase(),
    );
    if (byId) {
      return { status: "resolved", id: byId.id, display_name: byId.model_name };
    }
  }

  const scored = catalog.map((entry) => ({
    score: scoreCatalogMatch(q, {
      id: entry.id,
      aliases: entry.aliases,
      extraIds: [entry.model_id],
    }),
    entry,
    display_name: entry.model_name,
    hint: modelHint(entry),
  }));

  return pickEntityMatch(
    q,
    scored,
    catalog.map((m) => m.model_name).sort(),
  );
}

/** Pure resolver — testable without DB. */
export function resolveChatterNameFromCatalog(
  query: string,
  catalog: UserCatalogEntry[],
): EntityResolveResult {
  const q = query.trim();
  if (!q) return { status: "not_found", query: q, suggestions: [] };

  if (looksLikeRecordId(q) || /^\d+$/.test(q)) {
    const byId = catalog.find(
      (u) =>
        u.id.toLowerCase() === q.toLowerCase() ||
        u.public_id.toLowerCase() === q.toLowerCase() ||
        u.user_id.toLowerCase() === q.toLowerCase() ||
        u.infloww_employee_id === q,
    );
    if (byId) {
      return { status: "resolved", id: byId.public_id, display_name: byId.full_name || byId.email };
    }
  }

  const scored = catalog.map((entry) => ({
    score: scoreCatalogMatch(q, {
      id: entry.id,
      aliases: entry.aliases,
      extraIds: [entry.public_id, entry.user_id, entry.infloww_employee_id],
    }),
    entry,
    display_name: entry.full_name || entry.email || entry.user_id,
    hint: userHint(entry),
  }));

  return pickEntityMatch(
    q,
    scored,
    catalog.map((u) => u.full_name).filter(Boolean).sort(),
  );
}

let modelCatalogPromise: Promise<ModelCatalogEntry[]> | null = null;
let userCatalogPromise: Promise<UserCatalogEntry[]> | null = null;

export function resetGunzoAgentResolveCache(): void {
  modelCatalogPromise = null;
  userCatalogPromise = null;
}

async function loadModelCatalog(): Promise<ModelCatalogEntry[]> {
  if (!modelCatalogPromise) {
    modelCatalogPromise = (async () => {
      const [models, accounts] = await Promise.all([
        listAllModelss(),
        getAllAccounts().catch(() => []),
      ]);
      const stageNamesByModelId = new Map<string, string[]>();
      for (const a of accounts) {
        const mid = a.model_id?.trim();
        const username = a.username?.trim();
        if (!mid || !username) continue;
        const list = stageNamesByModelId.get(mid) ?? [];
        list.push(username);
        stageNamesByModelId.set(mid, list);
      }
      return buildModelCatalog(models, stageNamesByModelId);
    })();
  }
  return modelCatalogPromise;
}

async function loadUserCatalog(): Promise<UserCatalogEntry[]> {
  if (!userCatalogPromise) {
    userCatalogPromise = (async () => {
      const users = await listAllUsers();
      const relevant = users.filter(
        (u) =>
          u.role === "chatter" ||
          u.role === "virtual_assistant" ||
          u.secondary_role === "chatter" ||
          u.secondary_role === "virtual_assistant",
      );
      return buildUserCatalog(relevant.length ? relevant : users);
    })();
  }
  return userCatalogPromise;
}

export async function resolveModelName(name: string): Promise<EntityResolveResult> {
  const catalog = await loadModelCatalog();
  return resolveModelNameFromCatalog(name, catalog);
}

export async function resolveChatterName(name: string): Promise<EntityResolveResult> {
  const catalog = await loadUserCatalog();
  return resolveChatterNameFromCatalog(name, catalog);
}

function entityErrorResult(
  entityType: "model" | "chatter",
  field: string,
  result: Extract<EntityResolveResult, { status: "ambiguous" | "not_found" }>,
): GunzoResolveErrorResult {
  if (result.status === "ambiguous") {
    return {
      ok: false,
      summary: `Ambiguous ${entityType} name "${result.query}"`,
      error: "ambiguous_entity",
      data: {
        entity_type: entityType,
        field,
        query: result.query,
        options: result.options,
        message:
          `Multiple ${entityType}s match "${result.query}". Ask the user which one they mean — list the options with display_name and hint. Do not guess.`,
      },
    };
  }
  return {
    ok: false,
    summary: `${entityType} not found: "${result.query}"`,
    error: "entity_not_found",
    data: {
      entity_type: entityType,
      field,
      query: result.query,
      suggestions: result.suggestions,
      message: `No ${entityType} matched "${result.query}". Suggest closest names from suggestions if helpful.`,
    },
  };
}

const MODEL_ID_FIELDS = [
  "model_id",
  "model_record_id",
  "model_name_or_id",
  "creator_id",
] as const;
const CHATTER_ID_FIELDS = ["chatter_id", "public_user_id", "va_id", "exec_va_id"] as const;

/**
 * Resolve natural-language names to record ids before tool execution.
 * Returns patched parameters, or a structured error for the agent to clarify.
 */
export async function resolveGunzoToolParameters(
  _toolName: GunzoToolName,
  parameters: Record<string, unknown>,
): Promise<{ parameters: Record<string, unknown> } | { error: GunzoResolveErrorResult }> {
  const next: Record<string, unknown> = { ...parameters };

  const modelCatalog = await loadModelCatalog();
  const userCatalog = await loadUserCatalog();

  for (const field of MODEL_ID_FIELDS) {
    const raw = str(next[field]);
    if (!raw) continue;
    const result = resolveModelNameFromCatalog(raw, modelCatalog);
    if (result.status === "resolved") {
      next[field] = result.id;
      continue;
    }
    if (result.status === "ambiguous" || result.status === "not_found") {
      return { error: entityErrorResult("model", field, result) };
    }
  }

  if (Array.isArray(next.model_ids)) {
    const resolvedIds: string[] = [];
    for (const item of next.model_ids) {
      const raw = str(item);
      if (!raw) continue;
      const result = resolveModelNameFromCatalog(raw, modelCatalog);
      if (result.status === "resolved") {
        resolvedIds.push(result.id);
        continue;
      }
      if (result.status === "ambiguous" || result.status === "not_found") {
        return { error: entityErrorResult("model", "model_ids", result) };
      }
    }
    next.model_ids = resolvedIds;
  }

  for (const field of CHATTER_ID_FIELDS) {
    const raw = str(next[field]);
    if (!raw) continue;
    const result = resolveChatterNameFromCatalog(raw, userCatalog);
    if (result.status === "resolved") {
      next[field] = result.id;
      continue;
    }
    if (result.status === "ambiguous" || result.status === "not_found") {
      return { error: entityErrorResult("chatter", field, result) };
    }
  }

  return { parameters: next };
}
