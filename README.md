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

## Planned technology

- Frontend: React + Vite
- Backend: Python + FastAPI
- Authentication, database, and private file storage: Supabase
- Source control and collaboration: GitHub

Architecture and provider selections may be refined as implementation begins. Re-check current provider terms and free-tier limits before deployment.

## Development status

Acadly is at the product-definition stage. Application modules have not yet been implemented.

## Contributing

1. Read the product requirements.
2. Pick an open GitHub issue and discuss significant design changes before implementation.
3. Keep changes scoped and include tests where appropriate.
4. Never commit credentials, environment files, student data, uploaded PDFs, database files, or build artifacts.
5. Keep privacy and per-user authorization requirements intact.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
