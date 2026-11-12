"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SORT_FOLDER, sortingTotals, type SortingIdea } from "@/lib/idea-codes";

/**
 * Where every file of a bunch goes — the iCloud manager's sorting list.
 * One row per idea: its 3 files (V1 original, V2 / V3 variations) and their folders.
 * With `onAllChecked` each row gets a tick box; the callback reports when every idea is ticked.
 */
export function IcloudSortingGuide({
  ideas,
  suffixHint,
  onAllChecked,
}: {
  ideas: SortingIdea[];
  /** Shown next to file names, e.g. "raw clips end in _take1, _take2". */
  suffixHint?: string;
  onAllChecked?: (allChecked: boolean) => void;
}) {
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const totals = React.useMemo(() => sortingTotals(ideas), [ideas]);
  const done = ideas.filter((i) => checked[i.code]).length;

  React.useEffect(() => {
    onAllChecked?.(ideas.length > 0 && done === ideas.length);
  }, [done, ideas.length, onAllChecked]);

  if (!ideas.length) {
    return (
      <p className="text-xs text-[#B8B4B8]/55">
        This bunch has no slots yet, so there is no file list for it.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full border border-emerald-400/35 bg-emerald-400/12 px-2 py-0.5 text-emerald-200">
          {SORT_FOLDER.gridProven}: {totals.gridProven}
        </span>
        <span className="rounded-full border border-amber-400/35 bg-amber-400/12 px-2 py-0.5 text-amber-200">
          {SORT_FOLDER.gridExperimental}: {totals.gridExperimental}
        </span>
        <span className="rounded-full border border-violet-400/40 bg-violet-400/15 px-2 py-0.5 text-violet-200">
          {SORT_FOLDER.trial}: {totals.trial}
        </span>
        <span className="text-[#B8B4B8]/60">
          {totals.total} videos in {ideas.length} ideas
          {onAllChecked ? ` · ${done}/${ideas.length} ideas placed` : ""}
        </span>
      </div>
      {suffixHint ? <p className="text-[11px] text-[#B8B4B8]/55">{suffixHint}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wide text-[#B8B4B8]/60">
            <tr>
              {onAllChecked ? <th className="w-10 px-2 py-2">In place</th> : null}
              <th className="px-2 py-2">Idea</th>
              <th className="px-2 py-2">File</th>
              <th className="px-2 py-2">Folder</th>
            </tr>
          </thead>
          <tbody>
            {ideas.map((idea) =>
              idea.pieces.map((piece, i) => (
                <tr
                  key={piece.file}
                  className={cn(i === 0 ? "border-t border-white/[0.07]" : "", checked[idea.code] && "opacity-55")}
                >
                  {onAllChecked && i === 0 ? (
                    <td rowSpan={idea.pieces.length} className="px-2 py-1.5 align-top">
                      <input
                        id={`sorted-${idea.code}`}
                        type="checkbox"
                        aria-label={`All files of ${idea.code} are in their folders`}
                        checked={Boolean(checked[idea.code])}
                        onChange={(e) => setChecked((p) => ({ ...p, [idea.code]: e.target.checked }))}
                        className="mt-0.5 h-4 w-4 accent-[#E91E8C]"
                      />
                    </td>
                  ) : null}
                  {i === 0 ? (
                    <td rowSpan={idea.pieces.length} className="px-2 py-1.5 align-top">
                      <span className="font-mono font-semibold text-white">{idea.code}</span>
                      <span className="ml-1.5 text-[#B8B4B8]/60">
                        {idea.kind === "experimental" ? "Experimental" : "Proven"}
                      </span>
                      {idea.description ? (
                        <p className="mt-0.5 max-w-[220px] truncate text-[#B8B4B8]/50">{idea.description}</p>
                      ) : null}
                    </td>
                  ) : null}
                  <td className="px-2 py-1.5 font-mono text-white/90">{piece.file}</td>
                  <td
                    className={cn(
                      "px-2 py-1.5 font-medium",
                      piece.placement === "trial"
                        ? "text-violet-200"
                        : idea.kind === "experimental"
                          ? "text-amber-200"
                          : "text-emerald-200",
                    )}
                  >
                    {piece.folder}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Read-only version for the edited videos (Videos To Upload), one block per bunch. */
export function IcloudEditedSortingPanel({
  bunches,
}: {
  bunches: { bunch_id: string; label: string; ideas: SortingIdea[] }[];
}) {
  const withIdeas = bunches.filter((b) => b.ideas.length);
  if (!withIdeas.length) return null;
  return (
    <section
      className="mb-6 space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 md:p-5"
      aria-label="Edited videos: where each one goes"
    >
      <div>
        <h2 className="text-base font-semibold text-white">Edited videos: where each one goes</h2>
        <p className="mt-0.5 text-xs text-[#B8B4B8]/60">
          In Videos To Upload, put every finished video in the folder next to its name. The VAs post
          from these folders.
        </p>
      </div>
      {withIdeas.map((b) => (
        <details key={b.bunch_id} className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-white">{b.label}</summary>
          <div className="mt-2">
            <IcloudSortingGuide ideas={b.ideas} />
          </div>
        </details>
      ))}
    </section>
  );
}
