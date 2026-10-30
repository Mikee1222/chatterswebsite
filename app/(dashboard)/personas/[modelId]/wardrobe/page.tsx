import { redirect, notFound } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { resolveWardrobeAccess } from "@/lib/wardrobe-access";
import { getModelById } from "@/services/modelss";
import { listWardrobe } from "@/services/model-wardrobe";
import { ModelWardrobeClient } from "@/components/model-wardrobe-client";

export default async function ModelWardrobePage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);

  const { modelId: raw } = await params;
  const modelId = decodeURIComponent(raw ?? "").trim();
  if (!modelId) notFound();

  const access = await resolveWardrobeAccess(user, modelId);
  if (!access.canView) redirect(ROUTES.personas);

  const model = await getModelById(modelId).catch(() => null);
  if (!model) notFound();

  const bundle = await listWardrobe(modelId, { includeInactive: access.canEdit }).catch(() => ({
    items: [],
    rules: "",
  }));

  return (
    <ModelWardrobeClient
      modelId={modelId}
      modelName={model.model_name}
      initialItems={bundle.items}
      initialRules={bundle.rules}
      canEdit={access.canEdit}
    />
  );
}
