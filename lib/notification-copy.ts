/**
 * Notification copy for in-app and push. Short, scannable, lock-screen friendly.
 */

/** Format time for notification body (e.g. "5:09 pm"). */
export function formatTimeShort(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
}

/** Format date + time for body (e.g. "10 Mar, 10:00 am"). */
export function formatDateTimeShort(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
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
      body: `You're live with ${list}. Let's go!`,
    };
  }
  return {
    title: "🟢 Shift started",
    body: "You're live — no models assigned yet.",
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
      body: `Started at ${time} with ${count} model(s): ${list}.`,
    };
  }
  return {
    title: `🟢 ${chatterName} is on shift`,
    body: `Started at ${time} with no models yet.`,
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
      title: "🏁 Shift complete",
      body: `Great work! You were on for ${workedMinutes} min.`,
    };
  }
  return {
    title: "🏁 Shift complete",
    body: "Your shift has ended.",
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
      title: `🏁 ${chatterName} clocked out`,
      body: `Shift ended at ${time}. Total: ${workedMinutes} min.`,
    };
  }
  return {
    title: `🏁 ${chatterName} clocked out`,
    body: `Shift ended at ${time}.`,
  };
}

/** Break started — self. */
export function breakStartedSelf(): { title: string; body: string } {
  return { title: "☕ Enjoy your break", body: "You're on break. Back soon!" };
}

/** Break started — admin. */
export function breakStartedAdmin(chatterName: string, _startedAt?: string | Date): { title: string; body: string } {
  return {
    title: `☕ ${chatterName} is on break`,
    body: "Break started — they'll be back shortly.",
  };
}

/** Break ended — self. */
export function breakEndedSelf(): { title: string; body: string } {
  return { title: "💪 Welcome back", body: "Break over — you're back on shift!" };
}

/** Break ended — admin. */
export function breakEndedAdmin(
  chatterName: string,
  _endTime: string | Date,
  durationMinutes?: number
): { title: string; body: string } {
  const duration = durationMinutes;
  const hasDuration = duration != null && duration > 0;
  return {
    title: `✅ ${chatterName} is back`,
    body: hasDuration ? `Returned from break after ${duration} min.` : "Returned from break.",
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
      body: `Working with ${list} from ${time}.`,
    };
  }
  return {
    title: `📋 ${vaName} started a task shift`,
    body: `Task shift started at ${time}.`,
  };
}

/** Task shift ended — admin. */
export function taskShiftEndedAdmin(vaName: string, endTime: string | Date): { title: string; body: string } {
  const time = formatTimeShort(endTime);
  return {
    title: `✅ ${vaName} finished task shift`,
    body: `Completed at ${time}.`,
  };
}

/** Whale registered — admin. */
export function whaleRegisteredAdmin(whaleName: string): { title: string; body: string } {
  return {
    title: "🐋 New whale registered",
    body: `${whaleName} has been added to the CRM.`,
  };
}

/** Whale registered — chatter (self); same dual path as shift_started (notify + notifyAdmins). */
export function whaleRegisteredSelf(whaleUsername: string): { title: string; body: string } {
  return {
    title: "🐋 Whale added",
    body: `${whaleUsername} is saved in My Whales.`,
  };
}

/** Chatter added whale — admin copy (model not assigned yet). */
export function whaleRegisteredAdminFromChatter(chatterName: string, whaleUsername: string): { title: string; body: string } {
  return {
    title: "🐋 New whale added",
    body: `${chatterName} added a new whale: ${whaleUsername}. Tap to assign a model.`,
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
    body: `${chatterName} added ${whaleUsername} with model ${modelName}.`,
  };
}

/** Chatter submitted a whale; waiting for admin to assign a chatter (no auto-assign). */
export function whaleSubmittedAwaitingAssignmentChatter(whaleUsername: string): { title: string; body: string } {
  return {
    title: "🐋 Whale submitted",
    body: `We received @${whaleUsername}. An admin will assign a chatter — it will appear in My whales once assigned.`,
  };
}

/** Admin: new whale needs chatter assignment. */
export function whaleNeedsChatterAssignmentAdmin(chatterName: string, whaleUsername: string, modelName?: string): { title: string; body: string } {
  const detail = modelName?.trim()
    ? `${chatterName} added @${whaleUsername} (model: ${modelName}). Assign a chatter in Whales.`
    : `${chatterName} added @${whaleUsername}. Assign a chatter in Whales.`;
  return {
    title: "🐋 Whale needs assignment",
    body: detail,
  };
}

/** Chatter was assigned to a whale by admin. */
export function whaleAssignedToYou(whaleUsername: string): { title: string; body: string } {
  return {
    title: "🐋 Whale assigned to you",
    body: `You've been assigned @${whaleUsername}. Open My whales to manage.`,
  };
}

/** Whale assigned — admin. */
export function whaleAssignedAdmin(whaleName: string, assigneeName: string): { title: string; body: string } {
  return {
    title: "🐋 Whale assigned",
    body: `${whaleName} assigned to ${assigneeName}.`,
  };
}

/** New custom request — admin. */
export function customRequestCreatedAdmin(chatterName: string): { title: string; body: string } {
  return {
    title: "📩 New custom request",
    body: `${chatterName} submitted a new custom request.`,
  };
}

/** Custom status changed — chatter. */
export function customStatusChangedChatter(status: string): { title: string; body: string } {
  return {
    title: "📩 Custom updated",
    body: `Your custom request status changed to ${status}.`,
  };
}

/** Model became free — admin. */
export function modelBecameFreeAdmin(modelName: string): { title: string; body: string } {
  return {
    title: "🟡 Model is now free",
    body: `${modelName} is no longer on shift.`,
  };
}

/** Model taken — admin. */
export function modelTakenAdmin(modelName: string, chatterName: string): { title: string; body: string } {
  return {
    title: "🔴 Model taken",
    body: `${modelName} is now on shift with ${chatterName}.`,
  };
}

/** Model went live — assigned chatter (pause chatting). */
export function modelLiveStartedChatter(modelName: string): { title: string; body: string } {
  return {
    title: `🔴 ${modelName} is live!`,
    body: `Pause chatting — ${modelName} just started a live stream.`,
  };
}

/** Model went live — admin oversight. */
export function modelLiveStartedAdmin(modelName: string): { title: string; body: string } {
  return {
    title: `🔴 ${modelName} went live`,
    body: `${modelName} started a live stream.`,
  };
}

/** Model live ended — assigned chatter (resume chatting). */
export function modelLiveEndedChatter(modelName: string): { title: string; body: string } {
  return {
    title: `✅ ${modelName} live ended`,
    body: `${modelName}'s live stream ended. Resume chatting.`,
  };
}

/** Model live ended — admin oversight. */
export function modelLiveEndedAdmin(modelName: string): { title: string; body: string } {
  return {
    title: `📴 ${modelName} live ended`,
    body: `${modelName} finished the live stream.`,
  };
}

/** Availability submitted — self. */
export function availabilitySubmittedSelf(): { title: string; body: string } {
  return {
    title: "📅 Availability submitted",
    body: "Your availability for next week has been recorded.",
  };
}

/** Availability reminder — self. */
export function availabilityReminderSelf(): { title: string; body: string } {
  return {
    title: "⏰ Reminder: Submit your availability",
    body: "Please submit your availability for next week before midnight.",
  };
}

/** Weekly program published — chatter. */
export function weeklyProgramPublishedChatter(): { title: string; body: string } {
  return {
    title: "📅 Weekly program is ready",
    body: "Your schedule for next week has been published. Check your program.",
  };
}

/** VA weekly program published. */
export function weeklyProgramVaPublished(): { title: string; body: string } {
  return {
    title: "📅 VA weekly program is ready",
    body: "Your VA schedule for next week has been published.",
  };
}

/** Custom deadline approaching — chatter. */
export function customDeadlineApproachingChatter(customTitle: string): { title: string; body: string } {
  return {
    title: "⏰ Custom deadline approaching",
    body: `${customTitle} is due in less than 48 hours.`,
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
    title: "🗓 Custom scheduled",
    body: `${who}Scheduled for ${scheduledDate}${at}.`,
  };
}

/** Model scheduled your custom — chatter. */
export function customScheduledChatter(customTitle: string, scheduledDate: string, timeRange?: string): {
  title: string;
  body: string;
} {
  const when = timeRange ? `${scheduledDate} (${timeRange})` : scheduledDate;
  return {
    title: "🗓 Custom scheduled",
    body: `${customTitle} is scheduled for ${when}.`,
  };
}

/** Model marked custom as uploaded — chatter / admin body line. */
export function customUploadedChatter(customTitle: string): { title: string; body: string } {
  return {
    title: "✅ Custom uploaded",
    body: `${customTitle} was marked as uploaded by your model.`,
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
    title: "📝 Form submitted",
    body: `${formName} from ${actorName} at ${t}.`,
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
    title: "🐋 Whale session logged",
    body: `${whaleUsername}${model} · ${amt} ${currency}.`,
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
    title: "🐋 New whale session",
    body: `${chatterName} submitted a session for ${whaleUsername}${model}. ${amt} ${currency}.`,
  };
}
