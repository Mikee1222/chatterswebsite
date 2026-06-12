import type { LinkPageBlockRecord, LinkPageWithBlocks } from "@/types";

/** CSS matching app/l/[slug]/page.tsx themeStyles */
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
      min-height: 100%;
      background: ${page.background_type === "color" ? bg : page.background_type === "gradient" ? bg : "#0a0a0a"};
      ${page.background_type === "image" ? `background-image: url(${page.background_value}); background-size: cover; background-position: center;` : ""}
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
    }
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
    .social-bar span {
      display: inline-flex; align-items: center; justify-content: center;
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--card); border: 1px solid var(--border);
      color: var(--text); font-size: 1.1rem;
    }
    .spacer { height: var(--spacer-h, 1rem); }
    .powered-by { margin-top: 2rem; font-size: 0.7rem; color: var(--muted); text-align: center; opacity: 0.6; }
  `;
}

export function visibleBlocks(page: LinkPageWithBlocks): LinkPageBlockRecord[] {
  return [...page.blocks]
    .filter((b) => b.is_visible)
    .sort((a, b) => a.sort_order - b.sort_order);
}
