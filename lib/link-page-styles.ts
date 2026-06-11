import type { LinkPageWithBlocks } from "@/types";

/** Shared theme CSS for public link-in-bio pages */
export function linkPageThemeCss(page: LinkPageWithBlocks): string {
  const primary = page.primary_color || "#ec4899";
  const accent = page.accent_color || "#a855f7";
  const fontFamily =
    page.font === "elegant"
      ? 'Georgia, "Times New Roman", serif'
      : page.font === "bold"
        ? '"Arial Black", Impact, sans-serif'
        : page.font === "minimal"
          ? "system-ui, -apple-system, sans-serif"
          : '"Segoe UI", system-ui, sans-serif';

  let bg = page.background_value || "#0a0a0a";
  if (page.background_type === "gradient") {
    bg = page.background_value || `linear-gradient(160deg, ${primary}22 0%, #0a0a0a 45%, ${accent}18 100%)`;
  }

  const themes: Record<
    string,
    { text: string; muted: string; card: string; border: string; glow: string; overlay: string }
  > = {
    dark: {
      text: "#fafafa",
      muted: "rgba(250,250,250,0.62)",
      card: "rgba(255,255,255,0.07)",
      border: "rgba(255,255,255,0.14)",
      glow: `${primary}33`,
      overlay: "rgba(0,0,0,0.35)",
    },
    light: {
      text: "#0f172a",
      muted: "rgba(15,23,42,0.58)",
      card: "rgba(255,255,255,0.92)",
      border: "rgba(15,23,42,0.1)",
      glow: `${primary}22`,
      overlay: "rgba(255,255,255,0.5)",
    },
    minimal: {
      text: "#f4f4f5",
      muted: "rgba(244,244,245,0.5)",
      card: "transparent",
      border: "rgba(255,255,255,0.18)",
      glow: "transparent",
      overlay: "transparent",
    },
    neon: {
      text: "#ffffff",
      muted: "rgba(255,255,255,0.72)",
      card: "rgba(0,0,0,0.5)",
      border: `${primary}66`,
      glow: `${primary}55`,
      overlay: "rgba(0,0,0,0.45)",
    },
    gold: {
      text: "#fef3c7",
      muted: "rgba(254,243,199,0.68)",
      card: "rgba(0,0,0,0.42)",
      border: "rgba(251,191,36,0.38)",
      glow: "rgba(251,191,36,0.25)",
      overlay: "rgba(0,0,0,0.5)",
    },
  };
  const t = themes[page.theme] ?? themes.dark;

  const bgRule =
    page.background_type === "image"
      ? `background-color: #0a0a0a; background-image: url(${page.background_value}); background-size: cover; background-position: center; background-attachment: fixed;`
      : page.background_type === "gradient"
        ? `background: ${bg};`
        : `background: ${bg};`;

  return `
    .link-page-root {
      --primary: ${primary};
      --accent: ${accent};
      --text: ${t.text};
      --muted: ${t.muted};
      --card: ${t.card};
      --border: ${t.border};
      --glow: ${t.glow};
      --overlay: ${t.overlay};
      font-family: ${fontFamily};
      color: var(--text);
      min-height: 100dvh;
      ${bgRule}
      -webkit-font-smoothing: antialiased;
      position: relative;
      overflow-x: hidden;
    }
    .link-page-root::before {
      content: "";
      position: fixed;
      inset: 0;
      background: var(--overlay);
      pointer-events: none;
      z-index: 0;
    }
    .link-page-root * { box-sizing: border-box; }
    .page-wrap {
      position: relative;
      z-index: 1;
      max-width: 28rem;
      width: 100%;
      margin: 0 auto;
      padding: max(2rem, env(safe-area-inset-top)) 1.25rem max(3rem, env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.875rem;
      min-height: 100dvh;
    }
    .preview-banner {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border-radius: 10px;
      background: rgba(251,191,36,0.15);
      border: 1px solid rgba(251,191,36,0.35);
      color: #fde68a;
      font-size: 0.75rem;
      font-weight: 600;
      text-align: center;
      letter-spacing: 0.02em;
    }
    .avatar-wrap {
      position: relative;
      margin-top: 0.5rem;
    }
    .avatar-ring {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      opacity: 0.85;
      filter: blur(0.5px);
    }
    .avatar {
      position: relative;
      width: 104px;
      height: 104px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid rgba(255,255,255,0.9);
      box-shadow: 0 12px 40px var(--glow);
      display: block;
    }
    .avatar-placeholder {
      position: relative;
      width: 104px;
      height: 104px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.25rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: #fff;
      border: 3px solid rgba(255,255,255,0.2);
      box-shadow: 0 12px 40px var(--glow);
    }
    .title {
      font-size: clamp(1.35rem, 5vw, 1.75rem);
      font-weight: 700;
      text-align: center;
      margin: 0.25rem 0 0;
      letter-spacing: -0.02em;
      line-height: 1.2;
    }
    .bio {
      font-size: 0.95rem;
      color: var(--muted);
      text-align: center;
      line-height: 1.55;
      white-space: pre-wrap;
      margin: 0;
      max-width: 22rem;
    }
    .blocks {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
      margin-top: 0.75rem;
    }
    .block-link {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.65rem;
      width: 100%;
      padding: 0.95rem 1.15rem;
      text-decoration: none;
      color: var(--text);
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      text-align: center;
      transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .block-link:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 28px rgba(0,0,0,0.28);
      border-color: var(--primary);
    }
    .block-link:active { transform: translateY(0); }
    .block-link.style-prominent {
      background: linear-gradient(135deg, var(--primary), var(--accent));
      border: none;
      font-weight: 600;
      color: #fff;
      box-shadow: 0 8px 24px var(--glow);
    }
    .block-link.style-prominent:hover { box-shadow: 0 12px 32px var(--glow); }
    .block-link.style-pill { border-radius: 999px; padding: 0.9rem 1.4rem; }
    .block-link.style-subtle {
      background: transparent;
      border-style: dashed;
      border-width: 1.5px;
    }
    .block-link.style-subtle:hover { background: var(--card); }
    .block-link.style-card {
      border-radius: 18px;
      padding: 1.2rem 1.25rem;
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
    }
    .link-icon {
      font-size: 1.25rem;
      line-height: 1;
      flex-shrink: 0;
    }
    .link-content { min-width: 0; flex: 1; }
    .block-link.style-card .link-content { width: 100%; }
    .link-label { font-size: 1rem; font-weight: 600; line-height: 1.3; }
    .link-sublabel { font-size: 0.78rem; color: var(--muted); margin-top: 0.15rem; line-height: 1.35; }
    .block-heading {
      font-size: 0.8rem;
      font-weight: 700;
      text-align: center;
      padding: 0.35rem 0;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    .block-bio {
      font-size: 0.9rem;
      color: var(--muted);
      text-align: center;
      line-height: 1.65;
      white-space: pre-wrap;
      padding: 0.25rem 0.5rem;
    }
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.45rem;
      width: 100%;
    }
    .photo-grid img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: 10px;
      border: 1px solid var(--border);
    }
    .countdown {
      text-align: center;
      padding: 1.1rem 1rem;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      backdrop-filter: blur(8px);
    }
    .countdown-label {
      font-size: 0.82rem;
      color: var(--muted);
      margin-bottom: 0.45rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .countdown-time {
      font-size: 1.65rem;
      font-weight: 700;
      color: var(--primary);
      font-variant-numeric: tabular-nums;
    }
    .social-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      justify-content: center;
      width: 100%;
    }
    .social-bar a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--card);
      border: 1px solid var(--border);
      color: var(--text);
      text-decoration: none;
      font-size: 1.2rem;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .social-bar a:hover {
      transform: scale(1.06);
      border-color: var(--primary);
    }
    .spacer { height: var(--spacer-h, 1rem); width: 100%; }
    .powered-by {
      margin-top: auto;
      padding-top: 1.5rem;
      font-size: 0.68rem;
      color: var(--muted);
      text-align: center;
      opacity: 0.55;
      letter-spacing: 0.04em;
    }
  `;
}
