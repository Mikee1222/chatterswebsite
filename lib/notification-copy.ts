/**
 * Notification copy for in-app and push. Short, scannable, lock-screen friendly.
 * Times use {@link formatTimeAthens} / {@link formatDateTimeAthens} (Europe/Athens) so UTC servers show correct local wall clock.
 */

import { modelLiveStreamPlatformLabel } from "@/lib/airtable-options";
import { formatTimeAthens, formatDateTimeAthens } from "@/lib/format";

/** Format time for notification body (24h, Europe/Athens). */
export function formatTimeShort(isoOrDate: string | Date): string {
  const s = typeof isoOrDate === "string" ? isoOrDate : isoOrDate.toISOString();
  return formatTimeAthens(s);
}

/** Format date + time for body (Europe/Athens, 24h). */
export function formatDateTimeShort(isoOrDate: string | Date): string {
  const s = typeof isoOrDate === "string" ? isoOrDate : isoOrDate.toISOString();
  return formatDateTimeAthens(s);
}

/** Human-readable model list: "lydia, mia". */
function modelListDisplay(modelNames: string[]): string {
  const names = modelNames.filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return names.join(", ");
}

/** Shift started — self (chatter/VA). */
export function shiftStartedSelf(
  _startTime: string | Date,
  modelNames: string[] = []
): { title: string; body: string } {
  const list = modelListDisplay(modelNames);
  if (list) {
    return {
      title: "🟢 Shift started",
      body: `🟢 You're live with ${list}. Let's go!`,
    };
  }
  return {
    title: "🟢 Shift started",
    body: "🟢 You're live — no models assigned yet.",
  };
}

/** Shift started — admin. */
export function shiftStartedAdmin(
  chatterName: string,
  startTime: string | Date,
  modelNames: string[] = [],
  _shiftType?: string
): { title: string; body: string } {
  const time = formatTimeShort(startTime);
  const list = modelListDisplay(modelNames);
  const count = modelNames.filter(Boolean).length;
  if (count > 0 && list) {
    return {
      title: `🟢 ${chatterName} is on shift`,
      body: `🟢 Started at ${time} with ${count} model(s): ${list}.`,
    };
  }
  return {
    title: `🟢 ${chatterName} is on shift`,
    body: `🟢 Started at ${time} with no models yet.`,
  };
}

/** Shift completed — self. */
export function shiftCompletedSelf(
  _endTime: string | Date,
  _modelNames: string[] = [],
  workedMinutes?: number
): { title: string; body: string } {
  if (workedMinutes != null && workedMinutes > 0) {
    return {
      title: "✅ Shift complete",
      body: `✅ Great work! You were on for ${workedMinutes} min.`,
    };
  }
  return {
    title: "✅ Shift complete",
    body: "✅ Your shift has ended.",
  };
}

/** Shift completed — admin. */
export function shiftCompletedAdmin(
  chatterName: string,
  endTime: string | Date,
  _modelNames: string[] = [],
  workedMinutes?: number
): { title: string; body: string } {
  const time = formatTimeShort(endTime);
  if (workedMinutes != null && workedMinutes > 0) {
    return {
      title: `✅ ${chatterName} clocked out`,
      body: `✅ Shift ended at ${time}. Total: ${workedMinutes} min.`,
    };
  }
  return {
    title: `✅ ${chatterName} clocked out`,
    body: `✅ Shift ended at ${time}.`,
  };
}

/** Break started — self. */
export function breakStartedSelf(): { title: string; body: string } {
  return { title: "☕ Enjoy your break", body: "☕ You're on break. Back soon!" };
}

/** Break started — admin. */
export function breakStartedAdmin(chatterName: string, startedAt?: string | Date): { title: string; body: string } {
  const time =
    startedAt != null
      ? formatTimeShort(typeof startedAt === "string" ? startedAt : startedAt.toISOString())
      : null;
  return {
    title: `☕ ${chatterName} is on break`,
    body: time
      ? `☕ Break started at ${time} — they'll be back shortly.`
      : "☕ Break started — they'll be back shortly.",
  };
}

/** Break ended — self. */
export function breakEndedSelf(): { title: string; body: string } {
  return { title: "👋 Welcome back", body: "👋 Break over — you're back on shift!" };
}

/** Break ended — admin. */
export function breakEndedAdmin(
  chatterName: string,
  endTime: string | Date,
  durationMinutes?: number
): { title: string; body: string } {
  const duration = durationMinutes;
  const hasDuration = duration != null && duration > 0;
  const time = formatTimeShort(typeof endTime === "string" ? endTime : endTime.toISOString());
  return {
    title: `👋 ${chatterName} is back`,
    body: hasDuration
      ? `👋 Returned from break at ${time} after ${duration} min.`
      : `👋 Returned from break at ${time}.`,
  };
}

/** Task shift started — admin. */
export function taskShiftStartedAdmin(
  vaName: string,
  startTime: string | Date,
  modelNames: string[] = []
): { title: string; body: string } {
  const list = modelListDisplay(modelNames);
  const time = formatTimeShort(startTime);
  if (list) {
    return {
      title: `📋 ${vaName} started a task shift`,
      body: `📋 Working with ${list} from ${time}.`,
    };
  }
  return {
    title: `📋 ${vaName} started a task shift`,
    body: `📋 Task shift started at ${time}.`,
  };
}

/** Task shift ended — admin. */
export function taskShiftEndedAdmin(vaName: string, endTime: string | Date): { title: string; body: string } {
  const time = formatTimeShort(endTime);
  return {
    title: `✅ ${vaName} finished task shift`,
    body: `✅ Completed at ${time}.`,
  };
}

/** Whale registered — admin. */
export function whaleRegisteredAdmin(whaleName: string): { title: string; body: string } {
  return {
    title: "🐋 New whale registered",
    body: `🐋 ${whaleName} has been added to the CRM.`,
  };
}

/** Whale registered — chatter (self); same dual path as shift_started (notify + notifyAdmins). */
export function whaleRegisteredSelf(whaleUsername: string): { title: string; body: string } {
  return {
    title: "🐋 Whale added",
    body: `🐋 ${whaleUsername} is saved in My Whales.`,
  };
}

/** Chatter added whale — admin copy (model not assigned yet). */
export function whaleRegisteredAdminFromChatter(chatterName: string, whaleUsername: string): { title: string; body: string } {
  return {
    title: "🐋 New whale added",
    body: `🐋 ${chatterName} added a new whale: ${whaleUsername}. Tap to assign a model.`,
  };
}

/** Chatter added whale with model — admin copy. */
export function whaleRegisteredAdminFromChatterWithModel(
  chatterName: string,
  whaleUsername: string,
  modelName: string
): { title: string; body: string } {
  return {
    title: "🐋 New whale added",
    body: `🐋 ${chatterName} added ${whaleUsername} with model ${modelName}.`,
  };
}

/** Chatter submitted a whale; waiting for admin to assign a chatter (no auto-assign). */
export function whaleSubmittedAwaitingAssignmentChatter(whaleUsername: string): { title: string; body: string } {
  return {
    title: "🐋 Whale submitted",
    body: `🐋 We received @${whaleUsername}. An admin will assign a chatter — it will appear in My whales once assigned.`,
  };
}

/** Admin: new whale needs chatter assignment. */
export function whaleNeedsChatterAssignmentAdmin(chatterName: string, whaleUsername: string, modelName?: string): { title: string; body: string } {
  const detail = modelName?.trim()
    ? `${chatterName} added @${whaleUsername} (model: ${modelName}). Assign a chatter in Whales.`
    : `${chatterName} added @${whaleUsername}. Assign a chatter in Whales.`;
  return {
    title: "🐋 Whale needs assignment",
    body: `🐋 ${detail}`,
  };
}

/** Chatter was assigned to a whale by admin. */
export function whaleAssignedToYou(whaleUsername: string): { title: string; body: string } {
  return {
    title: "🐋 Whale assigned to you",
    body: `🐋 You've been assigned @${whaleUsername}. Open My whales to manage.`,
  };
}

/** Whale assigned — admin. */
export function whaleAssignedAdmin(whaleName: string, assigneeName: string): { title: string; body: string } {
  return {
    title: "🐋 Whale assigned",
    body: `🐋 ${whaleName} assigned to ${assigneeName}.`,
  };
}

/** New custom request — admin. */
export function customRequestCreatedAdmin(chatterName: string): { title: string; body: string } {
  return {
    title: "📝 New custom request",
    body: `📝 ${chatterName} submitted a new custom request.`,
  };
}

/** Custom status changed — chatter. */
export function customStatusChangedChatter(status: string): { title: string; body: string } {
  return {
    title: "📝 Custom updated",
    body: `📝 Your custom request status changed to ${status}.`,
  };
}

/** Model became free — admin. */
export function modelBecameFreeAdmin(modelName: string): { title: string; body: string } {
  return {
    title: "🟢 Model is now free",
    body: `🟢 ${modelName} is no longer on shift.`,
  };
}

/** Model taken — admin. */
export function modelTakenAdmin(modelName: string, chatterName: string): { title: string; body: string } {
  return {
    title: "🔒 Model taken",
    body: `🔒 ${modelName} is now on shift with ${chatterName}.`,
  };
}

/** Model went live — assigned chatter (pause chatting). */
export function modelLiveStartedChatter(modelName: string, platform: string): { title: string; body: string } {
  const platformLabel = modelLiveStreamPlatformLabel(platform);
  return {
    title: `🔴 ${modelName} is live on ${platformLabel}!`,
    body: `🔴 Pause chatting — ${modelName} just started a live stream on ${platformLabel}.`,
  };
}

/** Model went live — admin oversight. */
export function modelLiveStartedAdmin(modelName: string, platform: string): { title: string; body: string } {
  const platformLabel = modelLiveStreamPlatformLabel(platform);
  return {
    title: `🔴 ${modelName} went live on ${platformLabel}`,
    body: `🔴 ${modelName} started a live stream on ${platformLabel}.`,
  };
}

/** Model live ended — assigned chatter (resume chatting). */
export function modelLiveEndedChatter(modelName: string, platform: string): { title: string; body: string } {
  const platformLabel = modelLiveStreamPlatformLabel(platform);
  return {
    title: `⏹️ ${modelName} finished on ${platformLabel}`,
    body: `⏹️ ${modelName} finished on ${platformLabel}. Resume chatting.`,
  };
}

/** Model live ended — admin oversight. */
export function modelLiveEndedAdmin(modelName: string, platform: string): { title: string; body: string } {
  const platformLabel = modelLiveStreamPlatformLabel(platform);
  return {
    title: `⏹️ ${modelName} live ended on ${platformLabel}`,
    body: `⏹️ ${modelName} finished the live stream on ${platformLabel}.`,
  };
}

/** Availability submitted — self. */
export function availabilitySubmittedSelf(): { title: string; body: string } {
  return {
    title: "📅 Availability submitted",
    body: "📅 Your availability for next week has been recorded.",
  };
}

/** Availability reminder — self. */
export function availabilityReminderSelf(): { title: string; body: string } {
  return {
    title: "⏰ Reminder: Submit your availability",
    body: "⏰ Please submit your availability for next week before midnight.",
  };
}

/** Weekly program published — chatter. */
export function weeklyProgramPublishedChatter(): { title: string; body: string } {
  return {
    title: "📅 Weekly Program is Ready",
    body: "📅 Your schedule for next week has been published. Check your program.",
  };
}

/** VA weekly program published. */
export function weeklyProgramVaPublished(): { title: string; body: string } {
  return {
    title: "📅 VA Weekly Program is Ready",
    body: "📅 Your VA schedule for next week has been published.",
  };
}

/** Custom deadline approaching — chatter. */
export function customDeadlineApproachingChatter(customTitle: string): { title: string; body: string } {
  return {
    title: "⏰ Custom deadline approaching",
    body: `⏰ ${customTitle} is due in less than 48 hours.`,
  };
}

// ——— Back-compat & other operational copy (call sites unchanged) ———

/** @deprecated Prefer {@link customRequestCreatedAdmin}. */
export function customRequestAdmin(
  chatterName: string,
  _customType?: string,
  _modelName?: string,
  _fanUsername?: string
): { title: string; body: string } {
  return customRequestCreatedAdmin(chatterName);
}

/** Custom scheduled — e.g. when model/admin sets schedule. */
export function customScheduledAdmin(
  modelName: string,
  scheduledDate: string,
  scheduledTime?: string
): { title: string; body: string } {
  const at = scheduledTime ? ` at ${scheduledTime}` : "";
  const who = modelName?.trim() ? `${modelName.trim()} — ` : "";
  return {
    title: "📅 Custom scheduled",
    body: `📅 ${who}Scheduled for ${scheduledDate}${at}.`,
  };
}

/** Model scheduled your custom — chatter. */
export function customScheduledChatter(customTitle: string, scheduledDate: string, timeRange?: string): {
  title: string;
  body: string;
} {
  const when = timeRange ? `${scheduledDate} (${timeRange})` : scheduledDate;
  return {
    title: "📅 Custom scheduled",
    body: `📅 ${customTitle} is scheduled for ${when}.`,
  };
}

/** Model marked custom as uploaded — chatter / admin body line. */
export function customUploadedChatter(customTitle: string): { title: string; body: string } {
  return {
    title: "✅ Custom uploaded",
    body: `✅ ${customTitle} was marked as uploaded by your model.`,
  };
}

/** Form submitted — admin. */
export function formSubmittedAdmin(
  formName: string,
  actorName: string,
  submittedAt: string | Date
): { title: string; body: string } {
  const t = formatTimeShort(submittedAt);
  return {
    title: "📋 Form submitted",
    body: `📋 ${formName} from ${actorName} at ${t}.`,
  };
}

/** Whale session submitted — to chatter (self). */
export function whaleSessionSubmittedSelf(
  whaleUsername: string,
  amount: number | string,
  currency: string,
  modelName?: string
): { title: string; body: string } {
  const amt = typeof amount === "number" ? amount : amount;
  const model = modelName ? ` · ${modelName}` : "";
  return {
    title: "💰 Whale session logged",
    body: `💰 ${whaleUsername}${model} · ${amt} ${currency}.`,
  };
}

/** Whale session submitted — admin. */
export function whaleSessionSubmittedAdmin(
  chatterName: string,
  whaleUsername: string,
  amount: number | string,
  currency: string,
  modelName?: string
): { title: string; body: string } {
  const amt = typeof amount === "number" ? amount : amount;
  const model = modelName ? ` · ${modelName}` : "";
  return {
    title: "💰 New whale session",
    body: `💰 ${chatterName} submitted a session for ${whaleUsername}${model}. ${amt} ${currency}.`,
  };
}

function formatFineBonusAmount(amount: number | string): string {
  if (typeof amount === "number") return amount.toFixed(2);
  const n = Number.parseFloat(String(amount));
  return Number.isFinite(n) ? n.toFixed(2) : String(amount);
}

/** Fine issued — personal (chatter/VA). */
export function fineIssuedPersonal(
  amount: number | string,
  adminName: string,
  reason: string
): { title: string; body: string } {
  const amt = formatFineBonusAmount(amount);
  return {
    title: "Σου επιβλήθηκε πρόστιμο",
    body: `Πρόστιμο ${amt}€ από ${adminName}. Λόγος: ${reason}`,
  };
}

/** Fine issued — admin monitoring. */
export function fineIssuedAdmin(
  chatterName: string,
  adminName: string,
  amount: number | string,
  reason: string
): { title: string; body: string } {
  const amt = formatFineBonusAmount(amount);
  return {
    title: `Πρόστιμο — ${chatterName}`,
    body: `${adminName} επέβαλε πρόστιμο ${amt}€ στον ${chatterName}. Λόγος: ${reason}`,
  };
}

/** Bonus awarded — personal (chatter/VA). */
export function bonusAwardedPersonal(
  amount: number | string,
  adminName: string,
  reason: string
): { title: string; body: string } {
  const amt = formatFineBonusAmount(amount);
  return {
    title: "Πήρες μπόνους!",
    body: `Μπόνους ${amt}€ από ${adminName}. Λόγος: ${reason}`,
  };
}

/** Bonus awarded — admin monitoring. */
export function bonusAwardedAdmin(
  chatterName: string,
  adminName: string,
  amount: number | string,
  reason: string
): { title: string; body: string } {
  const amt = formatFineBonusAmount(amount);
  return {
    title: `Μπόνους — ${chatterName}`,
    body: `${adminName} έδωσε μπόνους ${amt}€ στον ${chatterName}. Λόγος: ${reason}`,
  };
}

/** Fine/bonus reviewed — personal (chatter/VA). */
export function fineBonusReviewedPersonal(
  decision: string,
  adminName?: string
): { title: string; body: string } {
  const admin = adminName?.trim() || "admin";
  const approved = decision === "Εγκρίθηκε";
  return {
    title: "Το πρόστιμο/μπόνους σου κρίθηκε",
    body: approved ? `Εγκρίθηκε από ${admin}.` : `Απορρίφθηκε από ${admin}.`,
  };
}

/** Fine/bonus reviewed — admin monitoring. */
export function fineBonusReviewedAdmin(
  chatterName: string,
  adminName: string,
  decision: string
): { title: string; body: string } {
  return {
    title: `Πρόστιμο/μπόνους κρίθηκε — ${chatterName}`,
    body: `${adminName} έκρινε πρόστιμο/μπόνους του ${chatterName}: ${decision}`,
  };
}

/** Mistake review decision — personal (chatter or VA). */
export function chatterMistakeReviewedSelf(
  decision: string,
  opts: {
    isVaReport?: boolean;
    chatterName?: string;
    reasonLabel?: string;
    points?: number;
    adminNotes?: string;
  } = {}
): { title: string; body: string } {
  const approved = decision === "Εγκρίθηκε";
  if (approved) {
    if (opts.isVaReport) {
      return {
        title: "✅ Λάθος εγκρίθηκε",
        body: `✅ Η αναφορά σου για ${opts.chatterName ?? "chatter"} εγκρίθηκε.`,
      };
    }
    return {
      title: "⚠️ Καταχωρήθηκε λάθος",
      body: `⚠️ Καταχωρήθηκε λάθος: ${opts.reasonLabel ?? "—"}. Πόντοι που αφαιρέθηκαν: ${opts.points ?? 0}.`,
    };
  }
  return {
    title: "❌ Αναφορά απορρίφθηκε",
    body: `❌ Η αναφορά σου${opts.chatterName ? ` για ${opts.chatterName}` : ""} απορρίφθηκε: ${opts.adminNotes?.trim() || "—"}`,
  };
}

/** Spin wheel result — self (chatter/VA). */
export function spinResultSelf(
  prizeName: string,
  prizeDetails?: string
): { title: string; body: string } {
  const details = prizeDetails?.trim();
  return {
    title: `Κέρδισες ${prizeName}! 🎉`,
    body: details
      ? `Το spin wheel σου έδωσε: ${prizeName}. ${details}`
      : `Το spin wheel σου έδωσε: ${prizeName}.`,
  };
}

/** Spin wheel result — admin. */
export function spinResultAdmin(
  chatterName: string,
  prizeName: string
): { title: string; body: string } {
  return {
    title: `Spin wheel — ${chatterName}`,
    body: `${chatterName} έκανε spin και κέρδισε: ${prizeName}`,
  };
}

/** Period overdue — admin monitoring. */
export function periodOverdueAdmin(modelName: string): { title: string; body: string } {
  const name = modelName.trim() || "Model";
  return {
    title: `Περίοδος — ${name}`,
    body: `${name} δεν έχει καταχωρήσει περίοδο`,
  };
}

/** Billing cycle announced — admin monitoring. */
export function billingCycleAnnouncedAdmin(
  clientName: string,
  amount: string
): { title: string; body: string } {
  const client = clientName.trim() || "Client";
  return {
    title: `Χρέωση — ${client}`,
    body: `Νέος κύκλος χρέωσης — ${client}: ${amount}`,
  };
}

/** Shadowban submitted — personal. */
export function shadowbanSubmittedPersonal(
  username: string,
  platform: string
): { title: string; body: string } {
  return {
    title: "Αναφορά shadowban υποβλήθηκε",
    body: `Η αναφορά σου για @${username} (${platform}) καταχωρήθηκε.`,
  };
}

/** Shadowban submitted — admin. */
export function shadowbanSubmittedAdmin(
  reporterName: string,
  username: string,
  platform: string,
  modelName: string
): { title: string; body: string } {
  return {
    title: `Shadowban — @${username}`,
    body: `${reporterName} ανέφερε shadowban στο ${platform} για ${modelName || "model"} (@${username})`,
  };
}

/** Shadowban resolved — personal. */
export function shadowbanResolvedPersonal(
  username: string,
  platform: string,
  approved: boolean
): { title: string; body: string } {
  return approved
    ? {
        title: "✅ Αναφορά shadowban εγκρίθηκε",
        body: `Η αναφορά σου για @${username} (${platform}) εγκρίθηκε.`,
      }
    : {
        title: "Αναφορά shadowban απορρίφθηκε",
        body: `Η αναφορά σου για @${username} (${platform}) απορρίφθηκε.`,
      };
}

/** Shadowban resolved — admin. */
export function shadowbanResolvedAdmin(
  reviewerName: string,
  username: string,
  approved: boolean
): { title: string; body: string } {
  return {
    title: `Shadowban ${approved ? "εγκρίθηκε" : "απορρίφθηκε"} — @${username}`,
    body: `${reviewerName} ${approved ? "επικύρωσε" : "απέρριψε"} αναφορά shadowban για @${username}.`,
  };
}

/** SOP quiz passed — personal. */
export function sopQuizPassedPersonal(sopTitle: string): { title: string; body: string } {
  const title = sopTitle.trim() || "SOP";
  return {
    title: "✅ Quiz ολοκληρώθηκε",
    body: `Πέρασες το quiz του ${title}`,
  };
}

/** SOP quiz passed — admin. */
export function sopQuizPassedAdmin(
  userName: string,
  sopTitle: string,
  score: number
): { title: string; body: string } {
  const title = sopTitle.trim() || "SOP";
  return {
    title: `Quiz — ${userName}`,
    body: `${userName} πέρασε το quiz του ${title} (${score}%)`,
  };
}

/** SOP quiz failed — personal. */
export function sopQuizFailedPersonal(sopTitle: string): { title: string; body: string } {
  const title = sopTitle.trim() || "SOP";
  return {
    title: "❌ Quiz απέτυχε",
    body: `Απέτυχες στο quiz του ${title}. Δοκίμασε ξανά.`,
  };
}

/** Schedule published — personal. */
export function schedulePublishedPersonal(): { title: string; body: string } {
  return {
    title: "📅 Πρόγραμμα δημοσιεύτηκε",
    body: "Το εβδομαδιαίο πρόγραμμα δημοσιεύτηκε",
  };
}

/** Schedule published — admin. */
export function schedulePublishedAdmin(weekLabel: string): { title: string; body: string } {
  return {
    title: "Πρόγραμμα δημοσιεύτηκε",
    body: `Το εβδομαδιαίο πρόγραμμα (${weekLabel}) δημοσιεύτηκε.`,
  };
}

/** Login from new device — personal. */
export function loginNewDevicePersonal(device: string, time: string): { title: string; body: string } {
  return {
    title: "🔐 Νέα σύνδεση",
    body: `Νέα σύνδεση από ${device} στις ${time}`,
  };
}

/** Password changed — personal. */
export function passwordChangedPersonal(time: string): { title: string; body: string } {
  return {
    title: "🔑 Κωδικός άλλαξε",
    body: `Ο κωδικός σου άλλαξε στις ${time}`,
  };
}

export function formatNotificationTimeElGr(isoOrDate?: string | Date): string {
  const d =
    isoOrDate instanceof Date
      ? isoOrDate
      : isoOrDate
        ? new Date(isoOrDate)
        : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("el-GR", {
    timeZone: "Europe/Athens",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Context passed to admin notification copy builders from notifyByRoleConfig. */
export type AdminNotificationContext = Record<string, unknown> & {
  actor_name?: string;
  actorName?: string;
  modelNames?: string[];
  modelName?: string;
  startTime?: string | Date;
  endTime?: string | Date;
  workedMinutes?: number;
  minutes?: number;
  duration?: string;
  sessionCount?: number;
  platform?: string;
  fanUsername?: string;
  price?: string | number;
  whaleName?: string;
  whaleUsername?: string;
  amount?: number | string;
  currency?: string;
  chatterName?: string;
  mistakeType?: string;
  adminName?: string;
  reason?: string;
  status?: string;
  customTitle?: string;
  formName?: string;
  taskTitle?: string;
  points?: number;
  level?: number | string;
  assigneeName?: string;
  submittedAt?: string | Date;
  decision?: string;
  sopTitle?: string;
  score?: number | string;
  weekLabel?: string;
  device?: string;
  time?: string;
  approved?: boolean;
  username?: string;
  reporterName?: string;
  clientName?: string;
};

function ctxActor(ctx: AdminNotificationContext, fallback?: string): string {
  const name = ctx.actor_name ?? ctx.actorName ?? ctx.chatterName ?? fallback ?? "Someone";
  return String(name).trim() || "Someone";
}

function ctxModels(ctx: AdminNotificationContext): string[] {
  if (Array.isArray(ctx.modelNames)) return ctx.modelNames.filter(Boolean).map(String);
  if (ctx.modelName) return [String(ctx.modelName)];
  return [];
}

/** Rich admin title for paired `_admin` notification events. */
export function buildAdminTitle(
  baseEventType: string,
  ctx: AdminNotificationContext,
  fallbackTitle?: string
): string {
  const actor = ctxActor(ctx);
  switch (baseEventType) {
    case "shift_started":
      return `${actor} ξεκίνησε βάρδια`;
    case "shift_ended":
      return `${actor} τελείωσε βάρδια`;
    case "shift_late":
      return `${actor} άργησε ${ctx.minutes ?? "?"} λεπτά`;
    case "break_exceeded":
      return `${actor} - διάλειμμα ${ctx.minutes ?? "?"} λεπτά`;
    case "model_live_started":
      return `${ctx.modelName ?? actor} πήγε live`;
    case "custom_approved":
      return `Custom εγκρίθηκε — ${ctx.modelName ?? "model"}`;
    case "whale_registered": {
      const whale = String(ctx.whaleUsername ?? ctx.whaleName ?? "Whale");
      if (ctx.modelName) {
        return whaleRegisteredAdminFromChatterWithModel(actor, whale, String(ctx.modelName)).title;
      }
      if (actor !== "Someone") {
        return whaleNeedsChatterAssignmentAdmin(actor, whale).title;
      }
      return whaleRegisteredAdmin(whale).title;
    }
    case "whale_spent":
      return `${ctx.whaleName ?? ctx.whaleUsername ?? "Whale"} έκανε αγορά`;
    case "chatter_mistake":
      return `Λάθος καταχωρήθηκε — ${actor}`;
    case "chatter_mistake_reviewed":
      return `Λάθος ${ctx.decision ?? "—"} — ${actor}`;
    case "fine_issued":
      return fineIssuedAdmin(
        String(ctx.chatterName ?? actor),
        String(ctx.adminName ?? actor),
        ctx.amount ?? "?",
        String(ctx.reason ?? "—")
      ).title;
    case "bonus_awarded":
      return bonusAwardedAdmin(
        String(ctx.chatterName ?? actor),
        String(ctx.adminName ?? actor),
        ctx.amount ?? "?",
        String(ctx.reason ?? "—")
      ).title;
    case "fine_bonus_reviewed":
      return fineBonusReviewedAdmin(
        String(ctx.chatterName ?? actor),
        String(ctx.adminName ?? actor),
        String(ctx.decision ?? "—")
      ).title;
    case "spin_result":
      return spinResultAdmin(actor, String(ctx.prizeName ?? "prize")).title;
    case "period_overdue":
      return periodOverdueAdmin(String(ctx.modelName ?? actor)).title;
    case "billing_cycle_announced":
      return billingCycleAnnouncedAdmin(
        String(ctx.clientName ?? actor),
        String(ctx.amount ?? "—")
      ).title;
    case "shadowban_submitted":
      return shadowbanSubmittedAdmin(
        actor,
        String(ctx.username ?? "—"),
        String(ctx.platform ?? "—"),
        String(ctx.modelName ?? "")
      ).title;
    case "shadowban_resolved":
      return shadowbanResolvedAdmin(
        actor,
        String(ctx.username ?? "—"),
        ctx.approved === true
      ).title;
    case "sop_quiz_passed":
      return sopQuizPassedAdmin(actor, String(ctx.sopTitle ?? "SOP"), Number(ctx.score ?? 0)).title;
    case "schedule_published":
      return schedulePublishedAdmin(String(ctx.weekLabel ?? "εβδομάδα")).title;
    default:
      return fallbackTitle?.trim() || `${actor} — ${baseEventType.replace(/_/g, " ")}`;
  }
}

/** Rich admin body for paired `_admin` notification events. */
export function buildAdminBody(
  baseEventType: string,
  ctx: AdminNotificationContext,
  fallbackBody?: string
): string {
  const actor = ctxActor(ctx);
  const models = ctxModels(ctx);
  const modelList = models.length > 0 ? models.join(", ") : "—";

  switch (baseEventType) {
    case "shift_started": {
      const copy = shiftStartedAdmin(actor, ctx.startTime ?? new Date(), models);
      return copy.body;
    }
    case "shift_ended": {
      const copy = shiftCompletedAdmin(actor, ctx.endTime ?? new Date(), models, ctx.workedMinutes);
      return copy.body;
    }
    case "shift_late":
      return `${actor} ξεκίνησε ${ctx.minutes ?? "?"} λεπτά αργότερα από το πρόγραμμα.`;
    case "break_started": {
      const copy = breakStartedAdmin(actor, ctx.startTime);
      return copy.body;
    }
    case "break_ended": {
      const copy = breakEndedAdmin(actor, ctx.endTime ?? new Date(), ctx.minutes);
      return copy.body;
    }
    case "break_exceeded":
      return `${actor} είναι σε διάλειμμα ${ctx.minutes ?? "?"} λεπτά. Όριο: 45 λεπτά.`;
    case "task_shift_started": {
      const copy = taskShiftStartedAdmin(actor, ctx.startTime ?? new Date(), models);
      return copy.body;
    }
    case "task_shift_ended": {
      const copy = taskShiftEndedAdmin(actor, ctx.endTime ?? new Date());
      return copy.body;
    }
    case "model_live_started": {
      const copy = modelLiveStartedAdmin(String(ctx.modelName ?? actor), String(ctx.platform ?? ""));
      return copy.body;
    }
    case "model_live_ended": {
      const copy = modelLiveEndedAdmin(String(ctx.modelName ?? actor), String(ctx.platform ?? ""));
      return copy.body;
    }
    case "model_became_free": {
      const copy = modelBecameFreeAdmin(String(ctx.modelName ?? actor));
      return copy.body;
    }
    case "model_taken": {
      const copy = modelTakenAdmin(String(ctx.modelName ?? "Model"), actor);
      return copy.body;
    }
    case "custom_request_created": {
      const copy = customRequestCreatedAdmin(actor);
      return copy.body;
    }
    case "custom_approved":
      return `Custom request του ${ctx.fanUsername ?? "fan"} εγκρίθηκε. Model: ${ctx.modelName ?? "—"}, Τιμή: ${ctx.price ?? "—"}`;
    case "whale_registered": {
      const copy = whaleRegisteredAdmin(String(ctx.whaleName ?? ctx.whaleUsername ?? "Whale"));
      return copy.body;
    }
    case "whale_assigned": {
      const copy = whaleAssignedAdmin(
        String(ctx.whaleName ?? ctx.whaleUsername ?? "Whale"),
        String(ctx.assigneeName ?? actor)
      );
      return copy.body;
    }
    case "whale_spent":
      return `${ctx.whaleName ?? ctx.whaleUsername ?? "Whale"} ξόδεψε ${ctx.amount ?? "?"}. Chatter: ${ctx.chatterName ?? actor}. Model: ${ctx.modelName ?? modelList}`;
    case "whale_session_submitted": {
      const copy = whaleSessionSubmittedAdmin(
        actor,
        String(ctx.whaleUsername ?? ctx.whaleName ?? "whale"),
        ctx.amount ?? "?",
        String(ctx.currency ?? ""),
        ctx.modelName ? String(ctx.modelName) : undefined
      );
      return copy.body;
    }
    case "chatter_mistake":
      return `${actor} έκανε λάθος: ${ctx.mistakeType ?? "—"}. Καταχωρήθηκε από ${ctx.adminName ?? "admin"}`;
    case "chatter_mistake_reviewed":
      return ctx.decision === "Εγκρίθηκε"
        ? `${actor} επικύρωσε λάθος${ctx.chatterName ? ` για ${ctx.chatterName}` : ""}.`
        : `${actor} απέρριψε αναφορά λάθους${ctx.chatterName ? ` για ${ctx.chatterName}` : ""}.`;
    case "fine_issued":
      return fineIssuedAdmin(
        String(ctx.chatterName ?? actor),
        String(ctx.adminName ?? actor),
        ctx.amount ?? "?",
        String(ctx.reason ?? "—")
      ).body;
    case "bonus_awarded":
      return bonusAwardedAdmin(
        String(ctx.chatterName ?? actor),
        String(ctx.adminName ?? actor),
        ctx.amount ?? "?",
        String(ctx.reason ?? "—")
      ).body;
    case "fine_bonus_reviewed":
      return fineBonusReviewedAdmin(
        String(ctx.chatterName ?? actor),
        String(ctx.adminName ?? actor),
        String(ctx.decision ?? "—")
      ).body;
    case "form_submitted": {
      const copy = formSubmittedAdmin(
        String(ctx.formName ?? "Form"),
        actor,
        ctx.submittedAt ?? new Date()
      );
      return copy.body;
    }
    case "spin_result": {
      const copy = spinResultAdmin(actor, String(ctx.prizeName ?? "prize"));
      return copy.body;
    }
    case "period_overdue":
      return periodOverdueAdmin(String(ctx.modelName ?? actor)).body;
    case "billing_cycle_announced":
      return billingCycleAnnouncedAdmin(
        String(ctx.clientName ?? actor),
        String(ctx.amount ?? "—")
      ).body;
    case "shadowban_submitted":
      return shadowbanSubmittedAdmin(
        actor,
        String(ctx.username ?? "—"),
        String(ctx.platform ?? "—"),
        String(ctx.modelName ?? "")
      ).body;
    case "shadowban_resolved":
      return shadowbanResolvedAdmin(
        actor,
        String(ctx.username ?? "—"),
        ctx.approved === true
      ).body;
    case "sop_quiz_passed":
      return sopQuizPassedAdmin(actor, String(ctx.sopTitle ?? "SOP"), Number(ctx.score ?? 0)).body;
    case "schedule_published":
      return schedulePublishedAdmin(String(ctx.weekLabel ?? "εβδομάδα")).body;
    default:
      return fallbackBody?.trim() || `${actor}. Models: ${modelList}.`;
  }
}
