"use client";

import * as React from "react";
import { PostingBriefView } from "@/components/posting-brief-view";
import type { PostingBrief } from "@/services/posting-briefs";

/** Detail page wrapper: keeps the brief in state so "Posted" updates render in place. */
export function PostingBriefDetail({
  brief: initial,
  modelName,
  editingBriefId,
}: {
  brief: PostingBrief;
  modelName?: string;
  editingBriefId?: string | null;
}) {
  const [brief, setBrief] = React.useState(initial);
  React.useEffect(() => setBrief(initial), [initial]);
  return (
    <PostingBriefView
      brief={brief}
      modelName={modelName}
      editingBriefId={editingBriefId}
      onBriefChange={setBrief}
    />
  );
}
