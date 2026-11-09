-- Two-student RLS smoke test for local/development databases.
-- Run as a privileged database user. Fixtures deliberately bypass FK triggers,
-- are checked through the authenticated role, and are always rolled back.

BEGIN;
SET LOCAL session_replication_role = replica;

INSERT INTO public.subjects (id,user_id,name) VALUES
('10000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','rls-probe-subject');
INSERT INTO public.study_sessions (id,user_id,session_type,started_at,duration_seconds) VALUES
('20000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','focus',now(),60);
INSERT INTO public.exams (id,user_id,title,starts_at) VALUES
('30000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','rls-probe-exam',now());
INSERT INTO public.reminders (id,user_id,title,remind_at) VALUES
('40000000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','rls-probe-reminder',now());
INSERT INTO public.notes (id,user_id,title,file_path,file_name,mime_type,file_size_bytes) VALUES
('50000000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','rls-probe-file-metadata','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/probe.txt','probe.txt','text/plain',12);

SET LOCAL session_replication_role = origin;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.subjects WHERE id='10000000-0000-4000-8000-000000000001';
  IF n <> 0 THEN RAISE EXCEPTION 'Student A could read Student B subject'; END IF;
  SELECT count(*) INTO n FROM public.study_sessions WHERE id='20000000-0000-4000-8000-000000000002';
  IF n <> 0 THEN RAISE EXCEPTION 'Student A could read Student B session'; END IF;
  SELECT count(*) INTO n FROM public.exams WHERE id='30000000-0000-4000-8000-000000000003';
  IF n <> 0 THEN RAISE EXCEPTION 'Student A could read Student B exam'; END IF;
  SELECT count(*) INTO n FROM public.reminders WHERE id='40000000-0000-4000-8000-000000000004';
  IF n <> 0 THEN RAISE EXCEPTION 'Student A could read Student B reminder'; END IF;
  SELECT count(*) INTO n FROM public.notes WHERE id='50000000-0000-4000-8000-000000000005';
  IF n <> 0 THEN RAISE EXCEPTION 'Student A could read Student B notes metadata'; END IF;

  UPDATE public.subjects SET name='hacked' WHERE id='10000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'Student A updated Student B subject'; END IF;
  UPDATE public.study_sessions SET duration_seconds=999 WHERE id='20000000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'Student A updated Student B session'; END IF;
  UPDATE public.exams SET title='hacked' WHERE id='30000000-0000-4000-8000-000000000003';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'Student A updated Student B exam'; END IF;
  UPDATE public.reminders SET title='hacked' WHERE id='40000000-0000-4000-8000-000000000004';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'Student A updated Student B reminder'; END IF;
  UPDATE public.notes SET title='hacked' WHERE id='50000000-0000-4000-8000-000000000005';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'Student A updated Student B notes metadata'; END IF;

  DELETE FROM public.subjects WHERE id='10000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'Student A deleted Student B subject'; END IF;
  DELETE FROM public.study_sessions WHERE id='20000000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'Student A deleted Student B session'; END IF;
  DELETE FROM public.exams WHERE id='30000000-0000-4000-8000-000000000003';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'Student A deleted Student B exam'; END IF;
  DELETE FROM public.reminders WHERE id='40000000-0000-4000-8000-000000000004';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'Student A deleted Student B reminder'; END IF;
  DELETE FROM public.notes WHERE id='50000000-0000-4000-8000-000000000005';
  GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'Student A deleted Student B notes metadata'; END IF;
END $$;

SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.subjects WHERE id='10000000-0000-4000-8000-000000000001';
  IF n <> 1 THEN RAISE EXCEPTION 'Student B lost subject or cannot read own row'; END IF;
  SELECT count(*) INTO n FROM public.study_sessions WHERE id='20000000-0000-4000-8000-000000000002';
  IF n <> 1 THEN RAISE EXCEPTION 'Student B lost session or cannot read own row'; END IF;
  SELECT count(*) INTO n FROM public.exams WHERE id='30000000-0000-4000-8000-000000000003';
  IF n <> 1 THEN RAISE EXCEPTION 'Student B lost exam or cannot read own row'; END IF;
  SELECT count(*) INTO n FROM public.reminders WHERE id='40000000-0000-4000-8000-000000000004';
  IF n <> 1 THEN RAISE EXCEPTION 'Student B lost reminder or cannot read own row'; END IF;
  SELECT count(*) INTO n FROM public.notes WHERE id='50000000-0000-4000-8000-000000000005';
  IF n <> 1 THEN RAISE EXCEPTION 'Student B lost notes metadata or cannot read own row'; END IF;

  BEGIN
    INSERT INTO public.subjects (id,user_id,name) VALUES
    ('60000000-0000-4000-8000-000000000006','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','spoofed-owner');
    RAISE EXCEPTION 'Student B inserted a subject for Student A';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.subjects SET user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    WHERE id='10000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'Student B transferred subject ownership to Student A';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT 'PASS: Student A could not read, update, or delete Student B records; owner rows stayed intact.' AS result;
ROLLBACK;
