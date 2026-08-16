import { normalizeCategoryKey } from "@/lib/credentials-ui-helpers";
import type { MaskedCredentialEntry } from "@/services/credential-entries";

export function normalizeUsername(username: string): string {
  return username.trim().replace(/^@+/, "").toLowerCase();
}

export function resolveModelUuid(
  modelId: string,
  uuidByPublicId: Record<string, string>,
): string {
  if (!modelId.trim()) return modelId;
  return uuidByPublicId[modelId] ?? modelId;
}

export function platformToCredentialCategory(platform: string): string {
  return platform.trim() || "Other";
}

export function findSocialAccountCredential(
  entries: MaskedCredentialEntry[],
  opts: {
    modelId: string;
    platform: string;
    username: string;
    uuidByPublicId?: Record<string, string>;
  },
): MaskedCredentialEntry | undefined {
  const resolvedModelId = opts.uuidByPublicId
    ? resolveModelUuid(opts.modelId, opts.uuidByPublicId)
    : opts.modelId;
  const user = normalizeUsername(opts.username);
  if (!resolvedModelId || !user) return undefined;

  const platformNorm = opts.platform.trim().toLowerCase();
  const catKey = normalizeCategoryKey(platformToCredentialCategory(opts.platform));

  const exactCategory = entries.find(
    (e) =>
      e.model_id === resolvedModelId &&
      e.category.trim().toLowerCase() === platformNorm &&
      normalizeUsername(e.fields.username) === user,
  );
  if (exactCategory) return exactCategory;

  return entries.find(
    (e) =>
      e.model_id === resolvedModelId &&
      normalizeCategoryKey(e.category) === catKey &&
      normalizeUsername(e.fields.username) === user,
  );
}

export function findAppleIdCredentialByEmail(
  entries: MaskedCredentialEntry[],
  icloudEmail: string,
): MaskedCredentialEntry | undefined {
  const email = icloudEmail.trim().toLowerCase();
  if (!email) return undefined;
  return entries.find(
    (e) =>
      normalizeCategoryKey(e.category) === "apple" &&
      (e.fields.email.trim().toLowerCase() === email ||
        normalizeUsername(e.fields.username) === email),
  );
}

export function findAppleIdCredentialForModel(
  entries: MaskedCredentialEntry[],
  opts: {
    modelId: string;
    uuidByPublicId?: Record<string, string>;
  },
): MaskedCredentialEntry | undefined {
  const resolvedModelId = opts.uuidByPublicId
    ? resolveModelUuid(opts.modelId, opts.uuidByPublicId)
    : opts.modelId;
  if (!resolvedModelId) return undefined;

  const appleEntries = entries.filter(
    (e) =>
      e.model_id === resolvedModelId && normalizeCategoryKey(e.category) === "apple",
  );
  if (appleEntries.length === 1) return appleEntries[0];
  return undefined;
}

export function findAppleIdCredentialForPhone(
  entries: MaskedCredentialEntry[],
  opts: {
    icloudEmail: string;
    linkedModelIds?: string[];
    uuidByPublicId?: Record<string, string>;
  },
): MaskedCredentialEntry | undefined {
  const byEmail = findAppleIdCredentialByEmail(entries, opts.icloudEmail);
  if (byEmail) return byEmail;

  for (const modelId of opts.linkedModelIds ?? []) {
    const match = findAppleIdCredentialForModel(entries, {
      modelId,
      uuidByPublicId: opts.uuidByPublicId,
    });
    if (match) return match;
  }
  return undefined;
}

export function buildCredentialQuickAddDefaults(opts: {
  modelId: string;
  platform: string;
  username: string;
  uuidByPublicId?: Record<string, string>;
}): {
  model_id: string;
  category: string;
  label: string;
  username: string;
} {
  const resolvedModelId = opts.uuidByPublicId
    ? resolveModelUuid(opts.modelId, opts.uuidByPublicId)
    : opts.modelId;
  const username = normalizeUsername(opts.username);
  const category = platformToCredentialCategory(opts.platform);
  return {
    model_id: resolvedModelId,
    category,
    label: username ? `@${username}` : category,
    username,
  };
}

export function buildAppleCredentialQuickAddDefaults(opts: {
  icloudEmail: string;
  modelId?: string;
  uuidByPublicId?: Record<string, string>;
}): {
  model_id: string | null;
  category: string;
  label: string;
  email: string;
} {
  const email = opts.icloudEmail.trim();
  const resolvedModelId = opts.modelId
    ? opts.uuidByPublicId
      ? resolveModelUuid(opts.modelId, opts.uuidByPublicId)
      : opts.modelId
    : null;
  return {
    model_id: resolvedModelId,
    category: "Apple ID",
    label: email || "Apple ID",
    email,
  };
}
