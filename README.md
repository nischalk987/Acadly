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
- Authentication, database, and private file storage: planned Supabase integration
- Source control: Git and GitHub

## Repository structure

```text
Acadly/
├── docs/PRODUCT_REQUIREMENTS.md
├── frontend/
│   ├── src/{App.jsx,main.jsx,styles.css}
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
├── LICENSE
└── README.md
```

## Prerequisites

Install Git, Node.js 20 LTS or a newer compatible LTS with npm, Python 3.11+, and PowerShell.

Check versions:

```powershell
git --version
node --version
npm --version
py --version
```

## Local setup — Windows PowerShell

### 1. Clone the repository

```powershell
git clone https://github.com/nischalk987/Acadly.git
cd Acadly
```

### 2. Start the frontend

In a PowerShell terminal:

```powershell
cd frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

Open the URL printed by Vite, normally http://127.0.0.1:5173.

### 3. Start the backend

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

### 4. Run backend tests and lint

From `backend/` with its virtual environment active:

```powershell
pytest
ruff check .
```

### 5. Build and lint the frontend

From `frontend/`:

```powershell
npm run lint
npm run build
```

## Environment variables and secrets

- Copy each `.env.example` to `.env` in its app directory.
- Never commit real `.env` files, credentials, Supabase service-role keys, JWT signing secrets, private keys, student records, or uploaded PDFs.
- `VITE_*` variables are bundled into browser code and must never contain secrets.
- Supabase variables are placeholders; the starter currently runs without a Supabase project.

## Development conventions

- Keep frontend application code in `frontend/src/`.
- Keep backend routes, schemas, and service logic in separate modules as introduced.
- Use descriptive filenames and lowercase `snake_case` for Python modules.
- Use PascalCase for React component names and `.jsx` component files.
- Keep API routes under `/api`.
- Add/update tests when changing backend behavior.
- Run frontend lint/build and backend tests/lint before committing.
- Do not commit generated files, databases, virtual environments, `node_modules`, build output, or user uploads.

## Development status

The repository foundation and starter API/UI are in place. Feature modules, Supabase authentication, database policies, and PDF storage are not implemented yet.

## Contributing

1. Read the product requirements.
2. Pick an open GitHub issue and discuss significant design changes before implementation.
3. Keep changes scoped and include tests where appropriate.
4. Preserve private-by-default student data and per-user authorization requirements.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
