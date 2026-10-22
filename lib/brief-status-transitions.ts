/**
 * Server-side status transition guards for Recording / Editing Briefs.
 * Hiding buttons in the UI is not enough — every write must call these.
 */

export type RecordingBriefStatus = "draft" | "published" | "uploaded" | "archived";

export type EditingBriefStatus =
  | "draft"
  | "published"
  | "delivered"
  | "approved"
  | "changes_needed"
  | "archived";

export type BriefActorCapability =
  | "manage"
  | "view_own"
  | "view_assigned"
  | "review"
  | "view_all";

const RECORDING_TRANSITIONS: Record<
  RecordingBriefStatus,
  Partial<Record<RecordingBriefStatus, BriefActorCapability[]>>
> = {
  draft: {
    published: ["manage"],
    archived: ["manage"],
  },
  published: {
    draft: ["manage"],
    uploaded: ["view_own", "manage"],
    archived: ["manage"],
  },
  uploaded: {
    archived: ["manage"],
    published: ["manage"],
  },
  archived: {
    draft: ["manage"],
    published: ["manage"],
  },
};

const EDITING_TRANSITIONS: Record<
  EditingBriefStatus,
  Partial<Record<EditingBriefStatus, BriefActorCapability[]>>
> = {
  draft: {
    published: ["manage"],
    archived: ["manage"],
  },
  published: {
    draft: ["manage"],
    delivered: ["view_assigned", "manage"],
    archived: ["manage"],
  },
  delivered: {
    approved: ["review", "manage"],
    changes_needed: ["review", "manage"],
    archived: ["manage"],
  },
  changes_needed: {
    delivered: ["view_assigned", "manage"],
    archived: ["manage"],
  },
  approved: {
    archived: ["manage"],
  },
  archived: {
    draft: ["manage"],
    published: ["manage"],
  },
};

export class BriefTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BriefTransitionError";
  }
}

export function assertRecordingTransition(params: {
  from: RecordingBriefStatus;
  to: RecordingBriefStatus;
  capabilities: BriefActorCapability[];
  /** For Uploaded: must own the model. */
  ownsModel?: boolean;
}): void {
  const { from, to, capabilities, ownsModel } = params;
  if (from === to) return;
  const allowedCaps = RECORDING_TRANSITIONS[from]?.[to];
  if (!allowedCaps) {
    throw new BriefTransitionError(`Cannot change recording brief from ${from} to ${to}`);
  }
  const ok = allowedCaps.some((c) => capabilities.includes(c));
  if (!ok) {
    throw new BriefTransitionError(`Not allowed to set recording brief to ${to}`);
  }
  if (to === "uploaded" && !capabilities.includes("manage") && !ownsModel) {
    throw new BriefTransitionError("Only the assigned creator can mark Uploaded");
  }
}

export function assertEditingTransition(params: {
  from: EditingBriefStatus;
  to: EditingBriefStatus;
  capabilities: BriefActorCapability[];
  /** For Delivered: must be the assigned editor. */
  isAssignedEditor?: boolean;
  /** Changes needed requires non-empty comment. */
  reviewerComment?: string;
}): void {
  const { from, to, capabilities, isAssignedEditor, reviewerComment } = params;
  if (from === to) return;
  const allowedCaps = EDITING_TRANSITIONS[from]?.[to];
  if (!allowedCaps) {
    throw new BriefTransitionError(`Cannot change editing brief from ${from} to ${to}`);
  }
  const ok = allowedCaps.some((c) => capabilities.includes(c));
  if (!ok) {
    throw new BriefTransitionError(`Not allowed to set editing brief to ${to}`);
  }
  if (
    to === "delivered" &&
    !capabilities.includes("manage") &&
    !isAssignedEditor
  ) {
    throw new BriefTransitionError("Only the assigned editor can mark Delivered");
  }
  if (to === "changes_needed") {
    const comment = (reviewerComment ?? "").trim();
    if (!comment) {
      throw new BriefTransitionError("Changes needed requires a reviewer comment");
    }
  }
  if (
    (to === "approved" || to === "changes_needed") &&
    !capabilities.includes("review") &&
    !capabilities.includes("manage")
  ) {
    throw new BriefTransitionError("Only reviewers can approve or request changes");
  }
}

/** Publish requires assigned editor. */
export function assertEditingPublishReady(assignedEditorId: string | null | undefined): void {
  if (!(assignedEditorId ?? "").trim()) {
    throw new BriefTransitionError("Assigned editor is required to publish");
  }
}
