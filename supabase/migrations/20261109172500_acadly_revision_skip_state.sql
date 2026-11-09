-- Track an explicit not-needed outcome without misclassifying it as completed.
ALTER TABLE public.revisions
  ADD COLUMN IF NOT EXISTS skipped_at timestamptz;

CREATE INDEX IF NOT EXISTS revisions_user_skipped_schedule_idx
  ON public.revisions (user_id, skipped_at, scheduled_for);
