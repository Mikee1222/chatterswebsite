/**
 * Vercel custom domain management for link pages.
 *
 * Required env vars (server-only — never expose VERCEL_TOKEN to the client):
 * - VERCEL_TOKEN — Vercel API token with project/domain scope
 * - VERCEL_PROJECT_ID — Vercel project id or name
 * - VERCEL_TEAM_ID — optional; required when the project lives under a team
 *
 * Domains added here are served by the same Vercel deployment; middleware rewrites
 * non-app hosts to /l/{slug} when custom_domain matches (see middleware.ts).
 */

const VERCEL_API = "https://api.vercel.com";

export type DnsRecord = {
  type: "A" | "CNAME" | "TXT";
  name: string;
  value: string;
};

export type DomainStatusResult = {
  domain: string;
  verified: boolean;
  records: DnsRecord[];
};

export function isVercelDomainsConfigured(): boolean {
  return Boolean(process.env.VERCEL_TOKEN?.trim() && process.env.VERCEL_PROJECT_ID?.trim());
}

export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .split(":")[0] ?? "";
}

function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain);
}

function isApexDomain(domain: string): boolean {
  return domain.split(".").length === 2;
}

/** DNS records users must configure at their registrar. */
export function getDnsRecordsForDomain(domain: string): DnsRecord[] {
  if (isApexDomain(domain)) {
    return [
      { type: "A", name: "@", value: "76.76.21.21" },
      { type: "CNAME", name: "www", value: "cname.vercel-dns.com" },
    ];
  }
  const label = domain.split(".")[0] ?? domain;
  return [{ type: "CNAME", name: label, value: "cname.vercel-dns.com" }];
}

function vercelProjectId(): string {
  const id = process.env.VERCEL_PROJECT_ID?.trim();
  if (!id) throw new Error("VERCEL_PROJECT_ID is not configured");
  return id;
}

function vercelApiUrl(path: string): string {
  const url = new URL(`${VERCEL_API}${path}`);
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (teamId) url.searchParams.set("teamId", teamId);
  return url.toString();
}

async function vercelFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) throw new Error("VERCEL_TOKEN is not configured");

  return fetch(vercelApiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

type VercelDomainResponse = {
  name?: string;
  verified?: boolean;
  error?: { message?: string; code?: string };
};

function parseVercelError(body: VercelDomainResponse, fallback: string): string {
  return body.error?.message?.trim() || fallback;
}

export async function addDomainToVercel(domain: string): Promise<DomainStatusResult> {
  const normalized = normalizeDomain(domain);
  if (!isValidDomain(normalized)) {
    throw new Error("Invalid domain name");
  }
  if (!isVercelDomainsConfigured()) {
    throw new Error("Vercel domain management is not configured");
  }

  const projectId = vercelProjectId();
  const res = await vercelFetch(`/v10/projects/${encodeURIComponent(projectId)}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: normalized }),
  });

  const body = (await res.json()) as VercelDomainResponse;
  if (!res.ok) {
    throw new Error(parseVercelError(body, `Failed to add domain (${res.status})`));
  }

  return {
    domain: body.name ?? normalized,
    verified: body.verified === true,
    records: getDnsRecordsForDomain(normalized),
  };
}

export async function getDomainStatus(domain: string): Promise<DomainStatusResult> {
  const normalized = normalizeDomain(domain);
  if (!isValidDomain(normalized)) {
    throw new Error("Invalid domain name");
  }
  if (!isVercelDomainsConfigured()) {
    throw new Error("Vercel domain management is not configured");
  }

  const projectId = vercelProjectId();
  const res = await vercelFetch(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(normalized)}`
  );

  const body = (await res.json()) as VercelDomainResponse;
  if (!res.ok) {
    throw new Error(parseVercelError(body, `Failed to get domain status (${res.status})`));
  }

  return {
    domain: body.name ?? normalized,
    verified: body.verified === true,
    records: getDnsRecordsForDomain(normalized),
  };
}

export async function removeDomainFromVercel(domain: string): Promise<void> {
  const normalized = normalizeDomain(domain);
  if (!normalized) return;
  if (!isVercelDomainsConfigured()) {
    throw new Error("Vercel domain management is not configured");
  }

  const projectId = vercelProjectId();
  const res = await vercelFetch(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(normalized)}`,
    { method: "DELETE" }
  );

  if (res.status === 404) return;

  const body = (await res.json().catch(() => ({}))) as VercelDomainResponse;
  if (!res.ok) {
    throw new Error(parseVercelError(body, `Failed to remove domain (${res.status})`));
  }
}
