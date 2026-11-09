-- Rollback-only smoke test for profile, preferences, and private avatar isolation.
-- Run against a LOCAL Supabase database as a privileged database user:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/profile_settings_security.sql
--
-- The fixture creates synthetic Auth users so the real signup trigger is tested.
-- Every row is rolled back; never remove BEGIN/ROLLBACK for this test.

BEGIN;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','acadly-profile-probe-a@invalid.example','',now(),'{}','{"display_name":"Student A"}',now(),now()),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','acadly-profile-probe-b@invalid.example','',now(),'{}','{"display_name":"Student B"}',now(),now());

-- The storage table derives path_tokens. This synthetic row bypasses Storage
-- triggers only for fixture creation; access checks run with normal RLS below.
SET LOCAL session_replication_role = replica;
INSERT INTO storage.objects (bucket_id,name,owner,owner_id,metadata)
VALUES ('student-avatars',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/avatar-probe.png',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        '{"mimetype":"image/png","size":16}'::jsonb);
SET LOCAL session_replication_role = origin;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF n <> 0 THEN RAISE EXCEPTION 'Student A could read Student B profile'; END IF;

  SELECT count(*) INTO n FROM public.user_preferences WHERE user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF n <> 0 THEN RAISE EXCEPTION 'Student A could read Student B preferences'; END IF;

  SELECT count(*) INTO n FROM storage.objects
    WHERE bucket_id='student-avatars'
      AND name='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/avatar-probe.png';
  IF n <> 0 THEN RAISE EXCEPTION 'Student A could read Student B avatar object'; END IF;

  UPDATE public.profiles SET display_name='Hacked'
    WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Student A changed Student B profile'; END IF;

  UPDATE public.user_preferences SET focus_minutes=90
    WHERE user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Student A changed Student B preferences'; END IF;
END $$;

SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF n <> 1 THEN RAISE EXCEPTION 'Student B cannot read own profile'; END IF;

  SELECT count(*) INTO n FROM public.user_preferences WHERE user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF n <> 1 THEN RAISE EXCEPTION 'Student B cannot read own preferences'; END IF;

  SELECT count(*) INTO n FROM storage.objects
    WHERE bucket_id='student-avatars'
      AND name='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/avatar-probe.png';
  IF n <> 1 THEN RAISE EXCEPTION 'Student B cannot read own avatar'; END IF;

  UPDATE public.profiles
    SET display_name='Student B Updated', timezone='Asia/Kolkata', week_starts_on=0
    WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Student B cannot update own profile'; END IF;

  UPDATE public.user_preferences SET focus_minutes=30
    WHERE user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Student B cannot update own preferences'; END IF;
END $$;

SELECT 'PASS: signup created profile/preferences; cross-student profile, preference, and avatar access was blocked; owner updates succeeded.' AS result;
ROLLBACK;
