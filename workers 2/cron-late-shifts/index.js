/**
 * Cron Worker:
 * - Every 5 minutes → GET /api/cron/check-break-reminders (chatter break reminders).
 * - Every 15 minutes → GET /api/cron/check-late-shifts (late shifts, breaks, availability, customs, VA tasks,
 *   plus custom requests with no update in 48h+ → admin).
 * - Daily at 00:00 UTC → GET /api/cron/daily-summary (yesterday in fixed Athens UTC+3 calendar).
 * - Daily at 21:00 UTC → GET /api/cron/update-streaks (≈ midnight fixed Athens UTC+3 wall clock).
 * Set APP_URL, CRON_SECRET, and UPDATE_STREAKS_CRON_URL (defaults to APP_URL + /api/cron/update-streaks); main app must use the same CRON_SECRET.
 *
 * Greece calendar uses fixed UTC+3 (same convention as lib/airtable-datetime.ts).
 * `0 0 * * *` at 00:00 UTC = 03:00 on that Athens-style clock — daily summary runs then.
 * `0 21 * * *` at 21:00 UTC = 00:00 on that Athens-style clock — streak updates run then.
 * Friday 09:00 / 21:00 checks run inside the app (Etc/GMT-3 wall clock + Athens weekday helpers).
 */

function normalizeUrl(url) {
  return String(url || "").replace(/([^:]\/)\/+/g, "$1");
}

export default {
  async scheduled(event, env, ctx) {
    const cron = event.cron ?? "";
    const base = (env.APP_URL || "").replace(/\/$/, "");
    const secret = env.CRON_SECRET;
    const headers = secret ? { "x-cron-secret": secret } : {};

    if (cron === "0 0 * * *") {
      const url = normalizeUrl(`${base}/api/cron/daily-summary`);
      ctx.waitUntil(
        fetch(url, { method: "GET", headers })
          .then((r) => r.json())
          .then((data) => {
            if (data?.ok !== true) console.warn("[cron-late-shifts] daily-summary returned:", data);
          })
          .catch((err) => console.error("[cron-late-shifts] daily-summary fetch failed", err))
      );
      return;
    }

    if (cron === "*/5 * * * *") {
      const CHECK_BREAK_REMINDERS_URL = normalizeUrl(`${base}/api/cron/check-break-reminders`);
      console.log("[cron-worker] calling check-break-reminders", { url: CHECK_BREAK_REMINDERS_URL });
      ctx.waitUntil(
        fetch(CHECK_BREAK_REMINDERS_URL, { method: "GET", headers })
          .then((r) => r.json())
          .then((data) => {
            if (data?.ok !== true) console.warn("[cron-late-shifts] check-break-reminders returned:", data);
          })
          .catch((err) => console.error("[cron-late-shifts] check-break-reminders fetch failed", err))
      );
      return;
    }

    if (cron === "0 21 * * *") {
      const streaksUrlRaw =
        (env.UPDATE_STREAKS_CRON_URL || "").trim() || `${base}/api/cron/update-streaks`;
      const url = normalizeUrl(streaksUrlRaw);
      const streaksHeaders = secret ? { Authorization: `Bearer ${secret}` } : {};
      ctx.waitUntil(
        fetch(url, { method: "GET", headers: streaksHeaders })
          .then((r) => r.json())
          .then((data) => {
            if (data?.ok !== true) console.warn("[cron-late-shifts] update-streaks returned:", data);
          })
          .catch((err) => console.error("[cron-late-shifts] update-streaks fetch failed", err))
      );
      return;
    }

    const url = normalizeUrl(`${base}/api/cron/check-late-shifts`);
    ctx.waitUntil(
      fetch(url, { method: "GET", headers })
        .then((r) => r.json())
        .then((data) => {
          if (data?.ok !== true) console.warn("[cron-late-shifts] check returned:", data);
        })
        .catch((err) => console.error("[cron-late-shifts] fetch failed", err))
    );
  },
};
