# Acadly — Product Requirements Document

**Document status:** v1.0 — approved MVP baseline  
**Last updated:** 2026-11-09  
**Product category:** Student study-management and productivity web application

> **Brand note:** "Acadly" is the current working project name. Before a public product launch, the maintainers must complete trademark and domain clearance and confirm that the name can be used in the intended markets. Keep brand strings and visual assets easy to change.

## 1. Product vision

Acadly is a responsive workspace that helps students organize academic workload, focus during study sessions, manage learning resources, prepare for exams, and understand progress.

Core workflows use conventional application logic and explicit user input. The MVP does not depend on generative-AI services.

### Product promise

**All student-facing product features are free for every student.**

Acadly will not introduce:
- Premium or paid student subscriptions.
- Feature paywalls or paid-only modules.
- Paid AI API dependencies for core product functionality.
- Paid upgrades required to access notes, PDFs, planning, focus tools, or analytics.

Acadly may rely on third-party hosting, authentication, database, email, and object-storage providers. Their free plans have limits and can change. "Free for every student" does not mean unlimited infrastructure or unlimited file storage.

## 2. Target users and needs

Primary users include college and university students, diploma and undergraduate students, and students preparing for internal, semester, and competitive examinations.

Users need to:
1. Organize subjects and chapters.
2. Plan study tasks across days and weeks.
3. Track exams and deadlines.
4. Focus using a dependable study timer.
5. Keep notes and PDF resources organized.
6. Record completed revisions.
7. Understand study habits and progress.
8. Use the same account across desktop and mobile.

## 3. Product principles

- **Free access:** no paid student tier or feature gates.
- **Privacy by default:** student records and uploaded files are private unless a future sharing feature is explicitly designed and opted into.
- **No AI dependency:** core modules work without external AI APIs.
- **Data ownership:** users can access their own records and request account/data deletion.
- **Honest limits:** show storage and service constraints; never claim unlimited capacity.
- **Accessible and responsive:** essential workflows work with keyboard, touch, and common screen sizes.
- **Useful accuracy:** timers, dates, and analytics use persisted data and documented rules.

## 4. Scope and release plan

### 4.1 MVP — required for first public beta

| Module | MVP capabilities |
|---|---|
| Accounts | Sign up, verify email, sign in, sign out, password recovery, profile basics |
| Dashboard | Summaries of subjects, tasks, focus time, upcoming exams, and revisions due |
| Subjects and chapters | Create, edit, archive/delete subjects; manage chapters and completion status |
| Study planner | Create, edit, complete, reschedule, delete tasks; day/week views |
| Pomodoro | Configurable focus/break durations; start, pause, resume, reset; persist completed sessions |
| Exam tracker | Create/edit/delete exams; dates, subject association, upcoming list/countdown |
| Notes and PDF manager | Private upload, list, preview where supported, download, rename, organize, search, replace, delete; show storage use and limits |
| Revision tracker | Record revisions, show history, due/overdue items |
| Analytics | Study time, completed tasks, subject/chapter progress, date-range summaries |
| Streaks | Consecutive study-day count using a published activity rule |
| Reminders | In-app reminders for tasks, exams, and revisions; browser notifications only with permission |

Every MVP module must be available without payment or feature gates.

### 4.2 Post-MVP

- Optional sharing of selected notes/resources.
- Calendar export/import and integrations.
- Advanced recurring study plans.
- More configurable revision scheduling.
- Installable PWA and offline-first capabilities.
- Richer analytics, data export, localization.
- Collaborative study groups after privacy and moderation design.

Post-MVP items must not be used to withhold an MVP feature.

## 5. Functional requirements and acceptance criteria

### 5.1 Accounts and authentication
- Users can register through a supported email authentication flow.
- Email verification and password recovery work in configured environments.
- Protected routes reject unauthenticated users.
- Sign-out makes private pages inaccessible.
- The server derives identity from a verified session/token and never trusts a client-supplied user ID as proof of ownership.
- Account deletion and data export procedures are documented before broad public launch.

**Acceptance:** signup, verification, login, session refresh, password recovery, and logout can be demonstrated; unauthorized requests are rejected.

### 5.2 Dashboard
- Show summaries derived from persisted data.
- Include upcoming exams, tasks due, revisions due, recent sessions, and subject progress.
- Provide loading, empty, and error states.
- Never show hard-coded sample metrics as real user data.

**Acceptance:** dashboard values reconcile with underlying records and update after relevant actions.

### 5.3 Subjects and chapters
- Users can create, edit, archive, and delete subjects.
- Users can add, edit, reorder, and delete chapters.
- Chapter status is not started, in progress, or completed.
- Parent deletion/archive behavior for child records is explicit and safe.

**Acceptance:** CRUD, validation, ownership checks, and progress summaries work for two separate test accounts without cross-account access.

### 5.4 Study planner and timetable
- Tasks include title, date, optional start/end time, subject/chapter, priority, and status.
- Users can complete, reschedule, edit, or delete tasks.
- Day/week views use the user's configured timezone.
- Overlapping tasks are visible and never silently overwrite one another.

**Acceptance:** tasks persist after refresh, display at the correct local time, and can be rescheduled on desktop and mobile.

### 5.5 Pomodoro and study sessions
- Configurable focus, short-break, and long-break durations.
- Start, pause, resume, and reset controls.
- Completed focus sessions are recorded once with timestamps and duration.
- Optional subject association.
- Refresh does not silently create duplicate or falsely completed sessions.

**Acceptance:** timer transitions are correct; repeated completion actions do not create duplicate records; history persists.

### 5.6 Exams
- Exam records contain title, subject, optional type, date/time, and optional notes.
- Upcoming exams are ordered by date; past exams are distinguished.
- Countdown calculations use the configured timezone and handle date boundaries.

**Acceptance:** create/edit/delete and countdown behavior pass date-boundary tests.

### 5.7 Notes and PDF manager
- Every registered student can use notes/PDF management without paying.
- Users can upload, list, preview where supported, download, rename, search, organize, replace, and delete files.
- Files can be associated with subjects/chapters.
- File type and size are validated; upload progress and actionable errors are shown.
- Private files are stored outside API-server ephemeral local storage.
- Metadata and storage objects are both removed safely.
- Storage usage and applicable quota are visible.
- Files are private by default; sharing is out of MVP scope.

**Acceptance:** users manage their own PDFs end-to-end; another account cannot list, preview, download, replace, or delete those files. Quotas and restrictions are disclosed.

### 5.8 Revision tracker
- Users can mark chapters for revision and record completed revisions.
- Show last revision and next suggested/due revision.
- Interval suggestions use deterministic, documented rules and can be changed by the user.
- Users can reschedule revisions.

**Acceptance:** history persists and due/overdue status is reproducible from stored dates and rules.

### 5.9 Reminders
- In-app reminders can be generated for tasks, exams, and revisions.
- Users can mark reminders read/dismissed and configure preferences/quiet hours.
- Browser notifications require explicit permission.
- State clearly whether reminders require the app to be open. Do not promise reliable background delivery without verified push infrastructure.

**Acceptance:** reminders avoid duplicates, respect preferences, and handle timezone boundaries.

### 5.10 Analytics and streaks
- Analytics use persisted sessions, tasks, and chapter states.
- Show daily/weekly focus time, completed tasks, and subject/chapter progress.
- Charts include labels, empty states, and accessible text equivalents.
- Streak definition is visible and consistent; study-day timezone is the user's configured timezone.

**Acceptance:** analytics reconcile with raw records and do not double-count sessions or tasks.

## 6. Platform, browsers, and responsive behavior

### Form factors
- Desktop/laptop: primary layout target.
- Tablet: adaptive navigation/content.
- Mobile phone: core workflows supported, including tasks, timer, exams, and notes/PDF access.

### Browser support
Target the latest stable and previous major release where practical:
- Google Chrome and Chromium-based browsers.
- Microsoft Edge.
- Mozilla Firefox.
- Apple Safari on macOS and iOS.

If inline PDF preview is unsupported, provide an obvious download/open fallback. Preview is not required to access the file.

### Accessibility baseline
- Semantic headings and landmarks.
- Keyboard-operable navigation, dialogs, and forms.
- Visible focus indicators.
- Labels and understandable validation messages.
- Sufficient contrast and reduced-motion support.
- Charts provide text summaries and do not rely on color alone.

## 7. Technical direction

Initial architecture:
- **Frontend:** React + Vite.
- **Backend:** Python + FastAPI for server-side operations that need it.
- **Authentication:** Supabase Auth.
- **Database:** Supabase PostgreSQL.
- **File storage:** private Supabase Storage bucket with per-user authorization.
- **Source control:** GitHub.
- **Hosting:** select providers based on current free-plan availability, terms, limits, and fit.

### Security requirements
- Enable Row Level Security (RLS) on every user-owned table.
- Enforce ownership for every API and storage operation.
- Never expose Supabase service-role keys, private API secrets, or signing secrets in the browser bundle or Git.
- Use short-lived signed URLs for private file retrieval where appropriate.
- Restrict CORS to known application origins.
- Validate uploads by size and content type; do not rely only on file extensions.
- Apply suitable rate limits/anti-abuse controls to public auth and upload endpoints.
- Document dependency versions and secrets handling.

## 8. Free access, quotas, and sustainability

### What free means
Every registered student receives access to every student-facing MVP module. There are no subscriptions, paid feature levels, premium-only limits, or AI API costs required for core functionality.

### What free does not mean
Third-party providers do not promise unlimited free compute, database, bandwidth, email, or object storage. Free plans may include storage/bandwidth/request limits, inactivity pauses, email limits, or policy/pricing changes.

### Quota policy
- Publish current per-user upload/file limits and shared service limits in the app/help page.
- Display each user's storage use and remaining personal allowance.
- Do not silently delete student files because a shared provider quota is approached.
- Show clear notices and safe behavior when capacity is unavailable.
- Monitor aggregate usage and provider alerts.
- Reassess infrastructure before approaching provider limits.
- Never claim unlimited storage or guaranteed uptime on a free tier.
- Do not sell student data or use it for advertising.

### Sustainability options
If usage exceeds free capacity, evaluate efficient storage, user-controlled retention, grants/credits, donations, or sponsorships first. Changes affecting the free-access promise must be publicly documented and must not introduce undisclosed student charges.

## 9. Privacy and data handling

- Student records are private and isolated by authenticated user ID.
- Uploaded files are private by default; do not use public URLs for private resources.
- Collect only data needed to operate the service.
- Explain third-party processors and data locations in a privacy notice.
- Provide account deletion and data export procedures.
- Define backups, retention, and deletion semantics before public launch.
- Obtain appropriate legal review of terms/privacy notices for launch jurisdictions.

## 10. Public beta release checklist

- [ ] Student can register, verify email, log in, reset password, and log out.
- [ ] Two accounts cannot access one another's records or files.
- [ ] All MVP modules are available without payment or feature gates.
- [ ] Dashboard values come from real stored data.
- [ ] Subjects, chapters, tasks, sessions, exams persist across sessions.
- [ ] Timer and date/time behavior pass boundary tests.
- [ ] PDFs can be uploaded, previewed where supported, downloaded, organized, replaced, and deleted.
- [ ] Private file access is protected by storage policies and tested with two accounts.
- [ ] Storage limits and third-party free-tier constraints are disclosed.
- [ ] Desktop and mobile critical flows pass responsive checks.
- [ ] Automated tests and production builds pass in CI.
- [ ] Secrets are absent from Git history and frontend bundles.
- [ ] Privacy notice, terms, support/contact route, and account deletion process are available.
- [ ] Public brand/name clearance has been reviewed before marketing launch.

## 11. Out of scope for MVP

- AI-generated notes, answers, or study schedules.
- Paid subscriptions or paid feature unlocks.
- Public-by-default notes or files.
- Social feeds or public student profiles.
- Guaranteed push notifications before push infrastructure exists.
- Offline synchronization before conflict-resolution behavior is designed.

## 12. Decision log

| Decision | Current choice | Rationale |
|---|---|---|
| Student pricing | Free for every student | Core product promise |
| AI dependency | None for MVP | Avoid paid API dependency; deterministic workflows |
| Frontend | React + Vite | Component-based web stack |
| Backend | FastAPI | Python API and validation layer |
| Auth/database/storage | Supabase | Integrated managed services; subject to free-plan limits |
| Private content | Private by default | Student privacy |
| File storage | Object storage, not API local disk | Files must survive API redeploys |
| Brand | Acadly (working name) | Reassess after trademark/domain clearance |

## 13. Change control

Changes to pricing promise, privacy, supported MVP features, file quotas, or hosting assumptions must be documented here and reviewed before implementation. GitHub issues should link to relevant requirements and use these acceptance criteria for completion checks.
