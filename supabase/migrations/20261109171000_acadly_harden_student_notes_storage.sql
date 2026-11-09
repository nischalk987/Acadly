-- Harden private note uploads: enforce ownership path, allowed extensions and
-- a per-student 500 MiB fair-use ceiling for new objects/replacements.
-- Supabase's own project-wide storage quota remains a separate platform limit.

DROP POLICY IF EXISTS "Students upload own note files" ON storage.objects;
DROP POLICY IF EXISTS "Students update own note files" ON storage.objects;

CREATE POLICY "Students upload own note files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-notes'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND storage.filename(name) !~ '(^\.|\.\.)'
  AND storage.extension(name) IN ('pdf','txt','png','jpg','jpeg')
  AND COALESCE((metadata->>'size')::bigint, 0) BETWEEN 1 AND 20971520
  AND (
    SELECT COALESCE(SUM((o.metadata->>'size')::bigint), 0)
    FROM storage.objects o
    WHERE o.bucket_id = 'student-notes'
      AND (storage.foldername(o.name))[1] = (SELECT auth.uid())::text
  ) + COALESCE((metadata->>'size')::bigint, 0) <= 524288000
);

CREATE POLICY "Students update own note files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'student-notes'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'student-notes'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND storage.filename(name) !~ '(^\.|\.\.)'
  AND storage.extension(name) IN ('pdf','txt','png','jpg','jpeg')
  AND COALESCE((metadata->>'size')::bigint, 0) BETWEEN 1 AND 20971520
  AND (
    SELECT COALESCE(SUM((o.metadata->>'size')::bigint), 0)
    FROM storage.objects o
    WHERE o.bucket_id = 'student-notes'
      AND (storage.foldername(o.name))[1] = (SELECT auth.uid())::text
      AND o.id <> storage.objects.id
  ) + COALESCE((metadata->>'size')::bigint, 0) <= 524288000
);
