import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers as getRequestHeaders } from "next/headers";
import { getLinkPageBySlug } from "@/services/link-pages";
import { trackPageView, extractClientIp } from "@/services/link-page-analytics";
import { linkPageThemeCss, renderBrandedLinkHtml, verifiedBadgeHtml } from "@/lib/link-page-styles";
import type { LinkPageBlockRecord, LinkPageWithBlocks } from "@/types";

export const dynamic = "force-dynamic";

const LINK_PAGE_CSP = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "img-src https: data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export async function headers(): Promise<HeadersInit> {
  return {
    "Content-Security-Policy": LINK_PAGE_CSP,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clickUrl(pageId: string, blockId: string, url: string): string {
  const params = new URLSearchParams({ page: pageId, block: blockId, url });
  return `/api/l/click?${params.toString()}`;
}

function renderLinkBlock(page: LinkPageWithBlocks, block: LinkPageBlockRecord): string {
  const href = block.url ? clickUrl(page.page_id, block.block_id, block.url) : "#";
  return renderBrandedLinkHtml(block, href, page.primary_color, escapeHtml);
}

function renderBlock(page: LinkPageWithBlocks, block: LinkPageBlockRecord): string {
  if (!block.is_visible) return "";

  switch (block.block_type) {
    case "link":
      return renderLinkBlock(page, block);
    case "heading":
      return `<div class="block-heading">${escapeHtml(block.heading_text || block.label || "")}</div>`;
    case "bio_text":
      return `<div class="block-bio">${escapeHtml(block.label || block.heading_text || "")}</div>`;
    case "photo_grid": {
      const imgs = block.photo_urls
        .map((u) => `<img src="${escapeHtml(u)}" alt="" loading="lazy" />`)
        .join("");
      return imgs ? `<div class="photo-grid">${imgs}</div>` : "";
    }
    case "countdown": {
      const target = block.countdown_target ?? "";
      return `<div class="countdown" data-countdown="${escapeHtml(target)}">
        <div class="countdown-label">${escapeHtml(block.label || "Countdown")}</div>
        <div class="countdown-time">—</div>
      </div>`;
    }
    case "social_bar": {
      const urls = block.photo_urls.length ? block.photo_urls : block.url ? [block.url] : [];
      const items = urls
        .map((u) => {
          const href = clickUrl(page.page_id, block.block_id, u);
          return `<a href="${escapeHtml(href)}" rel="noopener noreferrer" title="${escapeHtml(block.label || "")}">${escapeHtml(block.icon || "→")}</a>`;
        })
        .join("");
      return items ? `<div class="social-bar">${items}</div>` : "";
    }
    case "spacer": {
      const h = `${Math.max(0.5, block.sort_order * 0.5 + 0.5)}rem`;
      return `<div class="spacer" style="--spacer-h:${h}"></div>`;
    }
    default:
      return "";
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "true";
  const page = await getLinkPageBySlug(slug);

  if (!page || (!isPreview && page.status !== "published")) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }

  const desc = page.meta_description || page.bio || page.title;
  return {
    title: isPreview ? `${page.title} (Preview)` : page.title,
    description: desc,
    robots: { index: false, follow: false },
    openGraph: {
      title: page.title,
      description: desc,
      type: "profile",
      images: page.profile_photo_url ? [{ url: page.profile_photo_url }] : undefined,
    },
    twitter: {
      card: page.profile_photo_url ? "summary_large_image" : "summary",
      title: page.title,
      description: desc,
      images: page.profile_photo_url ? [page.profile_photo_url] : undefined,
    },
  };
}

function randomSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export default async function LinkPagePublic({ params, searchParams }: Props) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "true";
  const page = await getLinkPageBySlug(slug);

  if (!page || (!isPreview && page.status !== "published")) {
    notFound();
  }

  if (!isPreview) {
    const hdrs = await getRequestHeaders();
    trackPageView({
      pageId: page.page_id,
      ip: extractClientIp(hdrs),
      userAgent: hdrs.get("user-agent") ?? "",
      referrer: hdrs.get("referer") ?? "",
      sessionId: randomSessionId(),
    });
  }

  const sortedBlocks = [...page.blocks].sort((a, b) => a.sort_order - b.sort_order);
  const blocksHtml = sortedBlocks.map((b) => renderBlock(page, b)).join("\n");
  const hasCountdown = sortedBlocks.some((b) => b.block_type === "countdown" && b.is_visible);
  const initial = (page.title || "?").charAt(0).toUpperCase();

  return (
    <div className="link-page-root">
      <style dangerouslySetInnerHTML={{ __html: linkPageThemeCss(page) }} />
      <main className="page-wrap">
        {isPreview ? <div className="preview-banner">Draft preview — not visible to the public</div> : null}
        <div className="avatar-wrap">
          <div className="avatar-ring" aria-hidden="true" />
          {page.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar" src={page.profile_photo_url} alt={page.title} />
          ) : (
            <div className="avatar-placeholder" aria-hidden="true">
              {initial}
            </div>
          )}
        </div>
        <div className="title-row">
          <h1 className="title">{page.title}</h1>
          {page.verified ? (
            <span dangerouslySetInnerHTML={{ __html: verifiedBadgeHtml() }} />
          ) : null}
        </div>
        {page.bio ? <p className="bio">{page.bio}</p> : null}
        <div className="blocks" dangerouslySetInnerHTML={{ __html: blocksHtml }} />
        {page.show_powered_by ? <p className="powered-by">Powered by Link Pages</p> : null}
      </main>
      {hasCountdown ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              document.querySelectorAll('[data-countdown]').forEach(function(el){
                var target=el.getAttribute('data-countdown'); if(!target) return;
                var end=new Date(target).getTime(); var out=el.querySelector('.countdown-time');
                function tick(){ var diff=end-Date.now();
                  if(diff<=0){ out.textContent='Live now!'; return; }
                  var d=Math.floor(diff/86400000),h=Math.floor((diff%86400000)/3600000),
                      m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
                  out.textContent=(d?d+'d ':'')+h+'h '+m+'m '+s+'s'; setTimeout(tick,1000);
                } tick();
              });
            })();`,
          }}
        />
      ) : null}
    </div>
  );
}
