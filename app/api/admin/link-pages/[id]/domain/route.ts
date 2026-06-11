import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import {
  addDomainToVercel,
  getDomainStatus,
  isVercelDomainsConfigured,
  normalizeDomain,
  removeDomainFromVercel,
} from "@/lib/vercel-domains";
import { getLinkPageById, updateLinkPage } from "@/services/link-pages";
import { listRecords } from "@/lib/airtable-server";
import { LINK_PAGES_TABLE } from "@/lib/link-pages-schema";

type Ctx = { params: Promise<{ id: string }> };

function escapeFormulaString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function assertDomainAvailable(domain: string, pageId: string): Promise<void> {
  const normalized = normalizeDomain(domain);
  const { records } = await listRecords<{ custom_domain?: string }>(LINK_PAGES_TABLE, {
    filterByFormula: `LOWER({custom_domain})="${escapeFormulaString(normalized)}"`,
    pageSize: 5,
    _caller: "link-page-domain-check",
  });
  const conflict = records.find((r) => r.id !== pageId);
  if (conflict) {
    throw new Error("This domain is already assigned to another link page");
  }
}

export async function GET(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const vercelConfigured = isVercelDomainsConfigured();
  const { id } = await ctx.params;
  const page = await getLinkPageById(id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const domainParam = url.searchParams.get("domain")?.trim();
  const domain = normalizeDomain(domainParam || page.custom_domain);

  if (!domain) {
    return NextResponse.json({ vercelConfigured, domain: "", verified: false, records: [] });
  }

  if (!vercelConfigured) {
    return NextResponse.json({
      vercelConfigured: false,
      domain,
      verified: false,
      records: [],
      error: "Vercel domain management is not configured",
    });
  }

  try {
    const status = await getDomainStatus(domain);
    return NextResponse.json({ vercelConfigured: true, ...status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status check failed";
    return NextResponse.json(
      {
        vercelConfigured: true,
        domain,
        verified: false,
        records: [],
        error: message,
      },
      { status: 400 }
    );
  }
}

export async function POST(request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isVercelDomainsConfigured()) {
    return NextResponse.json(
      { error: "Vercel domain management is not configured. Set VERCEL_TOKEN and VERCEL_PROJECT_ID." },
      { status: 503 }
    );
  }

  const { id } = await ctx.params;
  const page = await getLinkPageById(id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { domain?: string };
  try {
    body = (await request.json()) as { domain?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const domain = normalizeDomain(body.domain ?? "");
  if (!domain) return NextResponse.json({ error: "Domain is required" }, { status: 400 });

  try {
    await assertDomainAvailable(domain, id);

    if (page.custom_domain && normalizeDomain(page.custom_domain) !== domain) {
      await removeDomainFromVercel(page.custom_domain);
    }

    const status = await addDomainToVercel(domain);
    const updated = await updateLinkPage(id, { custom_domain: status.domain });
    revalidatePath(`/l/${updated.slug}`);

    return NextResponse.json({
      vercelConfigured: true,
      page: updated,
      ...status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to connect domain";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasPermission(session, PERMISSIONS.LINK_PAGES_MANAGE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const page = await getLinkPageById(id);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const domain = normalizeDomain(page.custom_domain);
  if (!domain) {
    return NextResponse.json({ success: true, page });
  }

  try {
    if (isVercelDomainsConfigured()) {
      await removeDomainFromVercel(domain);
    }
    const updated = await updateLinkPage(id, { custom_domain: "" });
    revalidatePath(`/l/${updated.slug}`);
    return NextResponse.json({ success: true, page: updated, vercelConfigured: isVercelDomainsConfigured() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove domain";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
