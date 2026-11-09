# Supabase database workflow

Acadly uses versioned PostgreSQL migrations. The live project is linked by its ref in your local CLI state; credentials are never committed.

## Prerequisites

- Docker Desktop (or another Docker-compatible runtime)
- Supabase CLI (install using the current official instructions)
- Access to the Acadly Supabase project

## Local development (safe)

From the repository root:

```powershell
supabase --version
supabase start
supabase db reset
supabase status
```

The local stack runs in Docker and applies migrations in timestamp order, followed by `seed.sql`. Demo records use a fixed local-only UUID and are not copied to the hosted project.

## Link to the hosted development project

```powershell
supabase login
supabase link --project-ref pcvkmsbtlszsuvuuvpnq
supabase migration list
```

If prompted, enter the project's database password in the CLI prompt. Do not paste it into a command, commit it, or share it in chat.

The hosted development database already contains the two baseline migrations whose timestamps and names are kept in this repository. For the first local baseline, use the clean local stack commands above. If you want to reproduce the current hosted schema locally, use `supabase db reset` after checking that the migration files are present; it resets only the local Docker database. For future changes, create a new migration locally:

```powershell
supabase migration new add_your_change
supabase db reset
supabase db push --dry-run
supabase db push
```

Review every generated SQL migration before pushing. Do not edit the hosted database directly once the migration workflow is established.

## Important destructive-operation warning

- `supabase db reset` resets the local Docker database only.
- `supabase db reset --linked` deletes data in the linked remote database before rebuilding it. Never run it against a project with student data.
- Do not run `supabase db push --include-seed` against a hosted environment. Seed data is for local/demo development.
- Never commit service-role keys, database passwords, access tokens, student data, or uploaded files.

## Data lifecycle and deletion

- Deleting an Auth user cascades to the user's profile, subjects, chapters, tasks, exams, study sessions, notes metadata, revisions, reminders, and preferences.
- Deleting a subject cascades to its chapters. Tasks, exams, sessions, and notes keep their own records but lose the optional subject reference where configured.
- Deleting a chapter removes its revision history. Optional chapter references on tasks, sessions, and notes are set to null.
- Uploaded files live in the private `student-notes` Storage bucket. The object path is `<auth-user-uuid>/<file-uuid>.<extension>`. Storage RLS limits access to that user's folder.
- Auth-user deletion does not automatically guarantee deletion of every Storage object. An authenticated account-deletion workflow must remove that user's Storage objects before or as part of account removal, then delete the Auth user through a trusted server-side operation.
- Backups and provider retention follow the Supabase plan and project settings; deletion from application tables is not a guarantee that provider backups are instantly erased.


## Supabase Auth configuration

The frontend uses Supabase Auth with the browser-safe publishable key (or legacy anon key). Configure these settings in **Supabase Dashboard → Authentication → URL Configuration** before enabling public signups:

- Site URL: your production frontend origin. For local development, use `http://127.0.0.1:5173`.
- Redirect allow list: exact local, preview, and production callback URLs. Do not use wildcard URLs in production.
- Enable email confirmations and require at least 8 characters for passwords. The local `config.toml` configures confirmation and password length; verify hosted Auth settings separately because local config does not update the hosted project.
- Configure custom SMTP and verify the sender/domain before broad public signup. Supabase's default email service is rate-limited and intended for development/testing, not production-scale delivery.
- Configure provider-specific rate limits and CAPTCHA protection in hosted Auth abuse settings before opening registration publicly.
- Password verification and recovery links return to `/auth/callback`, which must be allow-listed.

Preview deployments must each use an explicitly allow-listed origin. Never set a wildcard redirect URL for production.


## Supabase Auth configuration

The frontend uses Supabase Auth with the browser-safe publishable key (or legacy anon key). Set these in **Supabase Dashboard → Authentication → URL Configuration** before enabling public signups:

- Site URL: your production frontend origin. For local development, use `http://127.0.0.1:5173`.
- Redirect allow list: exact local, preview, and production callback URLs. Do not use wildcard production URLs.
- Enable email confirmations and require at least 8 characters for passwords. Verify hosted Auth settings separately; local `config.toml` does not update the hosted project.
- Configure custom SMTP and verify the sender/domain before broad public signup. Supabase's default email service is rate-limited and intended for development/testing, not production-scale delivery.
- Configure Auth rate limits and CAPTCHA protection in hosted Auth abuse settings before public launch.
- Email verification and password recovery redirects use `/auth/callback`, which must be allowed.

Each preview deployment needs an explicitly allow-listed callback origin.


## Private profile avatars

The `student-avatars` bucket is private. It accepts PNG, JPEG, and WebP images up to 2 MiB. Avatar object paths use `<auth-user-uuid>/<random-file-name>.<extension>`; four Storage RLS policies restrict select/insert/update/delete to the owning student's folder. The browser stores only the private object path in `profiles.avatar_path` and requests a short-lived signed URL for display.

## Account deletion and export

See [docs/ACCOUNT_DATA_LIFECYCLE.md](../docs/ACCOUNT_DATA_LIFECYCLE.md). The Settings export reads user-owned rows through RLS and writes a JSON file locally. Binary note attachments are not embedded. Self-service account deletion remains disabled until a trusted server-side endpoint can remove private avatar and note objects before deleting the Auth user.


## Profile and avatar isolation smoke test

After `supabase start` and `supabase db reset`, run the rollback-only profile smoke test as a privileged local database user:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/profile_settings_security.sql
```

It creates two synthetic Auth users inside a transaction, verifies the signup trigger creates their profile/preferences rows, checks cross-student profile/preferences/avatar visibility and update isolation, and then rolls all fixtures back. The test temporarily bypasses storage triggers only to create a synthetic object row; the access checks run with the normal authenticated role and RLS.


## Subjects and chapters ownership test

After `supabase start` and `supabase db reset`, run the rollback-only ownership/cascade regression script as a privileged local database user:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/subjects_chapters_rls.sql
```

The script creates two synthetic Auth users and subject/chapter fixtures, verifies cross-student reads and updates are blocked, checks that a chapter cannot be attached to another student's subject, checks that deleting a subject cascades its chapters, and rolls all test data back.


## In-app reminders and notification center

The `reminders` table is owner-scoped by RLS. New event-generated reminders use `event_key` plus a unique `(user_id, event_key)` index so repeated foreground syncs cannot create duplicate notifications. `notification_type` distinguishes task, exam, revision, and general reminders. Existing `is_read` and `dismissed_at` fields back the notification center actions.

- `user_preferences.reminders_enabled` controls generated reminders.
- `quiet_hours_start` and `quiet_hours_end` are local wall-clock times evaluated with `profiles.timezone`. Set both or leave both empty.
- Task reminders default to one hour before due time, exam reminders to one day before, and revision reminders at the scheduled date.
- The frontend syncs on sign-in and while the application is visible. Browser notifications are opt-in and require explicit browser permission.
- **Delivery is not guaranteed when the app is closed.** This release does not configure push subscriptions, a service worker push endpoint, or a scheduled server-side dispatcher.
- Verify the schema with `supabase/migrations/20261109174500_acadly_reminder_event_deduplication.sql`.
- The rollback-only unique-key fixture is `supabase/tests/reminder_event_deduplication.sql`. It has been committed but should be run on a local Supabase stack before release.
