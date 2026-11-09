-- Acadly schema baseline (snapshot of the deployed development schema).
-- This migration is versioned to match the already-applied hosted migration.
-- Keep future changes in new migrations; do not mutate old migration history.

create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Student',
  avatar_path text,
  timezone text not null default 'Asia/Kolkata',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text,
  color text not null default '#7C3AED',
  position integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subjects_user_position_idx on public.subjects(user_id, position);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index chapters_user_subject_idx on public.chapters(user_id, subject_id, position);

create table public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text,
  due_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_tasks_time_order check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint study_tasks_chapter_owner_fk foreign key (chapter_id,user_id) references public.chapters(id,user_id) on delete set null (chapter_id)
);
create index study_tasks_user_due_idx on public.study_tasks(user_id, due_at);
create index study_tasks_user_status_idx on public.study_tasks(user_id, status);
create index study_tasks_subject_id_idx on public.study_tasks(subject_id);
create index study_tasks_chapter_owner_idx on public.study_tasks(chapter_id, user_id);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 180),
  exam_type text,
  starts_at timestamptz not null,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exams_user_starts_idx on public.exams(user_id, starts_at);
create index exams_subject_id_idx on public.exams(subject_id);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid,
  session_type text not null default 'focus' check (session_type in ('focus','short_break','long_break')),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 86400),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint study_sessions_chapter_owner_fk foreign key (chapter_id,user_id) references public.chapters(id,user_id) on delete set null (chapter_id),
  constraint study_sessions_end_after_start check (ended_at is null or ended_at >= started_at)
);
create index study_sessions_user_started_idx on public.study_sessions(user_id, started_at desc);
create index study_sessions_subject_id_idx on public.study_sessions(subject_id);
create index study_sessions_chapter_owner_idx on public.study_sessions(chapter_id, user_id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 180),
  content text,
  file_path text,
  file_name text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_chapter_owner_fk foreign key (chapter_id,user_id) references public.chapters(id,user_id) on delete set null (chapter_id),
  constraint notes_file_metadata_check check (
    (file_path is null and file_name is null and mime_type is null and file_size_bytes is null)
    or
    (file_path is not null and file_name is not null and mime_type is not null and file_size_bytes is not null)
  )
);
create index notes_user_updated_idx on public.notes(user_id, updated_at desc);
create index notes_subject_id_idx on public.notes(subject_id);
create index notes_chapter_owner_idx on public.notes(chapter_id, user_id);

create table public.revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null,
  revision_number integer not null default 1 check (revision_number > 0),
  scheduled_for timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint revisions_chapter_owner_fk foreign key (chapter_id,user_id) references public.chapters(id,user_id) on delete cascade
);
create index revisions_user_schedule_idx on public.revisions(user_id, scheduled_for);
create index revisions_chapter_owner_idx on public.revisions(chapter_id, user_id);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 180),
  body text,
  remind_at timestamptz not null,
  source_type text check (source_type in ('task','exam','revision','custom')),
  source_id uuid,
  is_read boolean not null default false,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);
create index reminders_user_time_idx on public.reminders(user_id, remind_at);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  focus_minutes smallint not null default 25 check (focus_minutes between 5 and 120),
  short_break_minutes smallint not null default 5 check (short_break_minutes between 1 and 30),
  long_break_minutes smallint not null default 15 check (long_break_minutes between 5 and 60),
  daily_goal_minutes smallint not null default 120 check (daily_goal_minutes between 15 and 1440),
  reminders_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger subjects_set_updated_at before update on public.subjects for each row execute function public.set_updated_at();
create trigger chapters_set_updated_at before update on public.chapters for each row execute function public.set_updated_at();
create trigger study_tasks_set_updated_at before update on public.study_tasks for each row execute function public.set_updated_at();
create trigger exams_set_updated_at before update on public.exams for each row execute function public.set_updated_at();
create trigger notes_set_updated_at before update on public.notes for each row execute function public.set_updated_at();
create trigger user_preferences_set_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Student'));
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.study_tasks enable row level security;
alter table public.exams enable row level security;
alter table public.study_sessions enable row level security;
alter table public.notes enable row level security;
alter table public.revisions enable row level security;
alter table public.reminders enable row level security;
alter table public.user_preferences enable row level security;

create policy "Users can read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users can insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users can update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Users manage own subjects" on public.subjects for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own chapters" on public.chapters for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = (select auth.uid())));
create policy "Users manage own tasks" on public.study_tasks for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and (subject_id is null or exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = (select auth.uid()))) and (chapter_id is null or exists (select 1 from public.chapters c where c.id = chapter_id and c.user_id = (select auth.uid())));
create policy "Users manage own exams" on public.exams for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and (subject_id is null or exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = (select auth.uid())));
create policy "Users manage own sessions" on public.study_sessions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and (subject_id is null or exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = (select auth.uid()))) and (chapter_id is null or exists (select 1 from public.chapters c where c.id = chapter_id and c.user_id = (select auth.uid())));
create policy "Users manage own notes" on public.notes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and (subject_id is null or exists (select 1 from public.subjects s where s.id = subject_id and s.user_id = (select auth.uid()))) and (chapter_id is null or exists (select 1 from public.chapters c where c.id = chapter_id and c.user_id = (select auth.uid())));
create policy "Users manage own revisions" on public.revisions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.chapters c where c.id = chapter_id and c.user_id = (select auth.uid())));
create policy "Users manage own reminders" on public.reminders for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage own preferences" on public.user_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-notes', 'student-notes', false, 20971520, array['application/pdf','text/plain','image/png','image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Students read own note files" on storage.objects for select to authenticated using (bucket_id = 'student-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Students upload own note files" on storage.objects for insert to authenticated with check (bucket_id = 'student-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Students update own note files" on storage.objects for update to authenticated using (bucket_id = 'student-notes' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'student-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Students delete own note files" on storage.objects for delete to authenticated using (bucket_id = 'student-notes' and (storage.foldername(name))[1] = (select auth.uid())::text);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.subjects to authenticated;
grant select, insert, update, delete on public.chapters to authenticated;
grant select, insert, update, delete on public.study_tasks to authenticated;
grant select, insert, update, delete on public.exams to authenticated;
grant select, insert, update, delete on public.study_sessions to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.revisions to authenticated;
grant select, insert, update, delete on public.reminders to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
