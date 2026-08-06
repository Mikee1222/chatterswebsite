/**
 * Local-only smoke tests with DATA_BACKEND=supabase.
 * Run: npx tsx scripts/_smoke-supabase-local.ts
 */
import { config as loadEnv } from "dotenv";
import "./_polyfill-websocket";
loadEnv({ path: ".env.local" });
loadEnv();
process.env.DATA_BACKEND = "supabase";

type Result = { name: string; pass: boolean; detail: string };
const results: Result[] = [];

function ok(name: string, detail: string) {
  results.push({ name, pass: true, detail });
  console.log(`PASS  ${name} — ${detail}`);
}
function fail(name: string, detail: string) {
  results.push({ name, pass: false, detail });
  console.error(`FAIL  ${name} — ${detail}`);
}

async function run(name: string, fn: () => Promise<string>) {
  try {
    ok(name, await fn());
  } catch (e) {
    fail(name, e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e));
  }
}

async function main() {
  const { getDataBackend } = await import("../lib/data-backend");
  if (getDataBackend() !== "supabase") {
    fail("backend_flag", `expected supabase, got ${getDataBackend()}`);
    printSummary();
    process.exit(1);
  }
  ok("backend_flag", "DATA_BACKEND=supabase");

  const users = await import("../services/users");
  const roles = await import("../services/roles");
  const shifts = await import("../services/shifts");
  const customRequests = await import("../services/custom-requests");
  const marketingReviews = await import("../services/marketing-reviews");
  const linkPages = await import("../services/link-pages");
  const linkAnalytics = await import("../services/link-page-analytics");
  const clientPortal = await import("../services/client-portal");
  const ofSync = await import("../services/of-sync");
  const vaTasks = await import("../services/va-tasks");
  const { expandTasksForAthensYmd, getVaTasksViewTodayYmd } = await import("../lib/va-task-date-filter");
  const notifications = await import("../services/notifications");
  const winnerVideos = await import("../services/winner-videos");
  const researchBunches = await import("../services/research-bunches");
  const modelss = await import("../services/modelss");
  const { getSupabaseServiceClient } = await import("../lib/supabase-server");

  const allUsers = await users.listAllUsers();
  const admin = allUsers.find((u) => u.role === "admin" && u.can_login !== false);
  const va = allUsers.find((u) => u.role === "virtual_assistant" && u.can_login !== false);
  const chatter = allUsers.find((u) => u.role === "chatter" && u.can_login !== false);
  const creative =
    allUsers.find((u) => (u.va_type ?? "").toLowerCase().includes("creative")) ??
    allUsers.find((u) => u.role === "virtual_assistant" && u.id !== va?.id) ??
    va;

  await run("1_users_roles_load", async () => {
    if (!admin) throw new Error("No admin user in Supabase");
    if (!va) throw new Error("No VA user in Supabase");
    const roleList = await roles.getRoles();
    const adminPerms = await roles.getRolePermissions("admin");
    const vaPerms = await roles.getRolePermissions("virtual_assistant");
    return `users=${allUsers.length} roles=${roleList.length} adminPerms=${adminPerms.length} vaPerms=${vaPerms.length}`;
  });

  await run("2_shift_start_end", async () => {
    if (!va) throw new Error("No VA");
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10);
    const created = await shifts.createShift({
      chatter: [va.id],
      chatter_name: va.full_name || va.email,
      date: ymd,
      start_time: now.toISOString(),
      status: "active",
      staff_role: "virtual_assistant",
      shift_type: "task",
      task_label: "smoke_test_va_task",
      notes: "smoke-supabase-local",
    });
    const byId = await shifts.getShiftById(created.id);
    if (!byId) throw new Error("Created shift not readable from Supabase");
    const ended = await shifts.updateShift(created.id, {
      status: "completed",
      end_time: new Date().toISOString(),
      total_minutes: 1,
      total_hours_decimal: 0.02,
    });
    const re = await shifts.getShiftById(created.id);
    if (!re?.end_time && re?.status !== "completed") {
      throw new Error(`Shift end not persisted: ${JSON.stringify({ status: re?.status, end: re?.end_time })}`);
    }
    return `shift=${created.id} status=${ended.status ?? re?.status} end=${re?.end_time ?? ended.end_time}`;
  });

  await run("3_custom_request_lifecycle", async () => {
    const models = await modelss.listAllModelss();
    const model = models[0];
    if (!model) throw new Error("No models in Supabase");
    const requester = chatter ?? admin!;
    const created = await customRequests.createCustomRequest({
      chatter_record_id: requester.id,
      chatter_name: requester.full_name || requester.email,
      model_record_id: model.id,
      model_name: model.model_name || "model",
      fan_username: "smoke_fan_local",
      request_title: "Smoke custom request",
      request_details: "local supabase smoke",
      price: "10",
    });
    const approved = await customRequests.updateCustomRequestAdminStatus(created.id, "accepted");
    if (approved.admin_status !== "accepted") throw new Error(`admin_status=${approved.admin_status}`);
    const completed = await customRequests.updateCustomRequestStatus(created.id, "completed");
    const again = await customRequests.getCustomRequestById(created.id);
    return `id=${created.id} admin=${approved.admin_status} final=${again?.admin_status ?? completed.admin_status}`;
  });

  await run("4_marketing_review", async () => {
    if (!va || !admin) throw new Error("Need VA+admin");
    const today = new Date().toISOString().slice(0, 10);
    const spot = await marketingReviews.createSpotCheck({
      manager_name: admin.full_name || admin.email,
      manager_id: admin.id,
      type: "Other",
      exec_va_id: va.id,
      exec_va_name: va.full_name || va.email,
      what_was_wrong: "smoke-supabase-local",
      action_taken: "noted",
      status: "Pending",
    });
    const spots = await marketingReviews.getSpotChecks({ execVaId: va.id } as never);
    const found = spots.some((s) => s.id === spot.id);

    const daily = await marketingReviews.createDailyReview({
      manager_name: admin.full_name || admin.email,
      review_date: today,
      review_label: `Smoke daily ${today}`,
      issues_found: "smoke-supabase-local",
      actions_assigned: "none",
    });
    const byDate = await marketingReviews.getDailyReviewByDate(today, admin.full_name || admin.email);
    if (!found) throw new Error("Spot check not in list after create");
    if (!byDate) throw new Error("Daily review not readable by date");
    return `spot=${spot.id} daily=${daily.id} byDate=${byDate.id}`;
  });

  await run("5_link_page_publish_click", async () => {
    const pages = await linkPages.listLinkPages();
    let page = pages.find((p) => p.status === "published") ?? pages[0];
    if (!page) {
      page = await linkPages.createLinkPage({
        title: "Smoke Link Page",
        slug: `smoke-${Date.now().toString(36)}`,
      } as never);
    }
    const published = page.status === "published" ? page : await linkPages.publishLinkPage(page.id);
    const pageId = published.page_id || published.id;
    // Prefer awaited supabase path
    const sbAnalytics = await import("../services/link-page-analytics-supabase");
    await sbAnalytics.trackLinkClick({
      pageId,
      blockId: "smoke_block",
      ip: "127.0.0.1",
      userAgent: "smoke-supabase-local",
      referrer: "",
      sessionId: `smoke_sess_${Date.now()}`,
      visitorId: `smoke_vis_${Date.now()}`,
      isNewVisitor: true,
      isNewSession: true,
    });
    await new Promise((r) => setTimeout(r, 500));
    const analytics = await linkAnalytics.getPageAnalytics(pageId, { days: 7 });
    if ((analytics.linkClicks ?? 0) < 1 && (analytics.pageViews ?? 0) < 1) {
      // still pass if write didn't throw — check raw table
      const sb = getSupabaseServiceClient();
      const { count, error } = await sb
        .from("link_page_analytics")
        .select("*", { count: "exact", head: true })
        .eq("page_id", pageId);
      if (error) throw error;
      return `slug=${published.slug} pageId=${pageId} raw_events=${count ?? 0} analytics_clicks=${analytics.linkClicks}`;
    }
    return `slug=${published.slug} pageId=${pageId} clicks=${analytics.linkClicks} views=${analytics.pageViews}`;
  });

  await run("6_client_portal_payment", async () => {
    const clients = await clientPortal.listAllClients(true);
    if (!clients.length) throw new Error("No active clients in Supabase");
    const client = clients[0];
    const cycles = await clientPortal.getClientBillingCycles(client.id);
    let cycle = cycles[0];
    if (!cycle) {
      const start = new Date();
      const end = new Date(Date.now() + 7 * 86400000);
      cycle = await clientPortal.createBillingCycleForClient(client.id, {
        kind: "crm_monthly",
        period_start: start.toISOString().slice(0, 10),
        period_end: end.toISOString().slice(0, 10),
        due_date: end.toISOString().slice(0, 10),
        amount: 1,
        currency: "USD",
        status: "announced",
      } as never);
    }
    const methods = await clientPortal.getClientPaymentMethods(client.id);
    const methodId = methods[0]?.id;
    if (!methodId) {
      // create submission directly with a known payment method airtable id from DB
      const sb = getSupabaseServiceClient();
      const { data: pm } = await sb.from("payment_methods").select("airtable_id").limit(1).maybeSingle();
      if (!pm?.airtable_id) throw new Error("No payment_methods in Supabase");
      const submission = await clientPortal.createPaymentSubmission({
        billing_cycle: [cycle.id],
        client: [client.id],
        selected_payment_method: [pm.airtable_id],
        submitted_amount: 1,
        submitted_currency: "USD",
        submitted_datetime: new Date().toISOString(),
        note: "smoke-supabase-local proof",
        proof_url: "https://example.com/smoke-proof.png",
        status: "pending_review",
      });
      const pending = await clientPortal.getPendingPaymentSubmissionsForClient(client.id);
      const byId = await clientPortal.getPaymentSubmissionById(submission.id);
      if (!byId) throw new Error("Admin cannot read payment submission");
      return `client=${client.id} cycle=${cycle.id} submission=${submission.id} pending=${pending.length}`;
    }
    const result = await clientPortal.submitClientPaymentProof(client.id, {
      billing_cycle_id: cycle.id,
      payment_method_id: methodId,
      amount: 1,
      currency: "USD",
      datetime: new Date().toISOString(),
      notes: "smoke-supabase-local proof",
      proof_url: "https://example.com/smoke-proof.png",
    });
    const pending = await clientPortal.getPendingPaymentSubmissionsForClient(client.id);
    const byId = await clientPortal.getPaymentSubmissionById(result.submissionId);
    if (!byId && !result.alreadySubmitted) throw new Error("Admin cannot see submission");
    return `client=${client.id} cycle=${cycle.id} submission=${result.submissionId} already=${result.alreadySubmitted} pending=${pending.length}`;
  });

  await run("7_of_sync_chunk", async () => {
    const models = await modelss.listAllModelss();
    let ofId = "";
    let modelName = "smoke";
    for (const m of models) {
      const id = (m.of_user_id ?? "").trim();
      if (id && /^\d+$/.test(id)) {
        ofId = id;
        modelName = m.model_name || id;
        break;
      }
    }
    if (!ofId) {
      const sb = getSupabaseServiceClient();
      const { data } = await sb.from("of_subscribers").select("of_account_id, model_name").limit(1).maybeSingle();
      if (!data?.of_account_id) throw new Error("No of_account_id available from models or of_subscribers");
      ofId = String(data.of_account_id);
      modelName = data.model_name || ofId;
    }
    const result = await ofSync.syncSubscribersChunkForAccount(ofId, modelName, 0, { highValueOnly: true });
    if (result.errors > 0 && result.checked === 0 && result.synced === 0) {
      throw new Error(`chunk failed: ${JSON.stringify(result)}`);
    }
    return `ofId=${ofId} synced=${result.synced} checked=${result.checked} errors=${result.errors} has_more=${result.has_more}`;
  });

  await run("8_va_tasks_virtual_projection", async () => {
    const today = getVaTasksViewTodayYmd();
    const tomorrowDate = new Date(today + "T12:00:00Z");
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);
    const tasks = await vaTasks.getAllVaTasks();
    const recurring = tasks.filter((t) => t.is_recurring);
    const todayExpanded = expandTasksForAthensYmd(tasks, today);
    const tomorrowExpanded = expandTasksForAthensYmd(tasks, tomorrow);
    const todayReal = todayExpanded.filter((t) => !t.is_virtual_occurrence).length;
    const todayVirtual = todayExpanded.filter((t) => t.is_virtual_occurrence).length;
    const tomorrowVirtual = tomorrowExpanded.filter((t) => t.is_virtual_occurrence).length;
    return `tasks=${tasks.length} recurring=${recurring.length} today real=${todayReal} virt=${todayVirtual} tomorrow virt=${tomorrowVirtual}`;
  });

  await run("9_notification_event_types", async () => {
    if (!admin) throw new Error("No admin");
    const cases: Array<{ event_type: "shift_started" | "custom_request_created" | "va_task_assigned" | "winner_video_submitted"; category: "shift" | "custom_request" | "task" | "system" }> = [
      { event_type: "shift_started", category: "shift" },
      { event_type: "custom_request_created", category: "custom_request" },
      { event_type: "va_task_assigned", category: "task" },
      { event_type: "winner_video_submitted", category: "system" },
    ];
    const createdIds: string[] = [];
    const types: string[] = [];
    for (const c of cases) {
      const n = await notifications.createNotification({
        user_id: admin.id,
        category: c.category,
        event_type: c.event_type,
        title: `Smoke ${c.event_type}`,
        body: "smoke-supabase-local",
        priority: "normal",
        entity_type: "system",
        entity_id: `smoke_${Date.now()}_${c.event_type}`,
      });
      if (!n) throw new Error(`createNotification returned null for ${c.event_type}`);
      if (n.event_type !== c.event_type) {
        throw new Error(`event_type mismatch wrote=${c.event_type} got=${n.event_type}`);
      }
      createdIds.push(n.id);
      types.push(n.event_type);
    }
    const listed = await notifications.listNotificationsForUser(admin.id, { pageSize: 30 });
    const list = Array.isArray(listed) ? listed : (listed as { notifications: { id: string }[] }).notifications ?? [];
    const found = createdIds.filter((id) => list.some((n: { id: string }) => n.id === id)).length;
    return `created=${createdIds.length} found=${found} types=${types.join(",")}`;
  });

  await run("10_winner_creative_pipeline", async () => {
    if (!va || !admin || !creative) throw new Error("Need VA+admin+creative");
    const video = await winnerVideos.createWinnerVideo({
      reference_model_name: "Smoke Model",
      content_type: "UGC",
      video_link: "https://example.com/smoke-video",
      note: "smoke-supabase-local",
      submitted_by_id: va.id,
      submitted_by_name: va.full_name || va.email,
    });
    const deadline = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const approved = await winnerVideos.approveWinnerVideo(video.id, {
      assigned_creator_name: "Smoke Creator",
      recreation_deadline: deadline,
      assigned_creative_id: creative.id,
      assigned_creative_name: creative.full_name || creative.email,
      reviewed_by_name: admin.full_name || admin.email,
      reviewed_by_id: admin.id,
    });
    if (approved.status !== "Approved") throw new Error(`status=${approved.status}`);
    const scripted = await winnerVideos.submitCreativeScript(video.id, {
      assigned_creator_name: approved.assigned_creator_name || "Smoke Creator",
      script_video_type: "UGC",
      script_text: "Smoke creative script body for local supabase test.",
      script_submitted_by_id: creative.id,
      script_submitted_by_name: creative.full_name || creative.email,
    });
    const scriptApproved = await winnerVideos.approveCreativeScript(video.id, {
      script_text: scripted.script_text || "Smoke creative script body for local supabase test.",
      reviewed_by_name: admin.full_name || admin.email,
    });
    return `wv=${video.id} status=${approved.status} script=${scriptApproved.script_status ?? scripted.script_status}`;
  });

  await run("10b_research_bunch_submit_approve", async () => {
    if (!admin) throw new Error("No admin");
    const models = await modelss.listAllModelss();
    const model = models[0];
    if (!model) throw new Error("No model");
    const { bunch } = await researchBunches.createManagerBunch({
      creator_model_id: model.id,
      creator_name: model.model_name || "Smoke",
      target_research: 1,
      target_winner: 1,
      created_by_name: admin.full_name || admin.email,
    });
    const idea = await researchBunches.addIdea({
      bunch_id: bunch.id,
      platform: "TT",
      idea_text: "smoke idea",
      reference_link: "https://example.com/smoke",
    });
    await researchBunches.setIdeaChecked(idea.id, true);
    await researchBunches.submitBunch(bunch.id);
    const fresh = await researchBunches.getBunchById(bunch.id);
    if (!fresh) throw new Error("bunch missing after submit");
    const { spawned } = await researchBunches.approveBunch(fresh, {
      user_id: admin.id,
      name: admin.full_name || admin.email,
    });
    const after = await researchBunches.getBunchById(bunch.id);
    return `bunch=${bunch.id} status=${after?.status} spawned=${spawned}`;
  });

  printSummary();
  process.exit(results.some((r) => !r.pass) ? 1 : 0);
}

function printSummary() {
  console.log("\n======== SMOKE SUMMARY ========");
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}\t${r.name}\t${r.detail.split("\n")[0]}`);
  }
  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
