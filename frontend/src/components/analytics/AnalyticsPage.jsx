import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, Flame, RefreshCw, Target, TrendingUp } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import {
  buildStudyAnalytics,
  formatDateLabel,
  formatDuration,
  getRangeForPreset,
  getTodayKey,
  getUtcRangeForLocalDates,
} from "../../lib/studyAnalytics.js";
import { EmptyState, ErrorState, LoadingState } from "../ui/Feedback.jsx";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

function Metric({ label, value, detail, icon: Icon }) {
  return (
    <article className="analytics-metric">
      <div><span>{label}</span><span className="analytics-metric-icon"><Icon size={17} aria-hidden="true" /></span></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function StudyTimeChart({ days, timeZone }) {
  const maxHours = Math.max(1, ...days.map((day) => day.seconds / 3600));
  const chartLabel = days.map((day) => formatDateLabel(day.date, timeZone, { weekday: "long", month: "short", day: "numeric" }) + ": " + formatDuration(day.seconds)).join("; ");

  if (!days.some((day) => day.seconds > 0)) {
    return <div className="analytics-empty-chart"><Activity size={23} /><strong>No study sessions in this range</strong><span>Complete a focus session to see your study trend here.</span></div>;
  }

  return (
    <div className="analytics-chart-wrap">
      <p className="sr-only" role="status">Daily study time. {chartLabel}</p>
      <div className="analytics-chart" role="img" aria-label={"Daily completed focus time. " + chartLabel}>
        <div className="analytics-chart-y"><span>{formatDuration(maxHours * 3600)}</span><span>{formatDuration(maxHours * 1800)}</span><span>0m</span></div>
        <div className="analytics-bars">
          {days.map((day) => {
            const height = day.seconds ? Math.max(3, (day.seconds / 3600 / maxHours) * 100) : 0;
            return (
              <div className="analytics-bar-column" key={day.date}>
                <div className="analytics-bar-track">
                  <span className="analytics-bar" style={{ height: height + "%" }} title={formatDuration(day.seconds)} />
                </div>
                <span className="analytics-bar-label">{formatDateLabel(day.date, timeZone, { day: "numeric", month: days.length <= 7 ? "short" : undefined })}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="analytics-chart-legend"><span><i /> Completed focus time</span><span>Values use your profile timezone</span></div>
    </div>
  );
}

export function AnalyticsPage({ userId }) {
  const [profileTimeZone, setProfileTimeZone] = useState("Asia/Kolkata");
  const [rangePreset, setRangePreset] = useState("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [sessions, setSessions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const todayKey = getTodayKey(profileTimeZone);
  const range = useMemo(() => {
    if (rangePreset === "custom" && customStart && customEnd && customStart <= customEnd) {
      return { start: customStart, end: customEnd };
    }
    return getRangeForPreset(rangePreset === "custom" ? "7d" : rangePreset, todayKey);
  }, [rangePreset, customStart, customEnd, todayKey]);

  const loadData = useCallback(async (silent = false) => {
    if (!supabase || !userId) {
      setError("Your database connection is unavailable. Please sign in again.");
      setLoading(false);
      return;
    }
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("id", userId)
        .single();
      if (profileError) throw profileError;
      const timeZone = profile?.timezone || "Asia/Kolkata";
      setProfileTimeZone(timeZone);

      const today = getTodayKey(timeZone);
      const selectedRange = rangePreset === "custom" && customStart && customEnd && customStart <= customEnd
        ? { start: customStart, end: customEnd }
        : getRangeForPreset(rangePreset === "custom" ? "7d" : rangePreset, today);
      const bounds = getUtcRangeForLocalDates(selectedRange.start, selectedRange.end, timeZone);

      const [sessionResult, taskResult, subjectResult, chapterResult] = await Promise.all([
        supabase.from("study_sessions")
          .select("id,session_type,started_at,duration_seconds,completed,subject_id")
          .eq("session_type", "focus")
          .eq("completed", true)
          .gt("duration_seconds", 0)
          .gte("started_at", bounds.startIso)
          .lt("started_at", bounds.endExclusiveIso)
          .order("started_at", { ascending: true }),
        supabase.from("study_tasks")
          .select("id,status,completed_at,subject_id")
          .eq("status", "completed")
          .not("completed_at", "is", null)
          .gte("completed_at", bounds.startIso)
          .lt("completed_at", bounds.endExclusiveIso),
        supabase.from("subjects").select("id,name,color,is_archived").eq("is_archived", false).order("position"),
        supabase.from("chapters").select("id,subject_id,status").order("position"),
      ]);
      for (const result of [sessionResult, taskResult, subjectResult, chapterResult]) {
        if (result.error) throw result.error;
      }
      setSessions(sessionResult.data || []);
      setTasks(taskResult.data || []);
      setSubjects(subjectResult.data || []);
      setChapters(chapterResult.data || []);
    } catch (loadError) {
      setError(loadError.message || "Could not load your study analytics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, rangePreset, customStart, customEnd]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!supabase || !userId) return undefined;
    const channel = supabase.channel("study-analytics-" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "study_sessions", filter: "user_id=eq." + userId }, () => loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "study_tasks", filter: "user_id=eq." + userId }, () => loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "chapters", filter: "user_id=eq." + userId }, () => loadData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, loadData]);

  const analytics = useMemo(() => buildStudyAnalytics({
    sessions, tasks, subjects, chapters, timeZone: profileTimeZone,
    start: range.start, end: range.end, todayKey,
  }), [sessions, tasks, subjects, chapters, profileTimeZone, range.start, range.end, todayKey]);

  const customRangeInvalid = rangePreset === "custom" && (!customStart || !customEnd || customStart > customEnd);

  if (loading) return <div className="analytics-page"><LoadingState label="Loading your study analytics..." /></div>;
  if (error && !sessions.length && !tasks.length && !subjects.length) return <div className="analytics-page"><ErrorState title="Analytics could not be loaded" description={error} actionLabel="Try again" onAction={() => loadData()} /></div>;

  return (
    <div className="analytics-page">
      <header className="analytics-header">
        <div><p className="eyebrow">YOUR LEARNING DATA</p><h1>Study analytics</h1><p>See how consistently you study and where your time goes.</p></div>
        <button type="button" className="button button-ghost" onClick={() => loadData(true)} disabled={refreshing}><RefreshCw size={14} className={refreshing ? "analytics-spinning" : ""} /> Refresh</button>
      </header>

      {error && <div className="analytics-warning" role="alert">{error} Showing the last successfully loaded records.</div>}

      <section className="analytics-toolbar" aria-label="Analytics date range">
        <div className="analytics-range-tabs" role="group" aria-label="Choose a date range">
          {RANGE_OPTIONS.map((option) => <button type="button" key={option.value} className={rangePreset === option.value ? "active" : ""} aria-pressed={rangePreset === option.value} onClick={() => setRangePreset(option.value)}>{option.label}</button>)}
          <button type="button" className={rangePreset === "custom" ? "active" : ""} aria-pressed={rangePreset === "custom"} onClick={() => setRangePreset("custom")}>Custom</button>
        </div>
        {rangePreset === "custom" && <div className="analytics-custom-range">
          <label>From <input type="date" value={customStart} max={customEnd || todayKey} onChange={(event) => setCustomStart(event.target.value)} /></label>
          <label>To <input type="date" value={customEnd} min={customStart} max={todayKey} onChange={(event) => setCustomEnd(event.target.value)} /></label>
        </div>}
        <p className="analytics-range-caption">{formatDateLabel(range.start, profileTimeZone, { month: "short", day: "numeric", year: "numeric" })} – {formatDateLabel(range.end, profileTimeZone, { month: "short", day: "numeric", year: "numeric" })}</p>
      </section>
      {customRangeInvalid && <p className="analytics-inline-hint" role="status">Choose a valid start and end date to apply your custom range.</p>}

      <section className="analytics-metric-grid" aria-label="Study metrics">
        <Metric label="Total focus time" value={formatDuration(analytics.totalSeconds)} detail={rangePreset === "7d" ? "Last 7 days" : rangePreset === "30d" ? "Last 30 days" : rangePreset === "90d" ? "Last 90 days" : "Selected dates"} icon={Clock3} />
        <Metric label="Completed tasks" value={String(analytics.completedTasks)} detail="Completed in this date range" icon={CheckCircle2} />
        <Metric label="Study days" value={String(analytics.studyDays)} detail={"Of " + analytics.days.length + " days in range"} icon={Activity} />
        <Metric label="Focus sessions" value={String(analytics.totalSessions)} detail="Completed focus blocks" icon={Target} />
      </section>

      <section className="analytics-secondary-grid">
        <article className="analytics-panel analytics-streak-panel">
          <div className="analytics-panel-heading"><div><p className="eyebrow">CONSISTENCY</p><h2>Study streak</h2></div><Flame size={19} aria-hidden="true" /></div>
          <div className="analytics-streak-value">{analytics.currentStreak}<small>days</small></div>
          <p>Current streak · best streak in selected range: {analytics.bestStreak} days</p>
          <div className="analytics-streak-days" aria-label="Study days shown in the selected range">
            {analytics.days.slice(-14).map((day) => <span key={day.date} className={day.seconds > 0 ? "active" : ""} title={formatDateLabel(day.date, profileTimeZone, { month: "short", day: "numeric" }) + (day.seconds > 0 ? ": studied" : ": no completed focus session")} />)}
          </div>
          <small className="analytics-streak-note">A study day is a local calendar day with at least one completed focus session and positive recorded duration. A streak includes today, or continues from yesterday until you study today.</small>
        </article>
        <article className="analytics-panel">
          <div className="analytics-panel-heading"><div><p className="eyebrow">LEARNING PROGRESS</p><h2>Chapter completion</h2></div><TrendingUp size={19} aria-hidden="true" /></div>
          <div className="analytics-chapter-summary"><strong>{analytics.completedChapters}</strong><span>of {analytics.totalChapters} chapters completed</span></div>
          <div className="analytics-progress-track"><span style={{ width: (analytics.totalChapters ? analytics.completedChapters / analytics.totalChapters * 100 : 0) + "%" }} /></div>
          <p className="analytics-progress-caption">{analytics.totalChapters ? Math.round(analytics.completedChapters / analytics.totalChapters * 100) + "% complete across all chapters" : "Add chapters to start tracking subject progress."}</p>
        </article>
      </section>

      <section className="analytics-panel analytics-study-panel">
        <div className="analytics-panel-heading"><div><p className="eyebrow">FOCUS ACTIVITY</p><h2>Daily study time</h2></div><span className="analytics-timezone-note">Timezone: {profileTimeZone}</span></div>
        <StudyTimeChart days={analytics.days} timeZone={profileTimeZone} />
      </section>

      <section className="analytics-panel">
        <div className="analytics-panel-heading"><div><p className="eyebrow">SUBJECT BREAKDOWN</p><h2>Progress by subject</h2></div></div>
        {analytics.subjectProgress.length ? <div className="analytics-subject-list">
          {analytics.subjectProgress.map((subject) => (
            <article className="analytics-subject-row" key={subject.id}>
              <span className="analytics-subject-mark" style={{ background: subject.color }} />
              <div className="analytics-subject-copy"><strong>{subject.name}</strong><small>{subject.completedChapters} / {subject.totalChapters} chapters · {formatDuration(subject.seconds)} focus time</small></div>
              <div className="analytics-subject-progress"><div><span style={{ width: subject.progress + "%" }} /></div><strong>{subject.progress}%</strong></div>
            </article>
          ))}
        </div> : <EmptyState title="No subjects yet" description="Add a subject and chapters to see learning progress here." />}
      </section>
      <p className="analytics-footer-note">Focus time is summed only from completed focus-session records. Task completions and chapter progress are shown separately and are not converted into study minutes.</p>
    </div>
  );
}
