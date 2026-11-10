import { createClient } from "npm:@supabase/supabase-js@2";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("ACADLY_CRON_SECRET");
  const provided = req.headers.get("x-acadly-cron-secret");
  if (!expected || !provided || provided.length !== expected.length) {
    return json({ error: "Unauthorized" }, 401);
  }
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  if (mismatch !== 0) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const secretKey = Deno.env.get("SUPABASE_SECRET_KEY");
  if (!url || !secretKey) return json({ error: "Server configuration is incomplete" }, 500);

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date().toISOString();
  const { data: due, error: fetchError } = await admin
    .from("reminders")
    .select("id,user_id,title,body,remind_at,source_type,source_id,event_key")
    .is("dismissed_at", null)
    .is("dispatched_at", null)
    .lte("remind_at", now)
    .order("remind_at", { ascending: true })
    .limit(250);

  if (fetchError) return json({ error: "Could not load due reminders" }, 500);
  if (!due?.length) return json({ processed: 0 });

  const vapidPublic = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("WEB_PUSH_VAPID_SUBJECT");
  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    return json({ processed: 0, pending: due.length, push: "vapid-keys-required" }, 202);
  }

  const users = [...new Set(due.map((item) => item.user_id))];
  const { data: subscriptions, error: subError } = await admin
    .from("web_push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
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

  const jobs = due.flatMap((reminder) => (subscriptionsByUser.get(reminder.user_id) || [])
    .map((subscription) => ({
      reminder_id: reminder.id,
      subscription_id: subscription.id,
      user_id: reminder.user_id,
      payload: { title: reminder.title, body: reminder.body, url: "/" },
      status: "pending",
    })));

  if (jobs.length) {
    const { error: queueError } = await admin.from("push_delivery_jobs").upsert(jobs, {
      onConflict: "reminder_id,subscription_id",
      ignoreDuplicates: true,
    });
    if (queueError) return json({ error: "Could not queue push deliveries" }, 500);
  }

  const deliverableIds = due
    .filter((item) => (subscriptionsByUser.get(item.user_id) || []).length > 0)
    .map((item) => item.id);
  if (!deliverableIds.length) {
    return json({ processed: 0, pending: due.length, push: "no-active-subscriptions" }, 202);
  }

  // Queue persistence must succeed before the reminder can be marked dispatched.
  const { data: claimed, error: claimError } = await admin
    .from("reminders")
    .update({ dispatched_at: now })
    .in("id", deliverableIds)
    .is("dispatched_at", null)
    .select("id,user_id");
  if (claimError) return json({ error: "Could not mark reminders dispatched" }, 500);

  return json({
    processed: claimed?.length || 0,
    pushJobsQueued: jobs.length,
    push: "queued-for-web-push-worker",
    pendingWithoutSubscriptions: due.length - deliverableIds.length,
  });
});
