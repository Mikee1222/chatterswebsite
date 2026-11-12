/**
 * Idea codes and file names — how every piece of content of a recording session is named,
 * so the iCloud manager can sort by file name alone.
 *
 * One idea (a bunch slot) = 3 pieces: V1 the original, V2 and V3 the variations.
 *   code   P03 = slot 3 of a Proven bunch, E02 = slot 2 of an Experimental bunch
 *   file   P03_V1_GRID, P03_V2_TRIAL, P03_V3_TRIAL   (raw clips add _take1, _take2)
 *   folder V1 of a proven idea        → Main Grid › Proven
 *          V1 of an experimental idea → Main Grid › Experimental
 *          every V2 / V3              → Trial Grid
 */

export type IdeaKind = "proven" | "experimental";
export type IdeaPlacement = "grid" | "trial";

export const SORT_FOLDER = {
  gridProven: "Main Grid › Proven",
  gridExperimental: "Main Grid › Experimental",
  trial: "Trial Grid",
} as const;

export type IdeaPiece = {
  take: 1 | 2 | 3;
  /** File name without extension and without the _takeN suffix of raw clips. */
  file: string;
  placement: IdeaPlacement;
  folder: string;
};

export function ideaCode(kind: IdeaKind | string | null | undefined, sequence: number): string {
  const letter = kind === "experimental" ? "E" : "P";
  const n = Math.max(1, Math.floor(Number(sequence) || 1));
  return `${letter}${String(n).padStart(2, "0")}`;
}

export function ideaPieces(kind: IdeaKind | string | null | undefined, sequence: number): IdeaPiece[] {
  const code = ideaCode(kind, sequence);
  return [
    {
      take: 1,
      file: `${code}_V1_GRID`,
      placement: "grid",
      folder: kind === "experimental" ? SORT_FOLDER.gridExperimental : SORT_FOLDER.gridProven,
    },
    { take: 2, file: `${code}_V2_TRIAL`, placement: "trial", folder: SORT_FOLDER.trial },
    { take: 3, file: `${code}_V3_TRIAL`, placement: "trial", folder: SORT_FOLDER.trial },
  ];
}

export type SortingIdea = {
  code: string;
  kind: IdeaKind;
  sequence: number;
  description: string;
  pieces: IdeaPiece[];
};

/** Totals for a list of ideas: how many files go to each folder. */
export function sortingTotals(ideas: SortingIdea[]): {
  gridProven: number;
  gridExperimental: number;
  trial: number;
  total: number;
} {
  let gridProven = 0;
  let gridExperimental = 0;
  let trial = 0;
  for (const idea of ideas) {
    for (const p of idea.pieces) {
      if (p.placement === "trial") trial += 1;
      else if (idea.kind === "experimental") gridExperimental += 1;
      else gridProven += 1;
    }
  }
  return { gridProven, gridExperimental, trial, total: gridProven + gridExperimental + trial };
}
