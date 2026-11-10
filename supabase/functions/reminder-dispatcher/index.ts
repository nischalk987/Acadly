import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://acadly.pages.dev",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-acadly-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function equalSecret(expected: string, provided: string | null) {
  if (!provided || provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

function retryDelaySeconds(attempt: number) {
  return Math.min(60 * 2 ** Math.max(0, attempt - 1), 6 * 60 * 60);
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("ACADLY_CRON_SECRET");
  if (!expected || !equalSecret(expected, req.headers.get("x-acadly-cron-secret"))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const secretKey = Deno.env.get("SUPABASE_SECRET_KEY")
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || (() => {
      const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
      return keys ? JSON.parse(keys).default : null;
    })();
  if (!url || !secretKey) return json({ error: "Server configuration is incomplete" }, 500);

  const vapidPublic = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("WEB_PUSH_VAPID_SUBJECT");
  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    return json({ error: "VAPID configuration is incomplete" }, 503);
  }

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  } catch {
    return json({ error: "VAPID keys are invalid" }, 500);
  }

  const now = new Date().toISOString();
  const { data: due, error: fetchError } = await admin
    .from("reminders")
    .select("id,user_id,title,body,remind_at")
    .is("dismissed_at", null)
    .is("dispatched_at", null)
    .lte("remind_at", now)
    .order("remind_at", { ascending: true })
    .limit(250);
  if (fetchError) return json({ error: "Could not load due reminders" }, 500);

  const reminders = due || [];
  let queued = 0;
  let dispatched = 0;
  if (reminders.length) {
    const users = [...new Set(reminders.map((item) => item.user_id))];
    const { data: subscriptions, error: subError } = await admin
      .from("web_push_subscriptions")
      .select("id,user_id")
      .in("user_id", users)
      .eq("is_active", true);
    if (subError) return json({ error: "Could not load push subscriptions" }, 500);

    const activeSubscriptions = subscriptions || [];
    const subscriptionsByUser = new Map<string, typeof activeSubscriptions>();
    for (const subscription of activeSubscriptions) {
      const current = subscriptionsByUser.get(subscription.user_id) || [];
      current.push(subscription);
      subscriptionsByUser.set(subscription.user_id, current);
    }

    const jobs = reminders.flatMap((reminder) =>
      (subscriptionsByUser.get(reminder.user_id) || []).map((subscription) => ({
        reminder_id: reminder.id,
        subscription_id: subscription.id,
        user_id: reminder.user_id,
        payload: { title: reminder.title, body: reminder.body || "", url: "/" },
        status: "pending",
      }))
    );

    if (jobs.length) {
      const { error: queueError, count } = await admin
        .from("push_delivery_jobs")
        .upsert(jobs, { onConflict: "reminder_id,subscription_id", ignoreDuplicates: true, count: "exact" });
      if (queueError) return json({ error: "Could not queue push deliveries" }, 500);
      queued = count || jobs.length;
    }

    const deliverableIds = reminders
      .filter((item) => (subscriptionsByUser.get(item.user_id) || []).length > 0)
      .map((item) => item.id);
    if (deliverableIds.length) {
      const { data: claimed, error: claimError } = await admin
        .from("reminders")
        .update({ dispatched_at: now })
        .in("id", deliverableIds)
        .is("dispatched_at", null)
        .select("id");
      if (claimError) return json({ error: "Could not mark reminders dispatched" }, 500);
      dispatched = claimed?.length || 0;
    }
  }

  // Process the durable queue on every invocation, even when no new reminders are due.
  const { data: jobs, error: jobsError } = await admin
    .from("push_delivery_jobs")
    .select("id,reminder_id,subscription_id,user_id,payload,attempts,web_push_subscriptions!inner(endpoint,p256dh,auth,is_active)")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("created_at", { ascending: true })
    .limit(100);
  if (jobsError) return json({ error: "Could not load pending push jobs" }, 500);

  let sent = 0;
  let retried = 0;
  let expired = 0;
  let failed = 0;

  for (const job of jobs || []) {
    const subscription = Array.isArray(job.web_push_subscriptions)
      ? job.web_push_subscriptions[0]
      : job.web_push_subscriptions;
    if (!subscription?.is_active) {
      await admin.from("push_delivery_jobs").update({
        status: "expired",
        last_error: "Push subscription is inactive",
      }).eq("id", job.id);
      expired += 1;
      continue;
    }

    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify(job.payload), { TTL: 3600, urgency: "normal" });

      const { error: sentError } = await admin.from("push_delivery_jobs").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        last_error: null,
      }).eq("id", job.id).eq("status", "pending");
      if (sentError) throw sentError;
      sent += 1;
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
      const attempts = Number(job.attempts || 0) + 1;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("web_push_subscriptions").update({ is_active: false })
          .eq("id", job.subscription_id);
        await admin.from("push_delivery_jobs").update({
          status: "expired", attempts, last_error: "Push endpoint expired or was removed",
        }).eq("id", job.id);
        expired += 1;
      } else {
        const terminal = attempts >= 10;
        const nextAttempt = new Date(Date.now() + retryDelaySeconds(attempts) * 1000).toISOString();
        await admin.from("push_delivery_jobs").update({
          status: terminal ? "failed" : "pending",
          attempts,
          next_attempt_at: nextAttempt,
          last_error: safeError(error),
        }).eq("id", job.id);
        if (terminal) failed += 1;
        else retried += 1;
      }
    }
  }

  return json({
    remindersDispatched: dispatched,
    deliveryJobsQueued: queued,
    deliveryJobsProcessed: (jobs || []).length,
    sent,
    retried,
    expired,
    failed,
    remainingPending: Math.max(0, (jobs || []).length - sent - expired - failed),
  });
});
