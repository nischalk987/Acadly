-- Browser Web Push subscriptions and per-reminder delivery queue.
CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  expiration_time timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT web_push_subscriptions_user_endpoint_unique UNIQUE (user_id, endpoint),
  CONSTRAINT web_push_subscriptions_endpoint_length CHECK (char_length(endpoint) BETWEEN 1 AND 2048),
  CONSTRAINT web_push_subscriptions_p256dh_length CHECK (char_length(p256dh) BETWEEN 1 AND 256),
  CONSTRAINT web_push_subscriptions_auth_length CHECK (char_length(auth) BETWEEN 1 AND 256)
);

CREATE INDEX IF NOT EXISTS web_push_subscriptions_active_user_idx
  ON public.web_push_subscriptions (user_id)
  WHERE is_active;

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own web push subscriptions" ON public.web_push_subscriptions;
CREATE POLICY "Users manage own web push subscriptions"
  ON public.web_push_subscriptions
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE TABLE IF NOT EXISTS public.push_delivery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.web_push_subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','expired')),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT push_delivery_jobs_once_per_subscription UNIQUE (reminder_id, subscription_id)
);

CREATE INDEX IF NOT EXISTS push_delivery_jobs_pending_idx
  ON public.push_delivery_jobs (next_attempt_at, created_at)
  WHERE status = 'pending';

ALTER TABLE public.push_delivery_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own push delivery jobs" ON public.push_delivery_jobs;
CREATE POLICY "Users read own push delivery jobs"
  ON public.push_delivery_jobs
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.push_delivery_jobs FROM anon, authenticated;
GRANT SELECT ON public.push_delivery_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_push_subscriptions TO authenticated;
