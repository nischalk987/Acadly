-- Local/demo-only data for the Supabase CLI local stack.
-- This seed creates no Auth users and inserts no rows into live/remote projects.
-- Demo user UUID is a fixed local-only placeholder for reproducible sample records.

do $$
begin
  if coalesce(current_setting('app.settings.seed_demo_data', true), 'true') <> 'true' then
    raise notice 'Acadly demo seed disabled by app.settings.seed_demo_data';
    return;
  end if;
end
$$;

-- This file is applied only by local Supabase CLI workflows (supabase start/db reset).
-- Do not run it manually against a hosted project.
-- We use an existing placeholder auth.users row only on the local stack.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  is_sso_user, is_anonymous
)
values (
  'd0e3c8f0-1234-5678-9abc-def012345678',
  'authenticated', 'authenticated', 'demo.student@acadly.local',
  '', now(), '{"provider":"email","providers":["email"]}',
  '{"display_name":"Demo Student"}', now(), now(), '', '', '', '',
  false, false
)
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at,
  created_at, updated_at
)
values (
  'd0e3c8f0-1234-5678-9abc-def012345678',
  'd0e3c8f0-1234-5678-9abc-def012345678',
  '{"sub":"d0e3c8f0-1234-5678-9abc-def012345678","email":"demo.student@acadly.local"}',
  'email', now(), now(), now()
)
on conflict (provider_id, provider) do nothing;

insert into public.subjects (id, user_id, name, description, color, position)
values
  ('10000000-0000-4000-8000-000000000001', 'd0e3c8f0-1234-5678-9abc-def012345678', 'Computer Networks', 'Understand the layers and protocols that connect systems.', '#3B82F6', 1),
  ('10000000-0000-4000-8000-000000000002', 'd0e3c8f0-1234-5678-9abc-def012345678', 'Operating Systems', 'Processes, memory, scheduling and file systems.', '#8B5CF6', 2),
  ('10000000-0000-4000-8000-000000000003', 'd0e3c8f0-1234-5678-9abc-def012345678', 'Data Structures', 'Practice core structures and algorithms.', '#F59E0B', 3)
on conflict (id) do nothing;

insert into public.chapters (id, user_id, subject_id, title, status, position)
values
  ('20000000-0000-4000-8000-000000000001', 'd0e3c8f0-1234-5678-9abc-def012345678', '10000000-0000-4000-8000-000000000001', 'Transport Layer', 'in_progress', 1),
  ('20000000-0000-4000-8000-000000000002', 'd0e3c8f0-1234-5678-9abc-def012345678', '10000000-0000-4000-8000-000000000002', 'CPU Scheduling', 'not_started', 1),
  ('20000000-0000-4000-8000-000000000003', 'd0e3c8f0-1234-5678-9abc-def012345678', '10000000-0000-4000-8000-000000000003', 'Graph Traversals', 'not_started', 1)
on conflict (id) do nothing;

insert into public.study_tasks (id, user_id, subject_id, chapter_id, title, due_at, priority, status)
values
  ('30000000-0000-4000-8000-000000000001', 'd0e3c8f0-1234-5678-9abc-def012345678', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Review TCP congestion control', now() + interval '1 day', 'high', 'pending'),
  ('30000000-0000-4000-8000-000000000002', 'd0e3c8f0-1234-5678-9abc-def012345678', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Solve CPU scheduling examples', now() + interval '2 days', 'medium', 'pending')
on conflict (id) do nothing;

insert into public.exams (id, user_id, subject_id, title, exam_type, starts_at, notes)
values
  ('40000000-0000-4000-8000-000000000001', 'd0e3c8f0-1234-5678-9abc-def012345678', '10000000-0000-4000-8000-000000000001', 'Computer Networks practice assessment', 'practice', now() + interval '10 days', 'Local demo exam record.')
on conflict (id) do nothing;

insert into public.study_sessions (id, user_id, subject_id, chapter_id, started_at, ended_at, duration_seconds, completed)
values
  ('50000000-0000-4000-8000-000000000001', 'd0e3c8f0-1234-5678-9abc-def012345678', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', now() - interval '2 hours', now() - interval '90 minutes', 1800, true)
on conflict (id) do nothing;

insert into public.notes (id, user_id, subject_id, chapter_id, title, content)
values
  ('60000000-0000-4000-8000-000000000001', 'd0e3c8f0-1234-5678-9abc-def012345678', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Transport layer revision notes', 'Local demo notes. Replace with your own study notes.')
on conflict (id) do nothing;

insert into public.revisions (id, user_id, chapter_id, revision_number, scheduled_for)
values
  ('70000000-0000-4000-8000-000000000001', 'd0e3c8f0-1234-5678-9abc-def012345678', '20000000-0000-4000-8000-000000000001', 1, now() + interval '3 days')
on conflict (id) do nothing;

insert into public.reminders (id, user_id, title, body, remind_at, source_type, source_id)
values
  ('80000000-0000-4000-8000-000000000001', 'd0e3c8f0-1234-5678-9abc-def012345678', 'Review your study notes', 'A small revision session can help reinforce what you learned.', now() + interval '1 day', 'custom', null)
on conflict (id) do nothing;
