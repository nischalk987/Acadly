-- Least-privilege grants for Acadly's user-owned tables.
-- RLS remains the row-level authorization boundary for authenticated students.
-- Anonymous clients cannot query or mutate private student records at the SQL privilege layer.

REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon, PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.subjects FROM anon, PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.chapters FROM anon, PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.study_tasks FROM anon, PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.exams FROM anon, PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.study_sessions FROM anon, PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.notes FROM anon, PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.revisions FROM anon, PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.reminders FROM anon, PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.user_preferences FROM anon, PUBLIC;

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
