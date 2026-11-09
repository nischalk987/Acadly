-- Stable event identity makes reminder generation idempotent.
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS event_key text,
  ADD COLUMN IF NOT EXISTS notification_type text NOT NULL DEFAULT 'reminder';

CREATE UNIQUE INDEX IF NOT EXISTS reminders_user_event_key_unique
  ON public.reminders (user_id, event_key)
  WHERE event_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS reminders_user_active_time_idx
  ON public.reminders (user_id, remind_at DESC)
  WHERE dismissed_at IS NULL;

ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_notification_type_check
  CHECK (notification_type IN ('reminder','task','exam','revision','system'));
