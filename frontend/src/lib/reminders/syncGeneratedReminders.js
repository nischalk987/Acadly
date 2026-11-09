import { supabase } from "../../lib/supabase.js";

const MAX_LOOKAHEAD_DAYS = 30;
const DEFAULT_LEAD_MINUTES = { task: 60, exam: 1440, revision: 0 };
function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function isQuietTime(date, timeZone, start, end) {
  if (!start || !end) return false;
  const local = zonedParts(date, timeZone);
  const nowMinutes = Number(local.hour) * 60 + Number(local.minute);
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  if (startMinutes === endMinutes) return true;
  return startMinutes < endMinutes
    ? nowMinutes >= startMinutes && nowMinutes < endMinutes
    : nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function quietHoursEnd(date, timeZone, end) {
  const [hour, minute] = end.split(":").map(Number);
  const parts = zonedParts(date, timeZone);
  let target = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, minute));
  // Resolve the intended wall-clock time using Intl offsets; iterate for DST changes.
  for (let i = 0; i < 3; i += 1) {
    const actual = zonedParts(target, timeZone);
    const represented = Date.UTC(Number(actual.year), Number(actual.month) - 1, Number(actual.day), Number(actual.hour), Number(actual.minute));
    const desired = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, minute);
    target = new Date(target.getTime() + (desired - represented));
  }
  if (target <= date) {
    const tomorrow = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1, hour, minute));
    target = tomorrow;
    for (let i = 0; i < 3; i += 1) {
      const actual = zonedParts(target, timeZone);
      const represented = Date.UTC(Number(actual.year), Number(actual.month) - 1, Number(actual.day), Number(actual.hour), Number(actual.minute));
      const desired = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1, hour, minute);
      target = new Date(target.getTime() + (desired - represented));
    }
  }
  return target;
}

function scheduleRespectingQuietHours(timestamp, prefs, timezone) {
  const date = new Date(timestamp);
  if (isQuietTime(date, timezone, prefs.quiet_hours_start, prefs.quiet_hours_end)) {
    return quietHoursEnd(date, timezone, prefs.quiet_hours_end).toISOString();
  }
  return date.toISOString();
}

function reminderPayload(userId, sourceType, sourceId, eventKey, title, body, remindAt, notificationType) {
  return {
    user_id: userId, source_type: sourceType, source_id: sourceId,
    event_key: eventKey, notification_type: notificationType,
    title, body, remind_at: remindAt, is_read: false,
  };
}

export async function syncGeneratedReminders(userId) {
  if (!supabase || !userId) return { created: 0, skipped: "not-ready" };
  const [prefRes, profileRes, taskRes, examRes, revisionRes] = await Promise.all([
    supabase.from("user_preferences").select("reminders_enabled,quiet_hours_start,quiet_hours_end").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
    supabase.from("study_tasks").select("id,title,due_at,starts_at,status").neq("status", "completed").not("due_at", "is", null),
    supabase.from("exams").select("id,title,exam_type,starts_at,completed_at").is("completed_at", null),
    supabase.from("revisions").select("id,chapter_id,revision_number,scheduled_for,completed_at,skipped_at,chapters(title)").is("completed_at", null).is("skipped_at", null).not("scheduled_for", "is", null),
  ]);
  for (const result of [prefRes, profileRes, taskRes, examRes, revisionRes]) if (result.error) throw result.error;
  const prefs = prefRes.data || {};
  if (prefs.reminders_enabled === false) return { created: 0, skipped: "disabled" };
  let timeZone = profileRes.data?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  try { new Intl.DateTimeFormat("en", { timeZone }).format(new Date()); }
  catch { timeZone = "UTC"; }
  const now = new Date();
  const horizon = new Date(now.getTime() + MAX_LOOKAHEAD_DAYS * 86400000);
  const pending = [];
  for (const task of taskRes.data || []) {
    const timestamp = task.due_at ? new Date(task.due_at) : null;
    if (!timestamp || timestamp <= now || timestamp > horizon) continue;
    const remindAt = new Date(timestamp.getTime() - DEFAULT_LEAD_MINUTES.task * 60000);
    pending.push(reminderPayload(userId, "task", task.id, "task:" + task.id + ":due", "Study task due", task.title + " is due " + timestamp.toLocaleString([], { timeZone }) + ".", scheduleRespectingQuietHours(Math.max(remindAt, now), prefs, timeZone), "task"));
  }
  for (const exam of examRes.data || []) {
    const timestamp = new Date(exam.starts_at);
    if (timestamp <= now || timestamp > horizon) continue;
    const remindAt = new Date(timestamp.getTime() - DEFAULT_LEAD_MINUTES.exam * 60000);
    pending.push(reminderPayload(userId, "exam", exam.id, "exam:" + exam.id + ":24h", "Upcoming exam", exam.title + " is scheduled " + timestamp.toLocaleString([], { timeZone }) + ".", scheduleRespectingQuietHours(Math.max(remindAt, now), prefs, timeZone), "exam"));
  }
  for (const revision of revisionRes.data || []) {
    const timestamp = new Date(revision.scheduled_for);
    if (timestamp > horizon) continue;
    const chapter = Array.isArray(revision.chapters) ? revision.chapters[0] : revision.chapters;
    const dueDateKey = new Intl.DateTimeFormat("en-CA", { timeZone }).format(timestamp);
    const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
    if (dueDateKey < todayKey) continue;
    pending.push(reminderPayload(userId, "revision", revision.id, "revision:" + revision.id + ":due", "Chapter revision due", (chapter?.title || "Your chapter") + " · Revision " + revision.revision_number + " is due " + timestamp.toLocaleString([], { timeZone }) + ".", scheduleRespectingQuietHours(Math.max(timestamp, now), prefs, timeZone), "revision"));
  }
  if (!pending.length) return { created: 0, skipped: "none-due" };
  const { data, error } = await supabase.from("reminders").upsert(pending, { onConflict: "user_id,event_key", ignoreDuplicates: true }).select("id");
  if (error) throw error;
  return { created: data?.length || 0, considered: pending.length };
}
