# Acadly security and data isolation

## Student identity

- The frontend uses only the Supabase publishable key and the signed-in student's access token.
- Protected FastAPI routes require \`Authorization: Bearer <access-token>\`.
- FastAPI validates the token with the project's Supabase Auth \`/auth/v1/user\` endpoint. It does not trust decoded, unsigned JWT claims, request-body user IDs, email addresses, or editable \`user_metadata\`.
- The canonical student ID comes from the validated Auth response.
- The backend does not need a service-role or secret API key for ordinary student operations. Never put a Supabase secret/service-role key in Vite variables, frontend files, source control, or client-visible configuration.

## PostgreSQL

All ten tables in the exposed \`public\` schema have RLS enabled:

- profiles
- subjects
- chapters
- study_tasks
- exams
- study_sessions
- notes
- revisions
- reminders
- user_preferences

Authenticated row policies bind reads and writes to \`(select auth.uid())\`. UPDATE policies include both \`USING\` and \`WITH CHECK\`, and child records validate ownership of referenced subjects/chapters. Anonymous table privileges are revoked. Profiles are readable/updatable by their owner; profile creation is handled by the Auth signup trigger, not direct client INSERT.

The private \`student-notes\` Storage bucket uses the first object path segment as the student UUID and applies ownership policies to select, insert, update, and delete.

## CORS

Set \`CORS_ORIGINS\` on the API host to a comma-separated list of exact frontend origins, for example:

\`\`\`text
CORS_ORIGINS=https://acadly.example,https://www.acadly.example
\`\`\`

Wildcard origins are rejected. Keep local development origins only in local/development configuration.

## Verification

Normal backend CI runs the JWT-verification unit tests and API tests. To run the live two-student RLS integration tests against a dedicated non-production Supabase project, set:

- \`ACADLY_RLS_SUPABASE_URL\`
- \`ACADLY_RLS_PUBLISHABLE_KEY\`
- \`ACADLY_RLS_STUDENT_A_TOKEN\`
- \`ACADLY_RLS_STUDENT_B_TOKEN\`

The two tokens must belong to distinct test accounts. The integration tests create temporary records owned by Student B, verify Student A receives no rows and cannot mutate/delete them, verify Student B cannot transfer ownership, and clean up using Student B's token. Coverage includes subjects, study sessions, exams, reminders, and notes/file metadata. The tests are skipped when credentials are absent; never use production student accounts or data for this suite.

`authenticated` has only SELECT/INSERT/UPDATE/DELETE on student-owned records; profiles are SELECT/UPDATE only. Non-DML privileges such as TRUNCATE, TRIGGER, and REFERENCES are revoked from the application role.

## Local SQL RLS smoke test

After starting the local Supabase stack and applying migrations, run this as a privileged local database user:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_student_isolation.sql
```

The script creates synthetic rows inside one transaction, assumes the `authenticated` role with two distinct JWT subject claims, checks isolation for subjects, sessions, exams, reminders, and note metadata, and rolls every fixture back. It requires a privileged local database connection because it temporarily bypasses foreign-key triggers to avoid creating real Auth users.
