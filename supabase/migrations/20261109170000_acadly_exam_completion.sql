-- Track whether a past exam was explicitly marked completed.
-- NULL means the student has not marked the exam as completed.
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS exams_user_completed_starts_idx
  ON public.exams (user_id, completed_at, starts_at);
