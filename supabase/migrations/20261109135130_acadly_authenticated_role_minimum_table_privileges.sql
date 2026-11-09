-- Remove inherited/default non-DML privileges from the authenticated role.
-- Students need row-level CRUD only; RLS policies enforce which rows they may touch.

REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.subjects FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.chapters FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.study_tasks FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.exams FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.study_sessions FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.notes FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.revisions FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.reminders FROM authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.user_preferences FROM authenticated;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chapters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.study_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.exams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.study_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.revisions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reminders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_preferences TO authenticated;
