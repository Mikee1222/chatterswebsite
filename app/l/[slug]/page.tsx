import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getLinkPageBySlug } from "@/services/link-pages";
import { trackPageView, extractClientIp } from "@/services/link-page-analytics";
import type { LinkPageBlockRecord, LinkPageWithBlocks } from "@/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function themeStyles(page: LinkPageWithBlocks): string {
  const primary = page.primary_color || "#ec4899";
  const accent = page.accent_color || "#a855f7";
  const fontFamily =
    page.font === "elegant"
      ? 'Georgia, "Times New Roman", serif'
      : page.font === "bold"
        ? '"Arial Black", Impact, sans-serif'
        : page.font === "minimal"
          ? 'system-ui, -apple-system, sans-serif'
          : '"Segoe UI", system-ui, sans-serif';

  let bg = page.background_value || "#0a0a0a";
  if (page.background_type === "gradient") {
    bg = page.background_value || `linear-gradient(135deg, ${primary}, ${accent})`;
  }

  const themes: Record<string, { text: string; muted: string; card: string; border: string }> = {
    dark: { text: "#fafafa", muted: "rgba(250,250,250,0.65)", card: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.12)" },
    light: { text: "#111", muted: "rgba(17,17,17,0.6)", card: "rgba(255,255,255,0.85)", border: "rgba(0,0,0,0.08)" },
    minimal: { text: "#e5e5e5", muted: "rgba(229,229,229,0.55)", card: "transparent", border: "rgba(255,255,255,0.15)" },
    neon: { text: "#fff", muted: "rgba(255,255,255,0.7)", card: "rgba(0,0,0,0.45)", border: `${primary}55` },
    gold: { text: "#fef3c7", muted: "rgba(254,243,199,0.65)", card: "rgba(0,0,0,0.35)", border: "rgba(251,191,36,0.35)" },
  };
  const t = themes[page.theme] ?? themes.dark;

  return `
    .link-page-root {
      --primary: ${primary};
      --accent: ${accent};
      --text: ${t.text};
      --muted: ${t.muted};
      --card: ${t.card};
      --border: ${t.border};
      font-family: ${fontFamily};
      color: var(--text);
      min-height: 100dvh;
      background: ${page.background_type === "color" ? bg : page.background_type === "gradient" ? bg : "#0a0a0a"};
      ${page.background_type === "image" ? `background-image: url(${page.background_value}); background-size: cover; background-position: center; background-attachment: fixed;` : ""}
      -webkit-font-smoothing: antialiased;
    }
    .link-page-root * { box-sizing: border-box; }
    .page-wrap {
      max-width: 480px;
      margin: 0 auto;
      padding: 2rem 1.25rem 3rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }
    .avatar {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid var(--primary);
      box-shadow: 0 0 24px ${primary}44;
    }
    .title { font-size: 1.5rem; font-weight: 700; text-align: center; margin-top: 0.5rem; }
    .bio { font-size: 0.95rem; color: var(--muted); text-align: center; line-height: 1.5; white-space: pre-wrap; }
    .blocks { width: 100%; display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem; }
    .block-link {
      display: block;
      width: 100%;
      padding: 0.95rem 1.1rem;
      text-decoration: none;
      color: var(--text);
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      text-align: center;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .block-link:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
    .block-link.style-prominent { background: linear-gradient(135deg, var(--primary), var(--accent)); border: none; font-weight: 600; }
    .block-link.style-pill { border-radius: 999px; }
    .block-link.style-subtle { background: transparent; border-style: dashed; }
    .block-link.style-card { border-radius: 16px; padding: 1.25rem; }
    .link-label { font-size: 1rem; font-weight: 600; }
    .link-sublabel { font-size: 0.8rem; color: var(--muted); margin-top: 0.2rem; }
    .block-heading { font-size: 1.1rem; font-weight: 700; text-align: center; padding: 0.5rem 0; color: var(--primary); }
    .block-bio { font-size: 0.9rem; color: var(--muted); text-align: center; line-height: 1.6; white-space: pre-wrap; padding: 0.5rem; }
    .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; width: 100%; }
    .photo-grid img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; }
    .countdown { text-align: center; padding: 1rem; background: var(--card); border: 1px solid var(--border); border-radius: 12px; }
    .countdown-label { font-size: 0.85rem; color: var(--muted); margin-bottom: 0.5rem; }
    .countdown-time { font-size: 1.75rem; font-weight: 700; color: var(--primary); font-variant-numeric: tabular-nums; }
    .social-bar { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; width: 100%; }
    .social-bar a {
      display: inline-flex; align-items: center; justify-content: center;
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--card); border: 1px solid var(--border);
      color: var(--text); text-decoration: none; font-size: 1.1rem;
    }
    .spacer { height: var(--spacer-h, 1rem); }
    .powered-by { margin-top: 2rem; font-size: 0.7rem; color: var(--muted); text-align: center; opacity: 0.6; }
  `;
}

function clickUrl(pageId: string, blockId: string, url: string): string {
  const params = new URLSearchParams({ page: pageId, block: blockId, url });
  return `/api/l/click?${params.toString()}`;
}

function renderBlock(page: LinkPageWithBlocks, block: LinkPageBlockRecord): string {
  const styleClass = block.style !== "default" ? ` style-${block.style}` : "";

  switch (block.block_type) {
    case "link": {
      const href = block.url ? clickUrl(page.page_id, block.block_id, block.url) : "#";
      return `<a class="block-link${styleClass}" href="${escapeHtml(href)}" rel="noopener noreferrer">
        <div class="link-label">${escapeHtml(block.label || block.url || "Link")}</div>
        ${block.sublabel ? `<div class="link-sublabel">${escapeHtml(block.sublabel)}</div>` : ""}
      </a>`;
    }
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
          return `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(block.icon || "→")}</a>`;
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getLinkPageBySlug(slug);
  if (!page || page.status !== "published") return { title: "Not found" };
  const desc = page.meta_description || page.bio || page.title;
  return {
    title: page.title,
    description: desc,
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

export default async function LinkPagePublic({ params }: Props) {
  const { slug } = await params;
  const page = await getLinkPageBySlug(slug);

  if (!page || page.status !== "published") {
    notFound();
  }

  const hdrs = await headers();
  trackPageView({
    pageId: page.page_id,
    ip: extractClientIp(hdrs),
    userAgent: hdrs.get("user-agent") ?? "",
    referrer: hdrs.get("referer") ?? "",
    sessionId: randomSessionId(),
  });

  const sortedBlocks = [...page.blocks].sort((a, b) => a.sort_order - b.sort_order);
  const blocksHtml = sortedBlocks.map((b) => renderBlock(page, b)).join("\n");
  const hasCountdown = sortedBlocks.some((b) => b.block_type === "countdown");

  return (
    <div className="link-page-root">
      <style dangerouslySetInnerHTML={{ __html: themeStyles(page) }} />
      <main className="page-wrap">
        {page.profile_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar" src={page.profile_photo_url} alt={page.title} />
        ) : null}
        <h1 className="title">{page.title}</h1>
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
