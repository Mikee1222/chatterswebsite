"use server";

import { getAccountsByVA, getPhonesByVA, type Phone, type SocialAccount } from "@/services/marketing";

export type ModelProfileGroup = {
  model_id: string;
  model_name: string;
  accounts: SocialAccount[];
};

export type MyProfilesData = {
  models: ModelProfileGroup[];
  phones: Phone[];
};

/** Assigned models + phones for a single VA — always scoped to `vaUserId`. */
export async function getMyProfilesData(vaUserId: string): Promise<MyProfilesData> {
  const userId = vaUserId.trim();
  if (!userId) return { models: [], phones: [] };

  const [accounts, phones] = await Promise.all([getAccountsByVA(userId), getPhonesByVA(userId)]);

  const modelMap = new Map<string, ModelProfileGroup>();
  for (const acc of accounts) {
    if (acc.assigned_va_id !== userId) continue;
    const key = acc.model_id?.trim() || "unknown";
    const existing = modelMap.get(key);
    if (existing) {
      existing.accounts.push(acc);
    } else {
      modelMap.set(key, {
        model_id: key,
        model_name: acc.model_name?.trim() || "Creator",
        accounts: [acc],
      });
    }
  }

  const models = [...modelMap.values()].sort((a, b) => a.model_name.localeCompare(b.model_name));

  return {
    models,
    phones: phones.filter((phone) => phone.assigned_va_id === userId),
  };
}
