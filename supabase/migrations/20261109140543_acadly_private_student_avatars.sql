-- Private, per-student avatar storage.
-- Avatar URLs are signed and expire; files are not publicly readable.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-avatars',
  'student-avatars',
  false,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Students read own avatar"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'student-avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "Students upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'student-avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "Students update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'student-avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'student-avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "Students delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'student-avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
