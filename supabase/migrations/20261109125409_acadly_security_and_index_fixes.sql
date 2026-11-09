-- Preserve ownership when a referenced chapter is deleted.
-- Add indexes for foreign keys not already covered by leading index columns.

create index if not exists chapters_subject_id_idx on public.chapters(subject_id);
create index if not exists study_tasks_subject_id_idx on public.study_tasks(subject_id);
create index if not exists study_tasks_chapter_owner_idx on public.study_tasks(chapter_id, user_id);
create index if not exists exams_subject_id_idx on public.exams(subject_id);
create index if not exists study_sessions_subject_id_idx on public.study_sessions(subject_id);
create index if not exists study_sessions_chapter_owner_idx on public.study_sessions(chapter_id, user_id);
create index if not exists notes_subject_id_idx on public.notes(subject_id);
create index if not exists notes_chapter_owner_idx on public.notes(chapter_id, user_id);
create index if not exists revisions_chapter_owner_idx on public.revisions(chapter_id, user_id);

alter table public.study_tasks
  add constraint study_tasks_chapter_owner_fk
  foreign key (chapter_id, user_id)
  references public.chapters(id, user_id)
  on delete set null (chapter_id);

alter table public.notes
  add constraint notes_chapter_owner_fk
  foreign key (chapter_id, user_id)
  references public.chapters(id, user_id)
  on delete set null (chapter_id);

alter table public.study_sessions
  add constraint study_sessions_chapter_owner_fk
  foreign key (chapter_id, user_id)
  references public.chapters(id, user_id)
  on delete set null (chapter_id);
