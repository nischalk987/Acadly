-- Rollback-only ownership and cascade smoke test for subjects/chapters.
-- Run against a LOCAL Supabase database with elevated test credentials:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/subjects_chapters_rls.sql

BEGIN;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','acadly-subject-a@invalid.example','',now(),'{}','{}',now(),now()),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','acadly-subject-b@invalid.example','',now(),'{}','{}',now(),now());

INSERT INTO public.subjects (id,user_id,name,color,position)
VALUES
('10000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A subject','#7C3AED',0),
('20000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','B subject','#2563EB',0);

INSERT INTO public.chapters (id,user_id,subject_id,title,status,position)
VALUES
('30000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000001','A chapter','not_started',0),
('40000000-0000-4000-8000-000000000004','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','20000000-0000-4000-8000-000000000002','B chapter','in_progress',0);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.subjects WHERE id='20000000-0000-4000-8000-000000000002';
  IF n <> 0 THEN RAISE EXCEPTION 'Student A can read Student B subject'; END IF;

  SELECT count(*) INTO n FROM public.chapters WHERE id='40000000-0000-4000-8000-000000000004';
  IF n <> 0 THEN RAISE EXCEPTION 'Student A can read Student B chapter'; END IF;

  UPDATE public.chapters SET status='completed'
    WHERE id='40000000-0000-4000-8000-000000000004';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Student A can update Student B chapter'; END IF;

  BEGIN
    INSERT INTO public.chapters (user_id,subject_id,title)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            '20000000-0000-4000-8000-000000000002',
            'cross-account chapter');
    RAISE EXCEPTION 'Cross-account chapter insert unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation OR insufficient_privilege THEN NULL;
  END;

  DELETE FROM public.subjects WHERE id='10000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Student A could not delete own subject'; END IF;
END $$;

-- Verify subject deletion cascades its owned chapters.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.chapters
    WHERE id='30000000-0000-4000-8000-000000000003';
  IF n <> 0 THEN RAISE EXCEPTION 'Deleting subject left an orphan chapter'; END IF;
END $$;

SELECT 'PASS: subject/chapter ownership, cross-account isolation, and parent delete cascade verified.' AS result;
ROLLBACK;
