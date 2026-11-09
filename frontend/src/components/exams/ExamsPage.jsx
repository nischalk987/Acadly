import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, Check, Clock3, MapPin, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { EmptyState, ErrorState, LoadingState } from "../ui/Feedback.jsx";

const pad = (value) => String(value).padStart(2, "0");
const localDate = (date) => date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
const localDateTime = (iso) => {
  const date = new Date(iso);
  return localDate(date) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
};
const toIso = (value) => new Date(value).toISOString();
const formatDate = (iso) => new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const cx = (...items) => items.filter(Boolean).join(" ");
const COUNTDOWN_UNITS = [
  ["day", 86400000],
  ["hour", 3600000],
  ["minute", 60000],
  ["second", 1000],
];

function countdown(startsAt, now) {
  const delta = new Date(startsAt).getTime() - now;
  if (delta <= 0) return "Started";
  let remaining = delta;
  const parts = [];
  for (const [label, unit] of COUNTDOWN_UNITS) {
    const amount = Math.floor(remaining / unit);
    remaining %= unit;
    if (amount || parts.length) parts.push(amount + " " + label + (amount === 1 ? "" : "s"));
    if (parts.length === 2) break;
  }
  return parts.join(" ");
}

function ExamDialog({ initial, subjects, onClose, onSave }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [subjectId, setSubjectId] = useState(initial?.subject_id || "");
  const [examType, setExamType] = useState(initial?.exam_type || "Internal assessment");
  const [startsAt, setStartsAt] = useState(initial?.starts_at ? localDateTime(initial.starts_at) : localDate(new Date()) + "T09:00");
  const [location, setLocation] = useState(initial?.location || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [reminder, setReminder] = useState(false);
  const [reminderWhen, setReminderWhen] = useState("1440");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!title.trim()) return setError("Enter an exam title.");
    if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) return setError("Choose a valid exam date and time.");
    if (new Date(startsAt).getTime() <= Date.now() && !initial) return setError("Choose a future date and time for a new exam.");
    setBusy(true); setError("");
    try {
      await onSave({
        title: title.trim(),
        subject_id: subjectId || null,
        exam_type: examType.trim() || null,
        starts_at: toIso(startsAt),
        location: location.trim() || null,
        notes: notes.trim() || null,
      }, reminder ? Number(reminderWhen) : null);
      onClose();
    } catch (saveError) {
      setError(saveError.message || "Could not save this exam.");
    } finally { setBusy(false); }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="dialog-card exam-dialog" role="dialog" aria-modal="true" aria-labelledby="exam-dialog-title">
        <div className="dialog-heading"><div><p className="eyebrow">EXAM TRACKER</p><h2 id="exam-dialog-title">{initial ? "Edit exam" : "Add an exam"}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
        <form onSubmit={submit}>
          <label className="field-label">Exam title<input autoFocus maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Computer Networks ISA 2" required /></label>
          <div className="exam-fields-two">
            <label className="field-label">Subject<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">No subject</option>{subjects.filter((subject) => !subject.is_archived).map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label>
            <label className="field-label">Exam type<input maxLength={80} value={examType} onChange={(event) => setExamType(event.target.value)} placeholder="ISA, CIE, semester..." /></label>
          </div>
          <label className="field-label">Date and time<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label>
          <label className="field-label">Location <span className="exam-optional">Optional</span><input maxLength={180} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Room, campus or online" /></label>
          <label className="field-label">Notes <span className="exam-optional">Optional</span><textarea rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Syllabus, materials to bring, exam instructions..." /></label>
          {!initial && <div className="exam-reminder-box"><label><input type="checkbox" checked={reminder} onChange={(event) => setReminder(event.target.checked)} /> Create an in-app reminder</label>{reminder && <select aria-label="Reminder lead time" value={reminderWhen} onChange={(event) => setReminderWhen(event.target.value)}><option value="60">1 hour before</option><option value="1440">1 day before</option><option value="2880">2 days before</option><option value="10080">1 week before</option></select>}</div>}
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="dialog-actions"><button type="button" className="button button-ghost" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? "Saving..." : initial ? "Save changes" : "Add exam"}</button></div>
        </form>
      </section>
    </div>
  );
}

function ExamCard({ exam, subject, now, onEdit, onDelete, onToggleComplete, onCreateRevision }) {
  const timestamp = new Date(exam.starts_at).getTime();
  const past = timestamp <= now;
  const daysLeft = Math.ceil((timestamp - now) / 86400000);
  return (
    <article className={cx("exam-card", past && "exam-card-past")}>
      <div className="exam-card-top"><span className={cx("exam-type-pill", past ? "past" : "upcoming")}>{past ? "Past exam" : exam.exam_type || "Exam"}</span><div className="exam-card-actions"><button type="button" aria-label={"Edit " + exam.title} onClick={() => onEdit(exam)}><Pencil size={14} /></button><button type="button" aria-label={"Delete " + exam.title} onClick={() => onDelete(exam)}><Trash2 size={14} /></button></div></div>
      <h3>{exam.title}</h3>
      <p className="exam-card-subject">{subject?.name || "No subject assigned"}</p>
      <div className="exam-card-date"><CalendarDays size={14} /><strong>{formatDate(exam.starts_at)}</strong><span>{formatTime(exam.starts_at)}</span></div>
      {exam.location && <div className="exam-card-meta"><MapPin size={13} />{exam.location}</div>}
      {exam.notes && <p className="exam-card-notes">{exam.notes}</p>}
      <div className="exam-countdown">{past ? <><Check size={15} /><strong>Exam date passed</strong></> : <><Clock3 size={15} /><strong>{countdown(exam.starts_at, now)}</strong><span>{daysLeft === 0 ? "Today" : daysLeft + (daysLeft === 1 ? " day left" : " days left")}</span></>}</div>
      <div className="exam-card-footer"><button type="button" className="exam-complete-button" onClick={() => onToggleComplete(exam)}>{exam.completed_at ? "Mark upcoming" : "Mark completed"}</button>{subject && <button type="button" className="exam-revision-button" onClick={() => onCreateRevision(subject.id)}>Review chapters</button>}</div>
    </article>
  );
}

export function ExamsPage({ userId }) {
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [viewFilter, setViewFilter] = useState("upcoming");
  const [now, setNow] = useState(Date.now());
  const [revisionPanel, setRevisionPanel] = useState(null);
  const [toast, setToast] = useState("");

  const loadData = useCallback(async () => {
    if (!supabase || !userId) return;
    setLoading(true); setLoadError("");
    try {
      const [examRows, subjectRows, chapterRows, revisionRows] = await Promise.all([
        supabase.from("exams").select("*").order("starts_at", { ascending: true }),
        supabase.from("subjects").select("id,name,is_archived").order("position"),
        supabase.from("chapters").select("id,title,subject_id,status").order("position"),
        supabase.from("revisions").select("id,chapter_id,scheduled_for,completed_at,revision_number,notes").order("scheduled_for", { ascending: true }),
      ]);
      if (examRows.error) throw examRows.error;
      if (subjectRows.error) throw subjectRows.error;
      if (chapterRows.error) throw chapterRows.error;
      if (revisionRows.error) throw revisionRows.error;
      setExams(examRows.data || []); setSubjects(subjectRows.data || []); setChapters(chapterRows.data || []); setRevisions(revisionRows.data || []);
    } catch (error) { setLoadError(error.message || "Could not load exams."); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const subjectMap = useMemo(() => Object.fromEntries(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const chapterMap = useMemo(() => Object.fromEntries(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return exams.filter((exam) => {
      const isPast = new Date(exam.starts_at).getTime() <= now;
      const isComplete = Boolean(exam.completed_at);
      if (viewFilter === "upcoming" && (isPast || isComplete)) return false;
      if (viewFilter === "past" && !isPast) return false;
      if (viewFilter === "completed" && !isComplete) return false;
      if (subjectFilter !== "all" && exam.subject_id !== subjectFilter) return false;
      const subject = subjectMap[exam.subject_id]?.name || "";
      return !term || [exam.title, exam.exam_type || "", exam.location || "", exam.notes || "", subject].some((value) => value.toLocaleLowerCase().includes(term));
    }).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }, [exams, query, viewFilter, subjectFilter, subjectMap, now]);

  async function saveExam(values, reminderMinutes) {
    let saved;
    if (dialog?.id) {
      const { data, error } = await supabase.from("exams").update(values).eq("id", dialog.id).select().single();
      if (error) throw error;
      saved = data;
      setExams((items) => items.map((item) => item.id === saved.id ? saved : item));
    } else {
      const { data, error } = await supabase.from("exams").insert({ ...values, user_id: userId }).select().single();
      if (error) throw error;
      saved = data;
      setExams((items) => [...items, saved]);
    }
    if (reminderMinutes) {
      const remindAt = new Date(new Date(saved.starts_at).getTime() - reminderMinutes * 60000);
      if (remindAt.getTime() > Date.now()) {
        const { error } = await supabase.from("reminders").upsert({
          user_id: userId,
          title: "Upcoming exam: " + saved.title,
          event_key: "exam:" + saved.id + ":lead:" + reminderMinutes,
          notification_type: "exam",
          body: "Your " + (saved.exam_type || "exam") + " is scheduled for " + formatDate(saved.starts_at) + " at " + formatTime(saved.starts_at) + ".",
          remind_at: remindAt.toISOString(),
          source_type: "exam",
          source_id: saved.id,
        }, { onConflict: "user_id,event_key", ignoreDuplicates: true });
        if (error) setToast("Exam saved, but reminder could not be created: " + error.message);
        else setToast("Exam and in-app reminder saved.");
      } else setToast("Exam saved. The selected reminder time has already passed.");
    } else setToast(dialog?.id ? "Exam updated." : "Exam added.");
  }

  async function toggleComplete(exam) {
    const next = exam.completed_at ? null : new Date().toISOString();
    const { data, error } = await supabase.from("exams").update({ completed_at: next }).eq("id", exam.id).select().single();
    if (error) return setToast(error.message || "Could not update exam state.");
    setExams((items) => items.map((item) => item.id === data.id ? data : item));
  }

  async function deleteExam() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    const { error } = await supabase.from("exams").delete().eq("id", deleteTarget.id);
    if (error) setToast(error.message || "Could not delete exam.");
    else {
      setExams((items) => items.filter((item) => item.id !== deleteTarget.id));
      await supabase.from("reminders").delete().eq("source_type", "exam").eq("source_id", deleteTarget.id);
      setDeleteTarget(null); setToast("Exam deleted.");
    }
    setDeleteBusy(false);
  }

  const examRevisions = revisionPanel ? revisions.filter((revision) => chapterMap[revision.chapter_id]?.subject_id === revisionPanel) : [];
  const subjectChapters = revisionPanel ? chapters.filter((chapter) => chapter.subject_id === revisionPanel) : [];
  const chaptersWithRevision = new Set(examRevisions.map((revision) => revision.chapter_id));
  const createRevisionPlan = async () => {
    if (!revisionPanel) return;
    const due = subjectChapters.filter((chapter) => chapter.status !== "completed" || !chaptersWithRevision.has(chapter.id));
    if (!due.length) { setToast("All chapters already have revision entries."); return; }
    const rows = due.map((chapter) => ({ user_id: userId, chapter_id: chapter.id, revision_number: 1, scheduled_for: new Date().toISOString(), notes: "Exam preparation" }));
    const { error } = await supabase.from("revisions").insert(rows);
    if (error) setToast(error.message || "Could not create revision plan.");
    else { setToast("Revision plan created for " + due.length + " chapters."); setRevisionPanel(null); await loadData(); }
  };

  const upcomingCount = exams.filter((exam) => new Date(exam.starts_at).getTime() > now && !exam.completed_at).length;
  const pastCount = exams.filter((exam) => new Date(exam.starts_at).getTime() <= now).length;

  return (
    <div className="exams-page">
      <section className="exams-header"><div><p className="eyebrow">STAY PREPARED</p><h1>Exam tracker</h1><p>Keep every assessment and deadline in sight.</p></div><button className="button button-primary" type="button" onClick={() => setDialog({})}><Plus size={16} /> Add exam</button></section>
      <section className="exam-stats"><article><span>Upcoming</span><strong>{upcomingCount}</strong></article><article><span>Past</span><strong>{pastCount}</strong></article><article><span>Completed</span><strong>{exams.filter((exam) => exam.completed_at).length}</strong></article></section>
      <section className="exam-toolbar"><label className="exam-search"><Search size={15} /><input aria-label="Search exams" placeholder="Search exams..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} aria-label="Filter by subject"><option value="all">All subjects</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><select value={viewFilter} onChange={(event) => setViewFilter(event.target.value)} aria-label="Filter exam state"><option value="upcoming">Upcoming</option><option value="past">Past</option><option value="completed">Completed</option><option value="all">All exams</option></select></section>
      {loading ? <LoadingState label="Loading your exams..." /> : loadError ? <ErrorState title="Exams could not be loaded" description={loadError} onRetry={loadData} /> : filtered.length ? <section className="exam-grid">{filtered.map((exam) => <ExamCard key={exam.id} exam={exam} subject={subjectMap[exam.subject_id]} now={now} onEdit={setDialog} onDelete={setDeleteTarget} onToggleComplete={toggleComplete} onCreateRevision={setRevisionPanel} />)}</section> : <EmptyState icon={CalendarDays} title={viewFilter === "upcoming" ? "No upcoming exams" : "No exams found"} description={viewFilter === "upcoming" ? "Add your next assessment to get a clear countdown." : "Try another filter or search term."} actionLabel="Add exam" onAction={() => setDialog({})} />}
      {revisionPanel && <div className="dialog-backdrop" role="presentation"><section className="dialog-card exam-confirm" role="dialog" aria-modal="true" aria-labelledby="exam-revision-title"><h2 id="exam-revision-title">Prepare this subject</h2><p>{subjectMap[revisionPanel]?.name}: create revision entries for chapters that need more review.</p><div className="exam-revision-list">{subjectChapters.map((chapter) => <div key={chapter.id}><span>{chapter.title}</span><small>{chaptersWithRevision.has(chapter.id) ? "Revision already planned" : "Needs a revision entry"}</small></div>)}</div><div className="dialog-actions"><button type="button" className="button button-ghost" onClick={() => setRevisionPanel(null)}>Cancel</button><button type="button" className="button button-primary" onClick={createRevisionPlan}>Create revision plan</button></div></section></div>}
      {dialog && <ExamDialog initial={dialog.id ? dialog : null} subjects={subjects} onClose={() => setDialog(null)} onSave={saveExam} />}
      {deleteTarget && <div className="dialog-backdrop" role="presentation"><section className="dialog-card exam-confirm" role="alertdialog" aria-modal="true" aria-labelledby="exam-delete-title"><h2 id="exam-delete-title">Delete this exam?</h2><p>This will remove “{deleteTarget.title}” and its linked in-app reminders.</p><div className="dialog-actions"><button type="button" className="button button-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button><button type="button" className="button button-danger-solid" onClick={deleteExam} disabled={deleteBusy}>{deleteBusy ? "Deleting..." : "Delete exam"}</button></div></section></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
