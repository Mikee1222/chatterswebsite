import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  AIRTABLE_TOKEN: z.string().min(1, "AIRTABLE_TOKEN is required"),
  AIRTABLE_BASE_ID: z.string().min(1, "AIRTABLE_BASE_ID is required"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const raw = {
    AIRTABLE_TOKEN: process.env.AIRTABLE_TOKEN ?? "",
    AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID ?? "",
  };

  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment variables:\n${issues}\n\nCopy .env.example to .env and fill in values.`
    );
  }
  return result.data;
}

export const env = loadEnv();
