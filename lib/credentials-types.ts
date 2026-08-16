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

export type CredentialSecretData = Partial<Record<CredentialField, string>>;

export type CredentialAccessAction =
  | "viewed_masked"
  | "revealed"
  | "copied"
  | "created"
  | "updated"
  | "deleted";

export const CREDENTIAL_CATEGORIES = [
  "OnlyFans",
  "Instagram",
  "Twitter/X",
  "TikTok",
  "Email",
  "iCloud",
  "Phone",
  "Payment",
  "General",
  "Other",
] as const;

export type CredentialCategory = (typeof CREDENTIAL_CATEGORIES)[number];

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

export const MASKED_VALUE = "••••••••";
