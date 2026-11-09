BEGIN;
DO $$
DECLARE
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  rem_id uuid;
BEGIN
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (user_a, 'authenticated', 'authenticated', 'reminder-a-' || user_a || '@acadly.invalid', '', now(), now(), now()),
    (user_b, 'authenticated', 'authenticated', 'reminder-b-' || user_b || '@acadly.invalid', '', now(), now(), now());

  INSERT INTO public.reminders (user_id, title, body, remind_at, source_type, event_key, notification_type)
  VALUES (user_a, 'Test reminder', 'Deduplication fixture', now(), 'task', 'task:fixture:due', 'task')
  RETURNING id INTO rem_id;

  -- Unique key is scoped to the owner. A second insert for the same event must be rejected.
  BEGIN
    INSERT INTO public.reminders (user_id, title, remind_at, source_type, event_key, notification_type)
    VALUES (user_a, 'Duplicate', now(), 'task', 'task:fixture:due', 'task');
    RAISE EXCEPTION 'Expected duplicate owner/event key to fail';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- Another owner may use the same event key without colliding.
  INSERT INTO public.reminders (user_id, title, remind_at, source_type, event_key, notification_type)
  VALUES (user_b, 'Other owner reminder', now(), 'task', 'task:fixture:due', 'task');

  IF (SELECT count(*) FROM public.reminders WHERE event_key = 'task:fixture:due') <> 2 THEN
    RAISE EXCEPTION 'Expected one reminder per owner for the same event key';
  END IF;
END $$;
ROLLBACK;
