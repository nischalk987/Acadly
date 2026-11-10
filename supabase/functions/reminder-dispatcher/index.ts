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

  const ids = due.map((item) => item.id);
  const vapidPublic = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("WEB_PUSH_VAPID_SUBJECT");
  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    return json({ processed: 0, pending: due.length, push: "vapid-keys-required" }, 202);
  }

  const { data: claimed, error: claimError } = await admin
    .from("reminders")
    .update({ dispatched_at: now })
    .in("id", ids)
    .is("dispatched_at", null)
    .select("id,user_id,title,body,remind_at,event_key");

  if (claimError) return json({ error: "Could not claim due reminders" }, 500);

  const deliveredUsers = new Set((claimed || []).map((item) => item.user_id));
  const { data: subscriptions, error: subError } = await admin
    .from("web_push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
    .in("user_id", [...deliveredUsers])
    .eq("is_active", true);

  if (subError) return json({ processed: claimed?.length || 0, push: "not-configured" });
  // Push sending is delegated to the VAPID sender once its keys are configured.
  // Do not claim browser push was sent when the project has no VAPID credentials.
  if (subscriptions?.length) {
    const { error: pushError } = await admin.from("push_delivery_jobs").insert(
      claimed!.flatMap((reminder) => (subscriptions || [])
        .filter((subscription) => subscription.user_id === reminder.user_id)
        .map((subscription) => ({
          reminder_id: reminder.id,
          subscription_id: subscription.id,
          user_id: reminder.user_id,
          payload: { title: reminder.title, body: reminder.body, url: "/" },
          status: "pending",
        }))),
      { defaultToNull: false },
    );
    if (pushError) return json({ processed: claimed?.length || 0, push: "queue-error" }, 500);
  }

  return json({
    processed: claimed?.length || 0,
    pushJobsQueued: subscriptions?.length || 0,
    push: "queued-for-web-push-worker",
  });
});
