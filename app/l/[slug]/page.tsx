import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLinkPageBySlugFresh, getLinkPageWithBlocksByPageIdFresh } from "@/services/link-pages";
import { getAbVariantForSession, trackAbEvent } from "@/services/link-ab-testing";
import { linkPageThemeCss, renderBrandedLinkHtml, verifiedBadgeHtml, GOOGLE_FONTS_STYLESHEET } from "@/lib/link-page-styles";
import type { LinkPageAbVariant, LinkPageBlockRecord, LinkPageWithBlocks } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const LINK_PAGE_CSP = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' https://connect.facebook.net https://analytics.tiktok.com",
  "img-src https: data: blob: https://www.facebook.com",
  "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
  "connect-src 'self' https://connect.facebook.net https://www.facebook.com https://analytics.tiktok.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const DEFAULT_COOKIE_NOTICE_TEXT =
  "We use cookies and similar technologies for analytics. By clicking Accept, you agree to this use.";

const COOKIE_CONSENT_STORAGE_KEY = "lp_cookie_consent";

function pixelTrackingScript(opts: {
  metaPixelId: string;
  tiktokPixelId: string;
  cookieNoticeEnabled: boolean;
}): string {
  const metaId = opts.metaPixelId.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const tiktokId = opts.tiktokPixelId.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const needsConsent = opts.cookieNoticeEnabled ? "true" : "false";
  const consentKey = COOKIE_CONSENT_STORAGE_KEY;

  return `(function(){
  var CONSENT_KEY='${consentKey}';
  var needsConsent=${needsConsent};
  var metaId='${metaId}';
  var tiktokId='${tiktokId}';
  function hasConsent(){try{return localStorage.getItem(CONSENT_KEY)==='1';}catch(e){return false;}}
  function loadMeta(id){
    if(!id||window.fbq)return;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init',id);fbq('track','PageView');
  }
  function loadTiktok(id){
    if(!id||window.ttq)return;
    !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load(id);ttq.page()}(window,document,'ttq');
  }
  function loadPixels(){if(metaId)loadMeta(metaId);if(tiktokId)loadTiktok(tiktokId);}
  window.lpAcceptCookies=function(){
    try{localStorage.setItem(CONSENT_KEY,'1');}catch(e){}
    var b=document.getElementById('lp-cookie-banner');if(b)b.style.display='none';
    loadPixels();
  };
  if(!needsConsent||hasConsent()){loadPixels();var b=document.getElementById('lp-cookie-banner');if(b)b.style.display='none';}
})();`;
}

function metaPixelNoscript(pixelId: string): string {
  const id = escapeHtml(pixelId.trim());
  if (!id) return "";
  return `<img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${id}&amp;ev=PageView&amp;noscript=1" />`;
}

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

function linkPagePublicUrl(page: Pick<LinkPageWithBlocks, "slug" | "custom_domain">): string {
  const domain = page.custom_domain?.trim().toLowerCase().replace(/^www\./, "");
  if (domain) return `https://${domain}`;
  return `https://www.gunzoteam.com/l/${encodeURIComponent(page.slug)}`;
}

function clickBaseUrl(page: Pick<LinkPageWithBlocks, "custom_domain">): string {
  const domain = page.custom_domain?.trim().toLowerCase().replace(/^www\./, "");
  return domain ? `https://${domain}` : "";
}

function clickUrl(
  pageSlug: string,
  blockId: string,
  url: string,
  baseUrl: string,
  variant?: LinkPageAbVariant,
  abEnabled?: boolean
): string {
  const params = new URLSearchParams({ page: pageSlug, block: blockId, url });
  if (abEnabled && variant) params.set("variant", variant);
  return `${baseUrl}/api/l/click?${params.toString()}`;
}

function fingerprintTrackingScript(pageSlug: string): string {
  const slug = pageSlug.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `(function(){
  if(window.location.search.includes('preview=true'))return;
  function getFingerprint(){
    var components=[
      navigator.userAgent,
      navigator.language,
      screen.width+'x'+screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency||'',
      navigator.deviceMemory||'',
      navigator.platform||''
    ];
    var str=components.join('|');
    var hash=0;
    for(var i=0;i<str.length;i++){
      var char=str.charCodeAt(i);
      hash=((hash<<5)-hash)+char;
      hash=hash&hash;
    }
    return 'fp_'+Math.abs(hash).toString(36);
  }
  function getVisitorId(){
    try{
      var stored=localStorage.getItem('lp_visitor_id');
      if(stored)return{id:stored,isNew:false};
      var fp=getFingerprint();
      localStorage.setItem('lp_visitor_id',fp);
      return{id:fp,isNew:true};
    }catch(e){
      return{id:getFingerprint(),isNew:true};
    }
  }
  function getSessionId(){
    var sessionKey='lp_session_${slug}';
    var now=Date.now();
    try{
      var lastActivity=localStorage.getItem(sessionKey+'_ts');
      if(lastActivity&&(now-parseInt(lastActivity,10))<30*60*1000){
        localStorage.setItem(sessionKey+'_ts',now.toString());
        return{id:localStorage.getItem(sessionKey)||'',isNew:false};
      }
      var sessionId='s_'+now+'_'+Math.random().toString(36).slice(2,8);
      localStorage.setItem(sessionKey,sessionId);
      localStorage.setItem(sessionKey+'_ts',now.toString());
      return{id:sessionId,isNew:true};
    }catch(e){
      return{id:'s_'+now+'_'+Math.random().toString(36).slice(2,8),isNew:true};
    }
  }
  var visitor=getVisitorId();
  var session=getSessionId();
  window._lp_visitor_id=visitor.id;
  window._lp_session_id=session.id;
  var params=new URLSearchParams(window.location.search);
  fetch('/api/l/track',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      page_id:'${slug}',
      visitor_id:visitor.id,
      session_id:session.id,
      is_new_visitor:visitor.isNew,
      is_new_session:session.isNew,
      event_type:'page_view',
      referrer:document.referrer||'',
      utm_source:params.get('utm_source')||'',
      utm_medium:params.get('utm_medium')||'',
      utm_campaign:params.get('utm_campaign')||''
    })
  }).catch(function(){});
})();`;
}

const LINK_CLICK_TRACKING_SCRIPT = `(function(){
  document.querySelectorAll('a[data-lp-click]').forEach(function(a){
    a.addEventListener('click',function(){
      var vid=window._lp_visitor_id||'';
      var sid=window._lp_session_id||'';
      if(!vid&&!sid)return;
      try{
        var u=new URL(a.getAttribute('href')||'',window.location.origin);
        if(vid)u.searchParams.set('visitor',vid);
        if(sid)u.searchParams.set('session',sid);
        a.href=u.pathname+u.search;
      }catch(e){}
    },true);
  });
})();`;

function renderLinkBlock(
  page: LinkPageWithBlocks,
  block: LinkPageBlockRecord,
  pageSlug: string,
  clickOrigin: string,
  variant: LinkPageAbVariant,
  abEnabled: boolean
): string {
  const href = block.url
    ? clickUrl(pageSlug, block.block_id, block.url, clickOrigin, variant, abEnabled)
    : "#";
  return renderBrandedLinkHtml(block, href, page.primary_color, escapeHtml);
}

function renderBlock(
  page: LinkPageWithBlocks,
  block: LinkPageBlockRecord,
  pageSlug: string,
  clickOrigin: string,
  variant: LinkPageAbVariant,
  abEnabled: boolean
): string {
  if (!block.is_visible) return "";

  switch (block.block_type) {
    case "link":
      return renderLinkBlock(page, block, pageSlug, clickOrigin, variant, abEnabled);
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
          const href = clickUrl(pageSlug, block.block_id, u, clickOrigin, variant, abEnabled);
          return `<a href="${escapeHtml(href)}" rel="noopener noreferrer" data-lp-click="1" title="${escapeHtml(block.label || "")}">${escapeHtml(block.icon || "→")}</a>`;
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

function isAirtableRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || /rate limit/i.test(msg);
}

function LinkPageRateLimited() {
  return (
    <div className="link-page-root">
      <head>
        <meta httpEquiv="refresh" content="3" />
      </head>
      <main className="page-wrap" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
        <h1 className="title" style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
          Just a moment…
        </h1>
        <p className="bio" style={{ opacity: 0.7 }}>
          This page is loading. It will refresh automatically.
        </p>
      </main>
    </div>
  );
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "true";

  let page: LinkPageWithBlocks | null;
  try {
    page = await getLinkPageBySlugFresh(slug);
  } catch (err) {
    console.error("[l/slug] error:", err);
    if (isAirtableRateLimitError(err)) {
      return { title: "Just a moment…", robots: { index: false, follow: false } };
    }
    return { title: "Not found", robots: { index: false, follow: false } };
  }

  if (!page || (!isPreview && page.status !== "published")) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }

  const desc = page.meta_description || page.bio || page.title;
  const pageUrl = linkPagePublicUrl(page);
  return {
    title: isPreview ? `${page.title} (Preview)` : page.title,
    description: desc,
    robots: { index: false, follow: false },
    alternates: { canonical: pageUrl },
    openGraph: {
      title: page.title,
      description: desc,
      type: "profile",
      url: pageUrl,
      siteName: page.title,
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
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Read-only in RSC — cookie writes happen via POST /api/l/session from the client. */
function readSessionId(controlPageId: string): string | null {
  const cookieStore = cookies();
  return cookieStore.get(`lp_sid_${controlPageId}`)?.value ?? null;
}

function sessionCookieBootstrapScript(pageId: string, sessionId: string): string {
  const pid = pageId.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const sid = sessionId.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `(function(){
  fetch('/api/l/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page_id:'${pid}',session_id:'${sid}'}),credentials:'same-origin'}).catch(function(){});
})();`;
}

export default async function LinkPagePublic({ params, searchParams }: Props) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const isPreview = preview === "true";

  let page: LinkPageWithBlocks | null;
  try {
    page = await getLinkPageBySlugFresh(slug);
  } catch (err) {
    console.error("[l/slug] error:", err);
    if (isAirtableRateLimitError(err)) {
      return <LinkPageRateLimited />;
    }
    notFound();
  }

  if (!page || (!isPreview && page.status !== "published")) {
    notFound();
  }

  const controlPage = page;
  const existingSessionId = readSessionId(controlPage.page_id);
  const sessionId = existingSessionId ?? randomSessionId();
  const needsSessionCookie = !isPreview && !existingSessionId;
  const abEnabled = !isPreview && controlPage.ab_test_enabled && !!controlPage.ab_variant_id;
  let variant: LinkPageAbVariant = "a";
  let activePage: LinkPageWithBlocks = controlPage;

  if (abEnabled) {
    variant = getAbVariantForSession(sessionId, controlPage.page_id);
    if (variant === "b") {
      const variantPage = await getLinkPageWithBlocksByPageIdFresh(controlPage.ab_variant_id);
      if (variantPage) activePage = variantPage;
    }
  }

  if (!isPreview && abEnabled) {
    trackAbEvent({
      pageId: controlPage.page_id,
      variant,
      eventType: "view",
      sessionId,
    });
  }

  const sortedBlocks = [...activePage.blocks].sort((a, b) => a.sort_order - b.sort_order);
  const clickOrigin = clickBaseUrl(controlPage);
  const blocksHtml = sortedBlocks
    .map((b) => renderBlock(activePage, b, controlPage.slug, clickOrigin, variant, abEnabled))
    .join("\n");
  const hasCountdown = sortedBlocks.some((b) => b.block_type === "countdown" && b.is_visible);
  const initial = (activePage.title || "?").charAt(0).toUpperCase();
  const metaPixelId = (controlPage.meta_pixel_id ?? "").trim();
  const tiktokPixelId = (controlPage.tiktok_pixel_id ?? "").trim();
  const hasPixels = !isPreview && !!(metaPixelId || tiktokPixelId);
  const showCookieNotice = !isPreview && !!controlPage.cookie_notice_enabled && hasPixels;
  const cookieNoticeText =
    (controlPage.cookie_notice_text ?? "").trim() || DEFAULT_COOKIE_NOTICE_TEXT;
  const bioText = activePage.bio?.trim() ?? "";

  return (
    <div className="link-page-root">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={GOOGLE_FONTS_STYLESHEET} rel="stylesheet" />
      </head>
      <style dangerouslySetInnerHTML={{ __html: linkPageThemeCss(activePage) }} />
      <main className="page-wrap">
        {isPreview && controlPage.status === "draft" ? (
          <div className="preview-banner">Draft preview — not visible to the public</div>
        ) : null}
        <div className="avatar-wrap">
          <div className="avatar-ring" aria-hidden="true" />
          {activePage.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar" src={activePage.profile_photo_url} alt={activePage.title} />
          ) : (
            <div className="avatar-placeholder" aria-hidden="true">
              {initial}
            </div>
          )}
        </div>
        <div className="title-row">
          <h1 className="title">{activePage.title}</h1>
          {activePage.verified ? (
            <span dangerouslySetInnerHTML={{ __html: verifiedBadgeHtml() }} />
          ) : null}
        </div>
        {bioText ? <p className="bio">{bioText}</p> : null}
        <div className="blocks" dangerouslySetInnerHTML={{ __html: blocksHtml }} />
        {activePage.show_powered_by ? <p className="powered-by">Powered by Link Pages</p> : null}
      </main>
      {showCookieNotice ? (
        <div
          id="lp-cookie-banner"
          className="cookie-banner"
          role="dialog"
          aria-label="Cookie notice"
        >
          <p className="cookie-banner-text">{cookieNoticeText}</p>
          <button type="button" className="cookie-banner-btn">
            Accept
          </button>
        </div>
      ) : null}
      {hasPixels ? (
        <>
          {metaPixelId ? (
            <noscript dangerouslySetInnerHTML={{ __html: metaPixelNoscript(metaPixelId) }} />
          ) : null}
          <script
            dangerouslySetInnerHTML={{
              __html: pixelTrackingScript({
                metaPixelId,
                tiktokPixelId,
                cookieNoticeEnabled: !!controlPage.cookie_notice_enabled,
              }),
            }}
          />
          {showCookieNotice ? (
            <script
              dangerouslySetInnerHTML={{
                __html: `document.querySelector('#lp-cookie-banner .cookie-banner-btn')?.addEventListener('click',function(){window.lpAcceptCookies&&window.lpAcceptCookies();});`,
              }}
            />
          ) : null}
        </>
      ) : null}
      {hasPixels ? (
        <style
          dangerouslySetInnerHTML={{
            __html: `.cookie-banner{position:fixed;bottom:0;left:0;right:0;z-index:100;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.75rem;padding:0.875rem 1rem;background:rgba(10,10,10,0.95);border-top:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(8px)}.cookie-banner-text{margin:0;flex:1;min-width:12rem;font-size:0.8125rem;line-height:1.4;color:rgba(255,255,255,0.75)}.cookie-banner-btn{flex-shrink:0;border:none;border-radius:9999px;padding:0.5rem 1.25rem;font-size:0.8125rem;font-weight:600;color:#fff;background:var(--primary,#ec4899);cursor:pointer}`,
          }}
        />
      ) : null}
      {!isPreview ? (
        <>
          {needsSessionCookie ? (
            <script
              dangerouslySetInnerHTML={{
                __html: sessionCookieBootstrapScript(controlPage.page_id, sessionId),
              }}
            />
          ) : null}
          <script dangerouslySetInnerHTML={{ __html: fingerprintTrackingScript(controlPage.slug) }} />
          <script dangerouslySetInnerHTML={{ __html: LINK_CLICK_TRACKING_SCRIPT }} />
        </>
      ) : null}
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
