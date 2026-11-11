# Acadly API contracts

## Versioning and OpenAPI
New application endpoints belong under /api/v1. OpenAPI JSON is available at
/api/v1/openapi.json; Swagger UI and ReDoc are at /api/v1/docs and /api/v1/redoc.
The existing /api/health and /api/auth/me paths remain compatibility aliases.

## Response format
Success responses use {"data": ...}. Error responses use
{"error":{"code":"...","message":"...","details":null}}. Validation details expose
field locations and Pydantic messages only, never rejected values, access tokens, or secrets.
Unexpected exceptions are logged server-side and return a generic 500 response.

## Authentication
Protected endpoints require Authorization: Bearer <Supabase access token>.
FastAPI validates it via Supabase Auth /auth/v1/user and uses only the returned canonical
UUID. Missing/invalid credentials return 401; temporary Auth provider failures return 503.
Never trust request-body user_id, email, or editable metadata as an authorization identity.

## Input and request size limits
Use Pydantic request schemas with explicit string lengths, numeric bounds, enum values,
and pagination constraints. MAX_REQUEST_BYTES defaults to 1 MiB (configurable up to 10 MiB).
Enforce body limits at the ingress proxy too, including for chunked requests.

## Health and readiness
GET /api/health is a liveness probe. GET /api/ready returns 200 when required Supabase Auth
configuration exists, otherwise 503. Readiness validates configuration, not remote availability.

## Supabase RLS versus FastAPI
Keep ordinary student-owned CRUD in the frontend using Supabase and the student's access token.
Existing PostgreSQL RLS and Storage policies are authoritative for row/object ownership.
Avoid proxying every CRUD request through FastAPI.

Use FastAPI for server-only secrets, external integrations, orchestration, or validation that
cannot safely run in the browser. For every privileged operation, derive owner identity from
the validated token, filter every query by that UUID, and validate ownership of referenced
subjects/chapters. Service-role keys bypass RLS and must remain server-only.

## Adding routes
Define Pydantic schemas under schemas/, business logic under services/, query mechanics under
repositories/, and thin HTTP handlers under api/v1/routes/. Inject AuthenticatedStudent,
pass its UUID down, and test missing/invalid tokens, malformed inputs, cross-user resource IDs,
success cases, and safe errors. Review generated OpenAPI as part of each API PR.
