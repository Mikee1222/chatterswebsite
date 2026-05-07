import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { getModelDashboardLanguage } from "@/lib/model-context-server";
import { LanguageProvider } from "@/lib/language-provider";
import { ModelQuickActionsFab } from "@/components/model-quick-actions-modal";

/** Model area: only users with role `model` may access `/model/*` (middleware + this layout). */
export default async function ModelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionFromCookies();
  if (!user) redirect(ROUTES.login);
  if (user.role !== "model") redirect(ROUTES.dashboard);
  const initialLanguage = await getModelDashboardLanguage(user).catch((error) => {
    console.error("[model/layout] getModelDashboardLanguage failed; using 'en' fallback", error);
    return "en" as const;
  });

  return (
    <LanguageProvider initialLanguage={initialLanguage}>
      <ModelQuickActionsFab user={user} />
      {children}
    </LanguageProvider>
  );
}
