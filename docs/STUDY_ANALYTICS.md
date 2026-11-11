# Study analytics

## Source records

Analytics are derived from the authenticated user's persisted Supabase records:

- `study_sessions`: completed `focus` sessions with a positive `duration_seconds` and a `started_at` timestamp.
- `study_tasks`: tasks whose status is `completed` and which have a non-null `completed_at` timestamp.
- `subjects` and `chapters`: chapter completion counts and per-subject progress.

Break sessions, active/incomplete focus timers, cancelled tasks, and tasks without a completion timestamp are excluded. Each database row is counted once. Focus-session duration is never added to task duration or planned task time.

## Study day and streak rules

A study day is a profile-local calendar date containing at least one completed focus session with positive recorded duration. A session is assigned to the date on which it started, after converting `started_at` into the profile timezone.

The current streak counts consecutive study days ending today. If the user has not completed a focus session today, the streak remains active through yesterday; a gap before yesterday makes it zero. The best streak on the dashboard is computed over the selected date range.

## Timezone and date ranges

The profile's `profiles.timezone` (IANA timezone, default `Asia/Kolkata`) is the analytics calendar. Date filter boundaries are converted from local midnight to UTC instants before database queries, and timestamps are grouped using the same IANA timezone in the browser. This handles UTC offsets and daylight-saving changes without assuming a fixed offset.

Available date ranges are the last 7, 30, or 90 local calendar dates including today, plus an inclusive custom date range. Queries include the first local midnight and exclude the midnight after the final date.

## Reconciliation

- Total focus time equals the sum of `duration_seconds` for the included completed focus-session rows.
- Focus session count equals the number of those same session rows.
- Completed tasks equal the number of completed task rows with `completed_at` in the range.
- Study days count unique local dates with positive focus time.
- Subject progress is the ratio of completed chapters to all chapters attached to that subject.

The task and session datasets are independent metrics. No task estimate or planned time is added to focus time.
