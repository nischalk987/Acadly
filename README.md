# Acadly

A free study-management platform for students — plan study work, focus, prepare for exams, organize notes, and track progress.

> **Working name:** Acadly is the current project name. Complete trademark and domain clearance before public marketing or launch.

## Product promise

All student-facing features are free for every student. No premium subscriptions, no feature paywalls, and no paid AI API dependency for core workflows.

Free infrastructure is not unlimited. Database, file storage, bandwidth, email delivery, and hosting providers have quotas and operational limits. Acadly will disclose those limits transparently and keep student data and uploaded files private by default.

## Core modules

- Dashboard and study analytics
- Subjects and chapters
- Study planner and timetable
- Pomodoro focus timer and study sessions
- Exam tracker
- Notes and private PDF manager
- Revision tracker
- Daily in-app reminders
- Study streaks

## Product documentation

Read [docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md) for the product vision, MVP scope, module acceptance criteria, security/privacy requirements, supported browsers, free-access policy, and release checklist.

## Technology

- Frontend: React 18 + Vite 6
- Backend: Python + FastAPI
- Authentication, database, and private file storage: Supabase Auth, PostgreSQL and Storage
- Source control: Git and GitHub

## Repository structure

```text
Acadly/
├── docs/PRODUCT_REQUIREMENTS.md
├── supabase/
│   ├── migrations/
│   │   ├── 20261109125128_acadly_initial_schema.sql
│   │   └── 20261109125409_acadly_security_and_index_fixes.sql
│   ├── config.toml
│   ├── seed.sql
│   └── README.md
├── frontend/
│   ├── src/{App.jsx,main.jsx,styles.css}
│   ├── src/components/auth/AuthScreen.jsx
│   ├── src/lib/supabase.js
│   ├── src/components/auth/AuthScreen.jsx
│   ├── src/lib/supabase.js
│   ├── .env.example
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
├── backend/
│   ├── tests/test_health.py
│   ├── .env.example
│   ├── main.py
│   ├── pyproject.toml
│   └── requirements.txt
├── .github/workflows/backend-ci.yml
├── .editorconfig
├── .gitignore
└── LICENSE
```

## Prerequisites

Install Git, Node.js 20 LTS or a newer compatible LTS with npm, Python 3.11+, PowerShell, Docker Desktop, and the Supabase CLI.

Check versions:

```powershell
git --version
node --version
npm --version
py --version
supabase --version
docker --version
```

## Local setup — Windows PowerShell

### 1. Clone the repository

```powershell
git clone https://github.com/nischalk987/Acadly.git
cd Acadly
```

### 2. Start local Supabase (optional for frontend-only work)

```powershell
supabase start
supabase db reset
supabase status
```

The local stack runs in Docker. Migrations are applied in timestamp order and the local-only demo seed runs afterward. Read [supabase/README.md](supabase/README.md) before linking or pushing changes to a hosted project.

### 3. Start the frontend

In a PowerShell terminal:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open the URL printed by Vite, normally http://127.0.0.1:5173.

### 4. Start the backend

Open a second PowerShell terminal from the repository root:

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell blocks virtual-environment activation, run this in that terminal and retry:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

API: http://127.0.0.1:8000  
Interactive API docs: http://127.0.0.1:8000/docs  
Health check: http://127.0.0.1:8000/api/health

### 5. Run backend tests and lint

From `backend/` with its virtual environment active:

```powershell
pytest
ruff check .
```

### 6. Build and lint the frontend

From `frontend/`:

```powershell
npm run lint
npm run build
```

## Supabase migration workflow

Schema changes belong in `supabase/migrations/`. Create each new migration with the Supabase CLI:

```powershell
supabase migration new describe_your_change
supabase db reset
supabase db push --dry-run
supabase db push
```

Only run `db push` after reviewing the diff and confirming the linked project is the intended development/staging project. Never run `supabase db reset --linked` on a project containing student data. Never send seed data to a hosted project.

See [supabase/README.md](supabase/README.md) for project linking, deletion behavior, and retention notes.

## Environment variables and secrets

- Copy each `.env.example` to `.env` in its app directory.
- Never commit real `.env` files, credentials, Supabase service-role keys, JWT signing secrets, private keys, student records, or uploaded PDFs.
- `VITE_*` variables are bundled into browser code and must never contain secrets.
- Use the Supabase publishable key in browser clients with RLS enabled. Keep service-role/secret keys server-side only.

## Development conventions

- Keep frontend application code in `frontend/src/`.
- Keep backend routes, schemas, and service logic in separate modules as introduced.
- Use descriptive filenames and lowercase `snake_case` for Python modules.
- Use PascalCase for React component names and `.jsx` component files.
- Keep API routes under `/api`.
- Add/update tests when changing backend behavior.
- Run frontend lint/build and backend tests/lint before committing.
- Do not commit generated files, databases, virtual environments, `node_modules`, build output, or user uploads.

## Authentication setup

The frontend uses Supabase Auth for student signup, email verification, password login, persistent sessions, password recovery, password updates, and logout. Supabase JS handles browser session persistence and token refresh. Authenticated database access is scoped by the user's access token and the existing row-level security rules.

1. In `frontend/`, copy `.env.example` to `.env`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project API URL and publishable (or legacy anon) key. These are public browser credentials; never use a service-role/secret key here.
3. In Supabase Dashboard → Authentication → URL Configuration, set the site URL and add exact local, preview, and production callback URLs. Local callback: `http://127.0.0.1:5173/auth/callback`.
4. Enable email confirmation and minimum password length 8. Configure custom SMTP and hosted CAPTCHA/rate limits before broad signup. Review `supabase/README.md` for operational limits.
5. Restart Vite after changing environment variables.

Passwords are sent only to Supabase Auth over HTTPS. The frontend does not contain a privileged key or service-role auth endpoint.

## Development status

The repository includes the app shell, starter API, Supabase database baseline and migration workflow, and Supabase Auth UI/session integration. Feature-specific CRUD screens and live PDF upload UX remain future work.

## Contributing

1. Read the product requirements.
2. Pick an open GitHub issue and discuss significant design changes before implementation.
3. Keep changes scoped and include tests where appropriate.
4. Preserve private-by-default student data and per-user authorization requirements.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).


## Backend security

Protected API routes validate Supabase access tokens with Supabase Auth. Configure `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the backend environment, and set `CORS_ORIGINS` to exact trusted frontend origins. Do not configure service-role/secret keys in the frontend. See [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) for the ownership model and live two-student RLS integration test setup.
