-- Prevent chapters from ever referencing another student's subject.
-- The composite FK complements the existing RLS ownership policies.

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_id_user_id_unique UNIQUE (id, user_id);

ALTER TABLE public.chapters
  DROP CONSTRAINT chapters_subject_id_fkey;

ALTER TABLE public.chapters
  ADD CONSTRAINT chapters_subject_owner_fk
  FOREIGN KEY (subject_id, user_id)
  REFERENCES public.subjects (id, user_id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS chapters_subject_position_idx
  ON public.chapters (subject_id, position, created_at);
