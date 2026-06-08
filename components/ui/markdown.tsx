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
  "[&_blockquote]:border-l-2 [&_blockquote]:border-pink-500/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-white/60",
  "[&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-pink-200/90",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-black/40 [&_pre]:p-4",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-xs",
  "[&_th]:border [&_th]:border-white/10 [&_th]:bg-white/5 [&_th]:px-3 [&_th]:py-2 [&_th]:font-semibold [&_th]:text-white/80",
  "[&_td]:border [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-2 [&_td]:text-white/65",
  "[&_hr]:border-white/10",
].join(" ");

export function Markdown({
  children,
  className,
  emptyFallback = "Nothing to preview yet.",
}: {
  children: string;
  className?: string;
  emptyFallback?: string;
}) {
  const content = (children ?? "").trim();
  if (!content) {
    return <p className={cn("text-sm italic text-white/35", className)}>{emptyFallback}</p>;
  }

  return (
    <div className={cn(proseBase, proseElements, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
