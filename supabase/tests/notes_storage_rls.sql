-- Rollback-only Storage object ownership smoke test for student-notes.
-- Run against a local Supabase stack as a privileged database role.
BEGIN;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','notes-a@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','notes-b@example.invalid','',now(),'{"provider":"email","providers":["email"]}','{}',now(),now())
ON CONFLICT (id) DO NOTHING;

-- Simulate a file object for each student. RLS checks are performed below.
INSERT INTO storage.objects (id, bucket_id, name, owner_id, metadata)
VALUES
  ('71000000-0000-4000-8000-000000000001','student-notes','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/test-a.pdf','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"mimetype":"application/pdf","size":100}'),
  ('72000000-0000-4000-8000-000000000002','student-notes','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/test-b.pdf','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"mimetype":"application/pdf","size":100}')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM storage.objects
  WHERE bucket_id='student-notes' AND name='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/test-b.pdf';
  IF n <> 0 THEN RAISE EXCEPTION 'Student A can list/read Student B object'; END IF;

  UPDATE storage.objects SET name='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/hacked.pdf'
  WHERE bucket_id='student-notes' AND name='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/test-b.pdf';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Student A updated Student B object'; END IF;

  DELETE FROM storage.objects
  WHERE bucket_id='student-notes' AND name='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/test-b.pdf';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'Student A deleted Student B object'; END IF;

  INSERT INTO storage.objects (bucket_id,name,owner_id,metadata)
  VALUES ('student-notes','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/spoof.pdf',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"mimetype":"application/pdf","size":100}');
  RAISE EXCEPTION 'Student A uploaded into Student B folder';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

SET LOCAL request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM storage.objects
  WHERE bucket_id='student-notes' AND name='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/test-b.pdf';
  IF n <> 1 THEN RAISE EXCEPTION 'Student B cannot read own object'; END IF;
END $$;

SELECT 'PASS: storage object RLS isolates each student folder.' AS result;
ROLLBACK;
