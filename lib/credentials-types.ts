/** Fields stored inside encrypted_data JSON blob. */
export const CREDENTIAL_FIELDS = [
  "username",
  "password",
  "email",
  "email_password",
  "phone",
  "backup_codes",
  "recovery_email",
  "recovery_password",
  "notes",
] as const;

export type CredentialField = (typeof CREDENTIAL_FIELDS)[number];

/** JSON key inside encrypted payload for dynamic custom fields. */
export const CUSTOM_FIELDS_STORAGE_KEY = "__customFields__";

/** API prefix for reveal/copy of custom fields: `custom:fieldKey`. */
export const CUSTOM_FIELD_API_PREFIX = "custom:";

export type CredentialCustomFields = Record<string, string>;

export type CredentialSecretData = Partial<Record<CredentialField, string>> & {
  customFields?: CredentialCustomFields;
};

export type CredentialFieldRef = CredentialField | `${typeof CUSTOM_FIELD_API_PREFIX}${string}`;

export type CredentialAccessAction =
  | "viewed_masked"
  | "revealed"
  | "copied"
  | "created"
  | "updated"
  | "deleted";

/** Suggested categories for autocomplete — free text allowed. */
export const CREDENTIAL_CATEGORY_SUGGESTIONS = [
  "OnlyFans",
  "Instagram",
  "TikTok",
  "Facebook",
  "Snapchat",
  "Twitter/X",
  "Email",
  "iCloud",
  "Apple",
  "Phone",
  "SIM",
  "PayPal",
  "Payment",
  "General",
  "Other",
] as const;

/** @deprecated Use CREDENTIAL_CATEGORY_SUGGESTIONS — kept for backwards compatibility. */
export const CREDENTIAL_CATEGORIES = CREDENTIAL_CATEGORY_SUGGESTIONS;

export type CredentialCategory = (typeof CREDENTIAL_CATEGORY_SUGGESTIONS)[number];

export const CREDENTIAL_FIELD_LABELS: Record<CredentialField, string> = {
  username: "Username",
  password: "Password",
  email: "Email",
  email_password: "Email password",
  phone: "Phone",
  backup_codes: "Backup codes",
  recovery_email: "Recovery email",
  recovery_password: "Recovery password",
  notes: "Notes",
};

/** Fields shown unmasked in list metadata (searchable without decrypting secrets). */
export const CREDENTIAL_LIST_PLAINTEXT_FIELDS: CredentialField[] = ["username", "email"];

export const MASKED_VALUE = "••••••••";

export function isCredentialField(value: string): value is CredentialField {
  return (CREDENTIAL_FIELDS as readonly string[]).includes(value);
}

export function isCustomFieldRef(value: string): value is `${typeof CUSTOM_FIELD_API_PREFIX}${string}` {
  return value.startsWith(CUSTOM_FIELD_API_PREFIX) && value.length > CUSTOM_FIELD_API_PREFIX.length;
}

export function parseCredentialFieldRef(value: unknown): CredentialFieldRef | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (isCredentialField(value)) return value;
  if (isCustomFieldRef(value)) return value;
  return null;
}

export function customFieldRefKey(ref: `${typeof CUSTOM_FIELD_API_PREFIX}${string}`): string {
  return ref.slice(CUSTOM_FIELD_API_PREFIX.length);
}

export function toCustomFieldRef(key: string): `${typeof CUSTOM_FIELD_API_PREFIX}${string}` {
  return `${CUSTOM_FIELD_API_PREFIX}${key}`;
}

export function parseCustomFieldsFromSecrets(secrets: Record<string, string>): CredentialCustomFields {
  const raw = secrets[CUSTOM_FIELDS_STORAGE_KEY]?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const out: CredentialCustomFields = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const key = k.trim();
      const value = v == null ? "" : String(v).trim();
      if (key && value) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeCustomFieldsToStorage(customFields: CredentialCustomFields | undefined): string {
  const out: CredentialCustomFields = {};
  if (customFields) {
    for (const [k, v] of Object.entries(customFields)) {
      const key = k.trim();
      const value = v?.trim() ?? "";
      if (key && value) out[key] = value;
    }
  }
  return JSON.stringify(out);
}
