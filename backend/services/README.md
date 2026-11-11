# Service layer rules
HTTP handlers live under api/v1/routes and only handle HTTP concerns.
Business logic belongs in services/; database query mechanics belong in repositories/.
Pass the validated student UUID explicitly into every service. Never accept a caller-supplied
owner UUID as authority.

Ordinary student-owned CRUD should continue to use Supabase with the student's access token;
PostgreSQL RLS is the source of truth for row ownership. Use FastAPI for privileged server-side
operations, external integrations, or multi-step workflows. Any privileged query must filter
every read/write by the validated UUID and validate referenced resources. Service-role credentials
bypass RLS and are not an authorization mechanism.
