import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock, CalendarDays, Check, ChevronRight, Clock3, Pencil, Plus, RotateCcw, Search, SkipForward, X } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { EmptyState, ErrorState, LoadingState } from "../ui/Feedback.jsx";

const DEFAULT_INTERVALS = [1, 3, 7, 14, 30];
const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, "0");
const dateKey = (date) => date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
const parseLocalDate = (value) => new Date(value + "T12:00:00");
const isoFromDate = (value) => parseLocalDate(value).toISOString();
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
const formatDate = (value) => value ? new Date(value).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "Not scheduled";
const daysBetween = (a, b) => Math.round((parseLocalDate(dateKey(b)) - parseLocalDate(dateKey(a))) / DAY_MS);
const cx = (...items) => items.filter(Boolean).join(" ");

function parseIntervals(value) {
  const values = String(value).split(",").map((item) => Number(item.trim()));
  if (!values.length || values.some((n) => !Number.isInteger(n) || n < 1 || n > 365)) return null;
  if (values.some((n, i) => i > 0 && n <= values[i - 1])) return null;
  return values;
}

function nextInterval(revisionNumber, intervals) {
  return intervals[Math.min(Math.max(0, revisionNumber - 1), intervals.length - 1)];
}

function RevisionDialog({ chapter, subject, initial, intervals, onClose, onSave }) {
  const [date, setDate] = useState(initial?.scheduled_for ? dateKey(new Date(initial.scheduled_for)) : dateKey(addDays(new Date(), 1)));
  const [notes, setNotes] = useState(initial?.notes || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (!date) return setError("Choose a revision date.");
    if (new Date(date + "T23:59:59").getTime() < Date.now()) return setError("Choose today or a future date.");
    setBusy(true); setError("");
    try { await onSave({ scheduled_for: isoFromDate(date), notes: notes.trim() || null }); onClose(); }
    catch (err) { setError(err.message || "Could not save revision."); }
    finally { setBusy(false); }
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="dialog-card revision-dialog" role="dialog" aria-modal="true" aria-labelledby="revision-dialog-title">
      <div className="dialog-heading"><div><p className="eyebrow">REVISION PLANNER</p><h2 id="revision-dialog-title">{initial ? "Reschedule revision" : "Schedule revision"}</h2><span className="revision-dialog-context">{subject?.name || "Subject"} · {chapter?.title}</span></div><button className="icon-button" type="button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
      <form onSubmit={submit}>
        <label className="field-label">Revision date<input type="date" value={date} min={dateKey(new Date())} onChange={(event) => setDate(event.target.value)} required/></label>
        <label className="field-label">Notes <span className="revision-optional">Optional</span><textarea rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What should you revise this time?"/></label>
        <p className="revision-suggestion">Suggested interval: {nextInterval(initial?.revision_number || 1, intervals)} days after the previous revision.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="dialog-actions"><button type="button" className="button button-ghost" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? "Saving..." : "Save schedule"}</button></div>
      </form>
    </section>
  </div>;
}

function RevisionCard({ row, chapter, subject, today, onComplete, onEdit, onSkip }) {
  const scheduled = row.scheduled_for ? new Date(row.scheduled_for) : null;
  const lateDays = scheduled ? Math.max(0, daysBetween(scheduled, today)) : 0;
  const isDue = scheduled && dateKey(scheduled) <= dateKey(today);
  return <article className={cx("revision-card", isDue && "revision-card-due")}>
    <div className="revision-card-head"><span className={cx("revision-state", row.completed_at ? "complete" : isDue ? "due" : "scheduled")}>{row.completed_at ? "Completed" : isDue ? lateDays > 0 ? "Overdue" : "Due today" : "Scheduled"}</span><span className="revision-number">Revision {row.revision_number}</span></div>
    <h3>{chapter?.title || "Chapter unavailable"}</h3>
    <p className="revision-subject">{subject?.name || "Subject unavailable"}</p>
    <div className="revision-date-line"><CalendarDays size={14}/><span>{row.completed_at ? "Completed " + formatDate(row.completed_at) : "Scheduled " + formatDate(row.scheduled_for)}</span>{!row.completed_at && lateDays > 0 && <strong>{lateDays} days late</strong>}</div>
    {row.notes && <p className="revision-card-notes">{row.notes}</p>}
    {!row.completed_at && <div className="revision-card-actions"><button type="button" className="button button-primary" onClick={() => onComplete(row)}><Check size={14}/> Mark complete</button><button type="button" className="revision-icon-action" aria-label="Reschedule revision" onClick={() => onEdit(row)}><Pencil size={14}/></button><button type="button" className="revision-icon-action" aria-label="Mark not needed" onClick={() => onSkip(row)}><SkipForward size={14}/></button></div>}
  </article>;
}

export function RevisionsPage({ userId }) {
  const [revisions, setRevisions] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [view, setView] = useState("due");
  const [intervals, setIntervals] = useState(DEFAULT_INTERVALS);
  const [intervalDraft, setIntervalDraft] = useState(DEFAULT_INTERVALS.join(", "));
  const [showSettings, setShowSettings] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [skipTarget, setSkipTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState("");

  const loadData = useCallback(async () => {
    if (!supabase || !userId) return;
    setLoading(true); setLoadError("");
    try {
      const [revisionRows, chapterRows, subjectRows, preferences] = await Promise.all([
        supabase.from("revisions").select("*").order("scheduled_for", { ascending: true, nullsFirst: false }),
        supabase.from("chapters").select("id,title,subject_id,status").order("position"),
        supabase.from("subjects").select("id,name,is_archived").order("position"),
        supabase.from("user_preferences").select("revision_intervals_days").eq("user_id", userId).maybeSingle(),
      ]);
      if (revisionRows.error) throw revisionRows.error;
      if (chapterRows.error) throw chapterRows.error;
      if (subjectRows.error) throw subjectRows.error;
      if (preferences.error) throw preferences.error;
      const savedIntervals = parseIntervals((preferences.data?.revision_intervals_days || DEFAULT_INTERVALS).join(","));
      const nextIntervals = savedIntervals || DEFAULT_INTERVALS;
      setRevisions(revisionRows.data || []); setChapters(chapterRows.data || []); setSubjects(subjectRows.data || []);
      setIntervals(nextIntervals); setIntervalDraft(nextIntervals.join(", "));
    } catch (error) { setLoadError(error.message || "Could not load revision history."); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);
  const today = new Date();
  const chapterMap = useMemo(() => Object.fromEntries(chapters.map((c) => [c.id, c])), [chapters]);
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);
  const latestByChapter = useMemo(() => {
    const map = new Map();
    revisions.forEach((row) => {
      const old = map.get(row.chapter_id);
      if (!old || row.revision_number > old.revision_number || (row.revision_number === old.revision_number && new Date(row.created_at) > new Date(old.created_at))) map.set(row.chapter_id, row);
    });
    return map;
  }, [revisions]);

  const activeRows = useMemo(() => revisions.filter((row) => !row.completed_at && !row.skipped_at && row.scheduled_for), [revisions]);
  const todayKey = dateKey(today);
  const dueRows = activeRows.filter((row) => dateKey(new Date(row.scheduled_for)) <= todayKey);
  const overdueRows = dueRows.filter((row) => dateKey(new Date(row.scheduled_for)) < todayKey);
  const completedRows = revisions.filter((row) => row.completed_at);
  const term = query.trim().toLocaleLowerCase();
  const filtered = revisions.filter((row) => {
    const chapter = chapterMap[row.chapter_id];
    const subject = subjectMap[chapter?.subject_id];
    if (subjectFilter !== "all" && subject?.id !== subjectFilter) return false;
    if (view === "due" && (row.completed_at || row.skipped_at || !row.scheduled_for || dateKey(new Date(row.scheduled_for)) > todayKey)) return false;
    if (view === "upcoming" && (row.completed_at || row.skipped_at || !row.scheduled_for || dateKey(new Date(row.scheduled_for)) <= todayKey)) return false;
    if (view === "completed" && !row.completed_at) return false;
    if (view === "skipped" && !row.skipped_at) return false;
    return !term || [chapter?.title || "", subject?.name || "", row.notes || ""].some((value) => value.toLocaleLowerCase().includes(term));
  }).sort((a, b) => {
    if (a.completed_at && b.completed_at) return new Date(b.completed_at) - new Date(a.completed_at);
    return new Date(a.scheduled_for || 0) - new Date(b.scheduled_for || 0);
  });

  async function saveRevision(chapterId, values, initial = null) {
    if (initial?.id) {
      const { data, error } = await supabase.from("revisions").update(values).eq("id", initial.id).select().single();
      if (error) throw error;
      setRevisions((rows) => rows.map((row) => row.id === data.id ? data : row));
      setToast("Revision rescheduled.");
    } else {
      const { data, error } = await supabase.from("revisions").insert({
        user_id: userId, chapter_id: chapterId, revision_number: 1,
        scheduled_for: values.scheduled_for, notes: values.notes,
      }).select().single();
      if (error) throw error;
      setRevisions((rows) => [data, ...rows]);
      setToast("Revision scheduled.");
    }
  }

  async function completeRevision(row) {
    setBusyId(row.id);
    const completedAt = new Date();
    const { data, error } = await supabase.from("revisions").update({ completed_at: completedAt.toISOString() }).eq("id", row.id).select().single();
    if (error) { setToast(error.message || "Could not complete revision."); setBusyId(null); return; }
    const nextNumber = row.revision_number + 1;
    const interval = nextInterval(row.revision_number, intervals);
    const nextDate = addDays(completedAt, interval);
    const { data: nextRow, error: nextError } = await supabase.from("revisions").insert({
      user_id: userId, chapter_id: row.chapter_id, revision_number: nextNumber,
      scheduled_for: nextDate.toISOString(), notes: null,
    }).select().single();
    setRevisions((rows) => nextError ? rows.map((item) => item.id === data.id ? data : item) : [nextRow, ...rows.map((item) => item.id === data.id ? data : item)]);
    setToast(nextError ? "Revision completed, but the next one could not be scheduled. Use Add to retry: " + nextError.message : "Revision completed. Next revision scheduled in " + interval + " days.");
    setBusyId(null);
  }

  async function markNotNeeded(row) {
    setBusyId(row.id);
    const { data, error } = await supabase.from("revisions").update({ skipped_at: new Date().toISOString() }).eq("id", row.id).select().single();
    if (error) setToast(error.message || "Could not update revision.");
    else { setRevisions((rows) => rows.map((item) => item.id === data.id ? data : item)); setSkipTarget(null); setToast("Revision marked as not needed."); }
    setBusyId(null);
  }

  async function createChapterRevision(chapter) {
    const latest = latestByChapter.get(chapter.id);
    if (activeRows.some((row) => row.chapter_id === chapter.id)) {
      setToast("This chapter already has a pending revision.");
      return;
    }
    const scheduled = latest?.completed_at
      ? addDays(new Date(latest.completed_at), nextInterval(latest.revision_number, intervals))
      : addDays(new Date(), intervals[0]);
    await saveRevision(chapter.id, { scheduled_for: scheduled.toISOString(), notes: null });
  }

  async function saveIntervalSettings(event) {
    event.preventDefault();
    const parsed = parseIntervals(intervalDraft);
    if (!parsed) return setToast("Enter increasing whole-day intervals, e.g. 1, 3, 7, 14, 30.");
    const { error } = await supabase.from("user_preferences").upsert({ user_id: userId, revision_intervals_days: parsed }, { onConflict: "user_id" });
    if (error) return setToast(error.message || "Could not save revision intervals.");
    setIntervals(parsed); setIntervalDraft(parsed.join(", ")); setShowSettings(false);
    setToast("Revision intervals saved.");
  }

  const candidates = chapters.filter((chapter) => chapter.status !== "completed" && !activeRows.some((row) => row.chapter_id === chapter.id));
  const dueCount = dueRows.length;
  const upcomingCount = activeRows.length - dueCount;
  const completedCount = completedRows.length;

  return <div className="revisions-page">
    <section className="revisions-header"><div><p className="eyebrow">BUILD LONG-TERM MEMORY</p><h1>Revision tracker</h1><p>Small, consistent reviews help you retain what you learn.</p></div><div><button type="button" className="button button-ghost" onClick={() => setShowSettings((v) => !v)}><CalendarClock size={14}/> Intervals</button><button type="button" className="button button-primary" onClick={() => setShowSettings("add")}><Plus size={15}/> Schedule revision</button></div></section>
    <section className="revisions-stats"><article><span>Due today / overdue</span><strong>{dueCount}</strong><small className="revision-stat-detail">{overdueRows.length} overdue</small></article><article><span>Upcoming</span><strong>{upcomingCount}</strong></article><article><span>Completed reviews</span><strong>{completedCount}</strong></article></section>
    {showSettings === true && <section className="revision-interval-panel"><form onSubmit={saveIntervalSettings}><label className="field-label">Suggested intervals (days)<input value={intervalDraft} onChange={(event) => setIntervalDraft(event.target.value)} placeholder="1, 3, 7, 14, 30"/></label><p>Enter increasing whole numbers separated by commas. Values are used as days after each completed revision. This is a deterministic schedule, not an AI-generated plan.</p><div><button type="button" className="button button-ghost" onClick={() => setShowSettings(false)}>Cancel</button><button type="submit" className="button button-primary">Save intervals</button></div></form></section>}
    <section className="revisions-toolbar"><label className="revision-search"><Search size={14}/><input aria-label="Search revisions" placeholder="Search chapters or subjects..." value={query} onChange={(event) => setQuery(event.target.value)}/></label><select aria-label="Filter by subject" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}><option value="all">All subjects</option>{subjects.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select><div className="revision-view-tabs">{["due","upcoming","completed","skipped","all"].map((key) => <button key={key} type="button" className={view === key ? "active" : ""} onClick={() => setView(key)}>{key === "due" ? "Due" : key[0].toUpperCase() + key.slice(1)}</button>)}</div></section>
    {loading ? <LoadingState label="Loading revision history..."/> : loadError ? <ErrorState title="Revisions could not be loaded" description={loadError} onRetry={loadData}/> : filtered.length ? <section className="revision-grid">{filtered.map((row) => <RevisionCard key={row.id} row={row} chapter={chapterMap[row.chapter_id]} subject={subjectMap[chapterMap[row.chapter_id]?.subject_id]} today={new Date()} onComplete={completeRevision} onEdit={(item) => setDialog(item)} onSkip={setSkipTarget}/>)}</section> : <EmptyState icon={CalendarDays} title={view === "due" ? "Nothing due right now" : "No revisions found"} description="Schedule a chapter review to start building your revision history." actionLabel="Schedule revision" onAction={() => setShowSettings("add")}/>}
    <section className="revision-chapter-picker"><header><div><p className="eyebrow">CHAPTER COVERAGE</p><h2>Start revising a chapter</h2></div><span>{candidates.length} chapters</span></header><div className="revision-chapter-list">{candidates.map((chapter) => <article key={chapter.id}><div><strong>{chapter.title}</strong><span>{subjectMap[chapter.subject_id]?.name || "Subject"} · {chapter.status.replace("_"," ")}</span></div><small>{latestByChapter.get(chapter.id)?.completed_at ? "Last reviewed " + formatDate(latestByChapter.get(chapter.id).completed_at) : "No review history"}</small><button type="button" onClick={() => createChapterRevision(chapter)}><Plus size={13}/> Add</button></article>)}</div></section>
    {showSettings === "add" && <div className="dialog-backdrop" role="presentation"><section className="dialog-card revision-dialog" role="dialog" aria-modal="true" aria-labelledby="revision-start-title"><div className="dialog-heading"><div><p className="eyebrow">CHAPTER REVISION</p><h2 id="revision-start-title">Choose a chapter</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={() => setShowSettings(false)}><X size={18}/></button></div><div className="revision-chapter-select-list">{chapters.filter((chapter) => !activeRows.some((row) => row.chapter_id === chapter.id)).map((chapter) => <button type="button" key={chapter.id} onClick={() => { setDialog({ chapter, subject: subjectMap[chapter.subject_id], initial: null }); setShowSettings(false); }}><span><strong>{chapter.title}</strong><small>{subjectMap[chapter.subject_id]?.name || "Subject"}</small></span><ChevronRight size={15}/></button>)}</div></section></div>}
    {dialog && <RevisionDialog chapter={dialog.chapter || chapterMap[dialog.chapter_id]} subject={dialog.subject || subjectMap[chapterMap[dialog.chapter_id]?.subject_id]} initial={dialog.id ? dialog : null} intervals={intervals} onClose={() => setDialog(null)} onSave={(values) => saveRevision(dialog.chapter?.id || dialog.chapter_id, values, dialog.id ? dialog : null)}/>}
    {skipTarget && <div className="dialog-backdrop" role="presentation"><section className="dialog-card revision-confirm" role="alertdialog" aria-modal="true" aria-labelledby="revision-skip-title"><h2 id="revision-skip-title">Mark this revision not needed?</h2><p>The scheduled entry will remain in your history but will no longer appear in the due list.</p><div className="dialog-actions"><button type="button" className="button button-ghost" onClick={() => setSkipTarget(null)}>Cancel</button><button type="button" className="button button-primary" onClick={() => markNotNeeded(skipTarget)} disabled={busyId === skipTarget.id}>{busyId === skipTarget.id ? "Saving..." : "Mark not needed"}</button></div></section></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
