"use client";

import * as React from "react";
import type { LinkPageBlockRecord, LinkPageWithBlocks } from "@/types";
import { linkPageThemeCss, visibleBlocks } from "@/lib/link-page-preview-styles";

function CountdownBlock({ block }: { block: LinkPageBlockRecord }) {
  const [display, setDisplay] = React.useState("—");
  React.useEffect(() => {
    const target = block.countdown_target;
    if (!target) return;
    const end = new Date(target).getTime();
    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      const diff = end - Date.now();
      if (diff <= 0) {
        setDisplay("Live now!");
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(`${d ? `${d}d ` : ""}${h}h ${m}m ${s}s`);
      timer = setTimeout(tick, 1000);
    }
    tick();
    return () => clearTimeout(timer);
  }, [block.countdown_target]);

  return (
    <div className="countdown">
      <div className="countdown-label">{block.label || "Countdown"}</div>
      <div className="countdown-time">{display}</div>
    </div>
  );
}

function PreviewBlock({ block }: { block: LinkPageBlockRecord }) {
  const styleClass = block.style !== "default" ? ` style-${block.style}` : "";

  switch (block.block_type) {
    case "link":
      return (
        <div className={`block-link${styleClass}`}>
          <div className="link-label">{block.label || block.url || "Link"}</div>
          {block.sublabel ? <div className="link-sublabel">{block.sublabel}</div> : null}
        </div>
      );
    case "heading":
      return <div className="block-heading">{block.heading_text || block.label || ""}</div>;
    case "bio_text":
      return <div className="block-bio">{block.label || block.heading_text || ""}</div>;
    case "photo_grid":
      if (!block.photo_urls.length) return null;
      return (
        <div className="photo-grid">
          {block.photo_urls.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt="" />
          ))}
        </div>
      );
    case "countdown":
      return <CountdownBlock block={block} />;
    case "social_bar": {
      const urls = block.photo_urls.length ? block.photo_urls : block.url ? [block.url] : [];
      if (!urls.length) return null;
      return (
        <div className="social-bar">
          {urls.map((_, i) => (
            <span key={i}>{block.icon || "→"}</span>
          ))}
        </div>
      );
    }
    case "spacer": {
      const h = `${Math.max(0.5, block.sort_order * 0.5 + 0.5)}rem`;
      return <div className="spacer" style={{ ["--spacer-h" as string]: h }} />;
    }
    default:
      return null;
  }
}

type Props = {
  page: LinkPageWithBlocks;
  device: "mobile" | "desktop";
};

export function LinkPageLivePreview({ page, device }: Props) {
  const blocks = visibleBlocks(page);
  const css = linkPageThemeCss(page);

  return (
    <div
      className={device === "mobile" ? "mx-auto w-[375px]" : "w-full"}
      style={device === "mobile" ? { maxHeight: "100%", overflow: "auto" } : undefined}
    >
      <div className="link-page-root overflow-hidden rounded-2xl border border-white/[0.08]">
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <main className="page-wrap">
          {page.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar" src={page.profile_photo_url} alt={page.title} />
          ) : null}
          <h1 className="title">{page.title || "Untitled"}</h1>
          {page.bio ? <p className="bio">{page.bio}</p> : null}
          <div className="blocks">
            {blocks.map((b) => (
              <PreviewBlock key={b.id} block={b} />
            ))}
          </div>
          {page.show_powered_by ? <p className="powered-by">Powered by Link Pages</p> : null}
        </main>
      </div>
    </div>
  );
}
