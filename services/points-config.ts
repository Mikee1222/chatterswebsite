import { createRecord, listRecords, updateRecord } from "@/lib/airtable-server";
import { escapeAirtableString } from "@/lib/airtable-linked";
import { isSupabaseBackend } from "@/lib/data-backend";
import { getSystemSetting, setSystemSetting } from "@/services/system-settings";

const TABLE = "system_settings";
const CONFIG_KEY = "points_config";

export const DEFAULT_CONFIG = {
  LEVEL_BRONZE_MIN: 0,
  LEVEL_SILVER_MIN: 500,
  LEVEL_GOLD_MIN: 1500,
  LEVEL_DIAMOND_MIN: 5000,
  SHIFT_PER_HOUR: 10,
  SHIFT_NO_BREAK_BONUS: 25,
  SHIFT_NIGHT_BONUS: 100,
  SHIFT_ON_TIME: 30,
  SHIFT_LATE_PENALTY: -20,
  WHALE_ADDED: 20,
  WHALE_TRANSACTION: 5,
  WHALE_STATUS_UPGRADE: 15,
  WHALE_RETURNED: 20,
  WHALE_NOTE_ADDED: 10,
  WHALE_SIMP_OR_LOVE: 30,
  CUSTOM_COMPLETED: 25,
  STREAK_5_DAYS: 50,
  STREAK_30_DAYS: 150,
  AVAILABILITY_SUBMITTED: 15,
  REBILL_VERIFIED: 50,
  /**
   * Points per $100 of Infloww total sales (incremental).
   * Default 10 mirrors SHIFT_PER_HOUR — ~$100 revenue ≈ 1 hour of shift points.
   */
  INFLOWW_SALES_PER_100: 10,
  POINTS_PER_SPIN: 500,
} as const;

export type PointsConfig = {
  [K in keyof typeof DEFAULT_CONFIG]: number;
};

type SystemSettingFields = {
  setting_key?: string;
  setting_value?: string;
  description?: string;
};

function mergeParsed(raw: unknown): PointsConfig {
  const base: Record<keyof PointsConfig, number> = {
    ...(DEFAULT_CONFIG as unknown as Record<keyof PointsConfig, number>),
  };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(base) as (keyof PointsConfig)[]) {
    const v = o[k as string];
    if (typeof v === "number" && Number.isFinite(v)) {
      base[k] = v;
    }
  }
  base.LEVEL_BRONZE_MIN = 0;
  return base as PointsConfig;
}

export async function getPointsConfig(): Promise<PointsConfig> {
  try {
    if (isSupabaseBackend()) {
      const raw = await getSystemSetting(CONFIG_KEY);
      if (raw == null || String(raw).trim() === "") return { ...DEFAULT_CONFIG };
      return mergeParsed(JSON.parse(String(raw)) as unknown);
    }
    const escaped = escapeAirtableString(CONFIG_KEY);
    const { records } = await listRecords<SystemSettingFields>(TABLE, {
      filterByFormula: `{setting_key} = "${escaped}"`,
      pageSize: 1,
      _caller: "points-config.getPointsConfig",
    });
    const raw = records[0]?.fields?.setting_value;
    if (raw == null || String(raw).trim() === "") return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(String(raw)) as unknown;
    return mergeParsed(parsed);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function savePointsConfig(config: PointsConfig): Promise<void> {
  const value = JSON.stringify(config);
  if (isSupabaseBackend()) {
    await setSystemSetting(CONFIG_KEY, value, "Rewards points configuration (JSON)");
    return;
  }
  const escaped = escapeAirtableString(CONFIG_KEY);
  const { records } = await listRecords<SystemSettingFields>(TABLE, {
    filterByFormula: `{setting_key} = "${escaped}"`,
    pageSize: 1,
    _caller: "points-config.savePointsConfig",
  });
  if (records[0]?.id) {
    await updateRecord<SystemSettingFields>(TABLE, records[0].id, { setting_value: value });
    return;
  }
  await createRecord<SystemSettingFields>(TABLE, {
    setting_key: CONFIG_KEY,
    setting_value: value,
    description: "Rewards points configuration (JSON)",
  });
}
