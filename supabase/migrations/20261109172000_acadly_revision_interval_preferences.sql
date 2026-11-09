-- Student-adjustable deterministic spaced-revision intervals (in days).
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS revision_intervals_days integer[] NOT NULL DEFAULT ARRAY[1,3,7,14,30];

ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_revision_intervals_check
  CHECK (
    cardinality(revision_intervals_days) BETWEEN 1 AND 12
    AND array_position(revision_intervals_days, NULL) IS NULL
    AND 0 < ALL (revision_intervals_days)
    AND 365 >= ALL (revision_intervals_days)
    AND revision_intervals_days = ARRAY(
      SELECT value
      FROM unnest(revision_intervals_days) WITH ORDINALITY AS item(value, position)
      ORDER BY position
    )
    AND NOT EXISTS (
      SELECT 1
      FROM generate_subscripts(revision_intervals_days, 1) AS i
      WHERE i > 1 AND revision_intervals_days[i] <= revision_intervals_days[i - 1]
    )
  );
