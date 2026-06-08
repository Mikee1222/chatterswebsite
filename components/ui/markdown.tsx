"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const proseBase =
  "text-sm leading-relaxed text-white/80 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0";

const proseElements = [
  "space-y-3",
  "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:tracking-tight",
  "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white/95",
  "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white/90",
  "[&_p]:text-white/75",
  "[&_a]:text-pink-400 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-pink-300",
  "[&_strong]:font-semibold [&_strong]:text-white/90",
  "[&_em]:italic [&_em]:text-white/70",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1",
  "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1",
  "[&_li]:text-white/75",
  "[&_blockquote]:rounded-r-xl [&_blockquote]:border-l-2 [&_blockquote]:border-pink-500/40 [&_blockquote]:bg-white/[0.03] [&_blockquote]:pl-4 [&_blockquote]:py-1 [&_blockquote]:italic [&_blockquote]:text-white/60",
  "[&_code]:rounded-md [&_code]:border [&_code]:border-white/10 [&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-pink-200/90",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-black/45 [&_pre]:p-4 [&_pre]:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "[&_pre_code]:border-0 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-white/10 [&_table]:border-collapse [&_table]:text-left [&_table]:text-xs",
  "[&_th]:border [&_th]:border-white/10 [&_th]:bg-white/[0.06] [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-white/80",
  "[&_td]:border [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-2 [&_td]:text-white/65",
  "[&_hr]:border-white/10",
].join(" ");

export function Markdown({
  children,
  className,
  emptyFallback = "Nothing to preview yet.",
  framed = false,
}: {
  children: string;
  className?: string;
  emptyFallback?: string;
  /** Glass frame for preview panels */
  framed?: boolean;
}) {
  const content = (children ?? "").trim();
  if (!content) {
    return <p className={cn("text-sm italic text-white/35", className)}>{emptyFallback}</p>;
  }

  const inner = (
    <div className={cn(proseBase, proseElements, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );

  if (!framed) return inner;

  return (
    <div className="sop-glass-card rounded-xl border border-white/10 bg-black/25 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      {inner}
    </div>
  );
}
