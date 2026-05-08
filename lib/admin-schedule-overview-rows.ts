import { modelLiveStreamPlatformLabel } from "@/lib/airtable-options";
import type {
  CustomRequest,
  ModelLiveStreamRecord,
  ModelPersonalEvent,
  ModelRecord,
  ModelScheduleItem,
  VaContentAssignmentRecord,
} from "@/types";

export type OverviewRowKind = "schedule" | "custom_request" | "va_content" | "live_stream" | "personal_event";

export type OverviewNormStatus = "pending" | "scheduled" | "completed";

/** JSON-safe row for admin schedule overview client. */
export type AdminScheduleOverviewRow = {
  kind: OverviewRowKind;
  id: string;
  modelId: string;
  modelName: string;
  date: string;
  timeLabel: string | null;
  title: string;
  typeLabel: string;
  statusRaw: string;
  normStatus: OverviewNormStatus;
  scheduleItemType: string | null;
  csvDetails: string;
  detail: AdminScheduleOverviewDetail;
};

export type AdminScheduleOverviewDetail =
  | {
      kind: "schedule";
      title: string;
      itemType: string;
      startTime: string | null;
      endTime: string | null;
      details: string;
      instructions: string;
      linkedCustomRequestId: string | null;
    }
  | {
      kind: "custom_request";
      fanUsername: string;
      requestTitle: string;
      price: string;
      scheduledDate: string | null;
      scheduledStart: string | null;
      scheduledEnd: string | null;
      modelStatus: string;
      adminStatus: string;
      chatterName: string;
      requestDetails: string;
    }
  | {
      kind: "va_content";
      title: string;
      description: string;
      vaName: string;
      deadline: string | null;
      scheduledDate: string | null;
      fileUrl: string | null;
      fileName: string | null;
      status: string;
      vaNotes: string;
    }
  | {
      kind: "live_stream";
      platform: string;
      platformLabel: string;
      plannedStart: string | null;
      plannedEnd: string | null;
      actualStart: string | null;
      actualEnd: string | null;
      durationMinutes: number | null;
      status: string;
      details: string;
    }
  | {
      kind: "personal_event";
      eventType: string;
      eventLabel: string;
      eventTime: string | null;
      notes: string;
    };

function normCustom(req: CustomRequest): OverviewNormStatus {
  const ms = req.model_status;
  if (ms === "completed") return "completed";
  if (ms === "waiting_schedule") return "pending";
  if (ms === "scheduled" || ms === "in_progress") return "scheduled";
  return "pending";
}

function normLive(status: string): OverviewNormStatus {
  const s = status.trim().toLowerCase();
  if (s.includes("complete") || s === "ended" || s.includes("cancel")) return "completed";
  if (s === "in_progress" || s.includes("live")) return "scheduled";
  if (s === "scheduled" || s === "planned" || s === "") return "scheduled";
  return "pending";
}

function normVa(status: string): OverviewNormStatus {
  const s = status.trim().toLowerCase();
  if (s.includes("complete") || s.includes("done") || s.includes("delivered")) return "completed";
  if (s.includes("pending") || s.includes("open") || s === "todo" || s === "") return "pending";
  return "scheduled";
}

function normSchedule(status: string): OverviewNormStatus {
  const s = status.trim().toLowerCase();
  if (s.includes("complete") || s.includes("done")) return "completed";
  if (s.includes("pending") || s === "") return "pending";
  return "scheduled";
}

function liveDurationMinutes(l: ModelLiveStreamRecord): number | null {
  if (l.actual_start && l.actual_end) {
    const a = new Date(l.actual_start).getTime();
    const b = new Date(l.actual_end).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) return Math.round((b - a) / 60000);
  }
  if (l.planned_start && l.planned_end) {
    const a = new Date(l.planned_start).getTime();
    const b = new Date(l.planned_end).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) return Math.round((b - a) / 60000);
  }
  return null;
}

function customDisplayDate(c: CustomRequest): string | null {
  const sched = c.model_scheduled_date?.trim().slice(0, 10);
  if (sched && /^\d{4}-\d{2}-\d{2}$/.test(sched)) return sched;
  const dl = c.deadline_requested?.trim().slice(0, 10);
  if (dl && /^\d{4}-\d{2}-\d{2}$/.test(dl)) return dl;
  return c.created_at?.trim().slice(0, 10) ?? null;
}

function timeFromCell(isoOrTime: string | null | undefined): string | null {
  if (!isoOrTime?.trim()) return null;
  const t = isoOrTime.trim();
  if (t.includes("T")) {
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
  }
  if (/^\d{2}:\d{2}/.test(t)) return t.slice(0, 5);
  return t.slice(0, 16);
}

export function buildAdminScheduleOverviewRows(input: {
  models: ModelRecord[];
  scheduleItems: ModelScheduleItem[];
  customs: CustomRequest[];
  vaAssignments: VaContentAssignmentRecord[];
  liveStreams: ModelLiveStreamRecord[];
  personalEvents: ModelPersonalEvent[];
  userNamesById: Record<string, string>;
}): AdminScheduleOverviewRow[] {
  const { models, scheduleItems, customs, vaAssignments, liveStreams, personalEvents, userNamesById } = input;
  const modelName = (id: string) => models.find((m) => m.id === id)?.model_name || models.find((m) => m.id === id)?.model_id || id;

  const linkedCustomIds = new Set(customs.map((c) => c.id));

  const rows: AdminScheduleOverviewRow[] = [];

  for (const s of scheduleItems) {
    if (s.item_type === "live_stream") continue;
    if (s.item_type === "custom" && s.linked_custom_request_id && linkedCustomIds.has(s.linked_custom_request_id)) {
      continue;
    }
    const st = normSchedule(s.status);
    const timeLabel = timeFromCell(s.start_time) ?? null;
    const detail: AdminScheduleOverviewDetail = {
      kind: "schedule",
      title: s.title,
      itemType: s.item_type,
      startTime: s.start_time,
      endTime: s.end_time,
      details: s.details,
      instructions: s.instructions,
      linkedCustomRequestId: s.linked_custom_request_id,
    };
    rows.push({
      kind: "schedule",
      id: `schedule:${s.id}`,
      modelId: s.model_id,
      modelName: modelName(s.model_id),
      date: s.date,
      timeLabel,
      title: s.title || s.item_type,
      typeLabel: s.item_type,
      statusRaw: s.status,
      normStatus: st,
      scheduleItemType: s.item_type,
      csvDetails: [s.title, s.item_type, s.details].filter(Boolean).join(" · "),
      detail,
    });
  }

  for (const c of customs) {
    const d = customDisplayDate(c);
    if (!d) continue;
    const chatterName =
      (c.requested_by_chatter_name || "").trim() ||
      userNamesById[c.requested_by_chatter_id] ||
      c.chatter_name ||
      "—";
    const detail: AdminScheduleOverviewDetail = {
      kind: "custom_request",
      fanUsername: c.fan_username,
      requestTitle: c.request_title,
      price: c.price,
      scheduledDate: c.model_scheduled_date,
      scheduledStart: c.model_scheduled_start,
      scheduledEnd: c.model_scheduled_end,
      modelStatus: c.model_status,
      adminStatus: c.admin_status,
      chatterName,
      requestDetails: c.request_details,
    };
    rows.push({
      kind: "custom_request",
      id: `custom:${c.id}`,
      modelId: c.assigned_model_id,
      modelName: modelName(c.assigned_model_id),
      date: d,
      timeLabel: timeFromCell(c.model_scheduled_start),
      title: c.request_title || "Custom",
      typeLabel: "Custom request",
      statusRaw: c.model_status,
      normStatus: normCustom(c),
      scheduleItemType: null,
      csvDetails: [c.fan_username, c.request_title, c.price].filter(Boolean).join(" · "),
      detail,
    });
  }

  for (const v of vaAssignments) {
    const d = (v.scheduled_date?.slice(0, 10) || v.deadline?.slice(0, 10) || "").trim();
    if (!d) continue;
    const vaName = (v.va_id && userNamesById[v.va_id]) || "—";
    const fileUrl = v.file_attachment?.[0]?.url ?? v.file_url ?? null;
    const fileName = v.file_attachment?.[0]?.filename ?? null;
    const detail: AdminScheduleOverviewDetail = {
      kind: "va_content",
      title: v.title,
      description: v.description,
      vaName,
      deadline: v.deadline,
      scheduledDate: v.scheduled_date,
      fileUrl,
      fileName,
      status: v.status,
      vaNotes: v.va_notes ?? "",
    };
    rows.push({
      kind: "va_content",
      id: `va:${v.id}`,
      modelId: v.model_id,
      modelName: modelName(v.model_id),
      date: d,
      timeLabel: null,
      title: v.title || "VA content",
      typeLabel: v.content_type || "VA content",
      statusRaw: v.status,
      normStatus: normVa(v.status),
      scheduleItemType: null,
      csvDetails: [v.title, v.description?.slice(0, 120)].filter(Boolean).join(" · "),
      detail,
    });
  }

  for (const l of liveStreams) {
    const platformLabel = l.platform ? modelLiveStreamPlatformLabel(l.platform) : "";
    const detail: AdminScheduleOverviewDetail = {
      kind: "live_stream",
      platform: l.platform,
      platformLabel,
      plannedStart: l.planned_start,
      plannedEnd: l.planned_end,
      actualStart: l.actual_start,
      actualEnd: l.actual_end,
      durationMinutes: liveDurationMinutes(l),
      status: l.status,
      details: l.details,
    };
    rows.push({
      kind: "live_stream",
      id: `live:${l.id}`,
      modelId: l.model_id,
      modelName: modelName(l.model_id),
      date: l.date,
      timeLabel: timeFromCell(l.planned_start ?? l.actual_start),
      title: platformLabel ? `${platformLabel} live` : "Live stream",
      typeLabel: "Live stream",
      statusRaw: l.status,
      normStatus: normLive(l.status),
      scheduleItemType: null,
      csvDetails: [platformLabel || l.platform, l.details].filter(Boolean).join(" · "),
      detail,
    });
  }

  for (const ev of personalEvents) {
    if (!ev.event_date) continue;
    const label = ev.event_type === "custom" ? ev.custom_label || "Custom event" : ev.event_type;
    const detail: AdminScheduleOverviewDetail = {
      kind: "personal_event",
      eventType: ev.event_type,
      eventLabel: label,
      eventTime: ev.event_time ?? null,
      notes: ev.notes,
    };
    rows.push({
      kind: "personal_event",
      id: `personal_event:${ev.id}`,
      modelId: ev.model_id,
      modelName: modelName(ev.model_id),
      date: ev.event_date,
      timeLabel: ev.event_time ?? null,
      title: label,
      typeLabel: "Personal event",
      statusRaw: "scheduled",
      normStatus: "scheduled",
      scheduleItemType: null,
      csvDetails: [ev.event_type, ev.custom_label, ev.notes].filter(Boolean).join(" · "),
      detail,
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || (a.timeLabel ?? "").localeCompare(b.timeLabel ?? "") || a.title.localeCompare(b.title));
  return rows;
}
