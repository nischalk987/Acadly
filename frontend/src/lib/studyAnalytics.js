const DAY_MS = 24 * 60 * 60 * 1000;

export function dateKeyInTimeZone(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value instanceof Date ? value : new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return part("year") + "-" + part("month") + "-" + part("day");
}

export function shiftDateKey(dateKey, amount) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

export function dateKeyToUtcNoon(dateKey) {
  return new Date(dateKey + "T12:00:00.000Z");
}

export function getRangeForPreset(preset, todayKey) {
  if (preset === "7d") return { start: shiftDateKey(todayKey, -6), end: todayKey };
  if (preset === "30d") return { start: shiftDateKey(todayKey, -29), end: todayKey };
  if (preset === "90d") return { start: shiftDateKey(todayKey, -89), end: todayKey };
  return { start: shiftDateKey(todayKey, -6), end: todayKey };
}

export function buildStudyAnalytics({ sessions, tasks, subjects, chapters, timeZone, start, end, todayKey }) {
  const days = [];
  for (let key = start; key <= end; key = shiftDateKey(key, 1)) {
    days.push({ date: key, seconds: 0, sessions: 0, tasks: 0 });
  }
  const dayMap = new Map(days.map((day) => [day.date, day]));
  const subjectMap = new Map(subjects.map((subject) => [subject.id, {
    id: subject.id,
    name: subject.name,
    color: subject.color || "#8b5cf6",
    sessions: 0,
    seconds: 0,
    completedChapters: 0,
    totalChapters: 0,
  }]));

  const validSessions = sessions.filter((session) =>
    session.session_type === "focus" &&
    session.completed === true &&
    Number(session.duration_seconds) > 0 &&
    session.started_at
  );

  for (const session of validSessions) {
    const key = dateKeyInTimeZone(session.started_at, timeZone);
    const day = dayMap.get(key);
    if (!day) continue;
    const seconds = Math.max(0, Number(session.duration_seconds) || 0);
    day.seconds += seconds;
    day.sessions += 1;
    const subject = subjectMap.get(session.subject_id);
    if (subject) {
      subject.seconds += seconds;
      subject.sessions += 1;
    }
  }

  const validTasks = tasks.filter((task) => task.status === "completed" && task.completed_at);
  for (const task of validTasks) {
    const key = dateKeyInTimeZone(task.completed_at, timeZone);
    const day = dayMap.get(key);
    if (!day) continue;
    day.tasks += 1;
  }

  for (const chapter of chapters) {
    const subject = subjectMap.get(chapter.subject_id);
    if (!subject) continue;
    subject.totalChapters += 1;
    if (chapter.status === "completed") subject.completedChapters += 1;
  }

  const studyDays = days.filter((day) => day.seconds > 0).map((day) => day.date);
  const studyDateSet = new Set(studyDays);
  let currentStreak = 0;
  let streakDate = studyDateSet.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  while (studyDateSet.has(streakDate)) {
    currentStreak += 1;
    streakDate = shiftDateKey(streakDate, -1);
  }

  const bestStreak = (() => {
    let best = 0;
    let current = 0;
    let previous = null;
    for (const key of studyDays) {
      current = previous && shiftDateKey(previous, 1) === key ? current + 1 : 1;
      best = Math.max(best, current);
      previous = key;
    }
    return best;
  })();

  const totalSeconds = days.reduce((total, day) => total + day.seconds, 0);
  const completedTasks = days.reduce((total, day) => total + day.tasks, 0);
  const totalSessions = days.reduce((total, day) => total + day.sessions, 0);
  const completedChapters = chapters.filter((chapter) => chapter.status === "completed").length;
  const subjectsWithProgress = [...subjectMap.values()]
    .map((subject) => ({
      ...subject,
      progress: subject.totalChapters ? Math.round((subject.completedChapters / subject.totalChapters) * 100) : 0,
    }))
    .sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name));

  return {
    days,
    totalSeconds,
    completedTasks,
    totalSessions,
    studyDays: studyDays.length,
    currentStreak,
    bestStreak,
    completedChapters,
    totalChapters: chapters.length,
    subjectProgress: subjectsWithProgress,
  };
}

export function formatDuration(seconds) {
  const minutes = Math.round((Number(seconds) || 0) / 60);
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours && remaining) return hours + "h " + remaining + "m";
  if (hours) return hours + "h";
  return remaining + "m";
}

export function formatDateLabel(dateKey, timeZone, options = { weekday: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(dateKeyToUtcNoon(dateKey));
}

export function getTodayKey(timeZone) {
  return dateKeyInTimeZone(new Date(), timeZone);
}

export function getUtcRangeForLocalDates(start, end, timeZone) {
  const offsetAt = (date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const asUtc = Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day), Number(value.hour), Number(value.minute), Number(value.second));
    return asUtc - date.getTime();
  };

  const localMidnightAsUtc = (key) => {
    const [year, month, day] = key.split("-").map(Number);
    let guess = Date.UTC(year, month - 1, day);
    for (let index = 0; index < 3; index += 1) {
      guess = Date.UTC(year, month - 1, day) - offsetAt(new Date(guess));
    }
    return new Date(guess).toISOString();
  };

  return {
    startIso: localMidnightAsUtc(start),
    endExclusiveIso: localMidnightAsUtc(shiftDateKey(end, 1)),
  };
}
