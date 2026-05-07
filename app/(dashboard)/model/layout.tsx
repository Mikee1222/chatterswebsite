import { redirect } from "next/navigation";
import { getModelContext } from "@/lib/model-context-server";
import { LanguageProvider } from "@/lib/language-provider";
import { ModelQuickActionsFab } from "@/components/model-quick-actions-modal";

export const dynamic = "force-dynamic";

function isRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export default async function ModelLayout({ children }: { children: React.ReactNode }) {
  let ctx: Awaited<ReturnType<typeof getModelContext>>;
  try {
    ctx = await getModelContext();
    if (!ctx?.user) redirect("/login");
    if (ctx.user.role !== "model") redirect("/login");
  } catch (e) {
    if (isRedirectError(e)) throw e;
    redirect("/login");
  }

  return (
    <LanguageProvider initialLanguage="en">
      <div className="relative z-20 min-h-[100vh]">
        {children}
        <ModelQuickActionsFab user={ctx.user} />
      </div>
    </LanguageProvider>
  );
}
