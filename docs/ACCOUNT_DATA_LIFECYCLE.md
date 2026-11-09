# Acadly account, profile, and data lifecycle

## Student profile

A signup trigger creates the \`profiles\` and \`user_preferences\` rows for each new Auth user. The profile row is keyed by the Auth UUID. Profile reads and updates use that UUID and are protected by RLS.

The Settings page stores:
- Display name in \`public.profiles.display_name\`
- Time zone in \`public.profiles.timezone\`
- Preferred week start (0 Sunday through 6 Saturday) in \`public.profiles.week_starts_on\`
- Private avatar object path in \`public.profiles.avatar_path\`

The sign-in email remains managed by Supabase Auth. Changing it should use Supabase's email-change and verification flow, not a direct profile update.

## Private avatar storage

Avatars are stored in the private \`student-avatars\` bucket. Uploads are restricted to PNG, JPEG, and WebP, up to 2 MiB. Object names must start with the student's Auth UUID. Storage RLS grants each authenticated student access only to their own folder. The frontend stores the private object path on the profile and generates a one-hour signed URL for display; it does not make the bucket public.

## Data export

The Settings page exports a JSON file containing the account identity fields available in the current session, profile, preferences, and all application rows for the signed-in student across subjects, chapters, tasks, exams, study sessions, notes, revisions, and reminders. Reads are made using the student's session, so normal RLS policies apply. The export includes note metadata and private object paths; binary attachments are not embedded in the JSON file and must be downloaded separately from the student's private library.

The user should store the downloaded export securely because it contains personal study information.

## Account deletion policy and flow

Self-service account deletion is intentionally not enabled yet. Deleting an Auth account requires a trusted server-side operation; a browser must never receive the Supabase service-role/secret key.

The production flow must:
1. Require a fresh authenticated session (and re-authentication where appropriate).
2. Explain that the action is permanent, show what profile/study data will be removed, and require an explicit typed confirmation.
3. Enumerate and delete that user's objects from both \`student-avatars\` and \`student-notes\` using a trusted server-side operation.
4. Delete the Supabase Auth user only after Storage cleanup succeeds. The Auth foreign keys then cascade through the user's profile, preferences, subjects, chapters, tasks, exams, sessions, notes metadata, revisions, and reminders.
5. Return a clear completion result and invalidate/sign out remaining sessions as appropriate.

If object deletion fails, the workflow must stop before deleting the Auth user and surface a recoverable error for an administrator. It must not leave orphaned private files silently.

Provider backups and retention follow the configured Supabase plan and project settings. Deleting application rows and Storage objects is not a claim that all provider backups are erased immediately. The retention/backup policy must be published before public launch.

Until that trusted deletion endpoint and retention notice exist, the UI explains the policy and disables the destructive action. Students can contact the Acadly administrator to request deletion.
