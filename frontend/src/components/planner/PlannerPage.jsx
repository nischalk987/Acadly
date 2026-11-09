import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarDays, Check, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { EmptyState, ErrorState, LoadingState } from "../ui/Feedback.jsx";

const PRIORITIES = [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }];
const STATUSES = [{ value: "pending", label: "Pending" }, { value: "in_progress", label: "In progress" }, { value: "completed", label: "Completed" }];
const pad = (value) => String(value).padStart(2, "0");
const localDateKey = (date) => date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
const dayStart = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const shiftDay = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const weekStart = (date) => shiftDay(dayStart(date), -((date.getDay() + 6) % 7));
const weekDates = (date) => Array.from({ length: 7 }, (_, index) => shiftDay(weekStart(date), index));
const sameDay = (timestamp, date) => timestamp && localDateKey(new Date(timestamp)) === localDateKey(date);
const inputTime = (timestamp) => { const d = new Date(timestamp); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
const inputDate = (timestamp) => { const d = new Date(timestamp); return localDateKey(d); };
const timeLabel = (timestamp) => timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Any time";
const toIso = (date, time) => new Date(date + "T" + time).toISOString();
const cx = (...values) => values.filter(Boolean).join(" ");

function TaskDialog({ initial, date, subjects, chapters, onClose, onSave }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [subjectId, setSubjectId] = useState(initial?.subject_id || "");
  const [chapterId, setChapterId] = useState(initial?.chapter_id || "");
  const [taskDate, setTaskDate] = useState(initial?.starts_at ? inputDate(initial.starts_at) : initial?.due_at ? inputDate(initial.due_at) : localDateKey(date));
  const [allDay, setAllDay] = useState(!initial?.starts_at);
  const [start, setStart] = useState(initial?.starts_at ? inputTime(initial.starts_at) : "09:00");
  const [end, setEnd] = useState(initial?.ends_at ? inputTime(initial.ends_at) : "10:00");
  const [priority, setPriority] = useState(initial?.priority || "medium");
  const [status, setStatus] = useState(initial?.status || "pending");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const chapterIsValid = chapters.some((chapter) => chapter.id === chapterId && chapter.subject_id === subjectId);
  useEffect(() => {
    if (chapterId && !chapterIsValid) setChapterId("");
  }, [chapterId, chapterIsValid]);
  const subjectChapters = chapters.filter((chapter) => chapter.subject_id === subjectId);

  async function submit(event) {
    event.preventDefault();
    if (!title.trim()) return setError("Enter a task title.");
    if (!taskDate) return setError("Choose a date.");
    if (!allDay && (!start || !end || end <= start)) return setError("End time must be later than start time.");
    setBusy(true);
    setError("");
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        subject_id: subjectId || null,
        chapter_id: chapterId || null,
        starts_at: allDay ? null : toIso(taskDate, start),
        ends_at: allDay ? null : toIso(taskDate, end),
        due_at: toIso(taskDate, allDay ? "23:59" : end),
        priority,
        status,
        completed_at: status === "completed" ? (initial?.completed_at || new Date().toISOString()) : null,
      });
      onClose();
    } catch (saveError) {
      setError(saveError.message || "Could not save this task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="dialog-card planner-task-dialog" role="dialog" aria-modal="true" aria-labelledby="planner-task-title">
        <div className="dialog-heading"><div><p className="eyebrow">STUDY PLANNER</p><h2 id="planner-task-title">{initial ? "Edit study task" : "Plan a study task"}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
        <form onSubmit={submit}>
          <label className="field-label">Task title<input autoFocus maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Revise transport layer" required /></label>
          <label className="field-label">Description <span className="planner-optional">Optional</span><textarea rows={2} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What do you want to finish?" /></label>
          <div className="planner-fields-two">
            <label className="field-label">Subject<select value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setChapterId(""); }}><option value="">No subject</option>{subjects.filter((subject) => !subject.is_archived).map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select></label>
            <label className="field-label">Chapter<select value={chapterId} onChange={(event) => setChapterId(event.target.value)} disabled={!subjectId}><option value="">No chapter</option>{subjectChapters.map((chapter) => <option value={chapter.id} key={chapter.id}>{chapter.title}</option>)}</select></label>
          </div>
          <label className="field-label">Study date<input type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} required /></label>
          <label className="planner-all-day"><input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} /> All-day task (no fixed time)</label>
          {!allDay && <div className="planner-fields-two"><label className="field-label">Start time<input type="time" value={start} onChange={(event) => setStart(event.target.value)} required /></label><label className="field-label">End time<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} required /></label></div>}
          <div className="planner-fields-two"><label className="field-label">Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}>{PRIORITIES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label className="field-label">Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{STATUSES.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label></div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="dialog-actions"><button type="button" className="button button-ghost" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? "Saving..." : initial ? "Save changes" : "Add task"}</button></div>
        </form>
      </section>
    </div>
  );
}

function TaskRow({ task, subject, chapter, onEdit, onDelete, onToggle, onPostpone, overlap = false }) {
  return (
    <article className={cx("planner-task-row", "priority-" + task.priority, task.status === "completed" && "is-complete", overlap && "has-overlap")}>
      <button className={cx("planner-check", task.status === "completed" && "checked")} type="button" aria-label={task.status === "completed" ? "Reopen " + task.title : "Complete " + task.title} onClick={() => onToggle(task)}>{task.status === "completed" && <Check size={12} />}</button>
      <div className="planner-task-copy"><strong>{task.title}</strong><span>{subject?.name || "Personal"}{chapter ? " · " + chapter.title : ""}</span><small>{task.starts_at ? timeLabel(task.starts_at) + " – " + timeLabel(task.ends_at) : "Any time"} · {task.priority} priority</small></div>
      <div className="planner-row-actions"><button type="button" aria-label={"Edit " + task.title} onClick={() => onEdit(task)}><Pencil size={13} /></button>{task.status !== "completed" && <button type="button" aria-label={"Postpone " + task.title} onClick={() => onPostpone(task)}><CalendarDays size={13} /></button>}<button type="button" aria-label={"Delete " + task.title} onClick={() => onDelete(task)}><Trash2 size={13} /></button></div>
      {overlap && <span className="planner-overlap-tag">Overlap</span>}
    </article>
  );
}

export function PlannerPage({ userId }) {
  const [tasks, setTasks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState("week");
  const [anchor, setAnchor] = useState(dayStart(new Date()));
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialog, setDialog] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [postponeTarget, setPostponeTarget] = useState(null);
  const [postponeDate, setPostponeDate] = useState("");
  const [postponeBusy, setPostponeBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 680px)").matches);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 680px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const loadData = useCallback(async () => {
    if (!supabase || !userId) return;
    setLoading(true);
    setLoadError("");
    try {
      const [taskResult, subjectResult, chapterResult] = await Promise.all([
        supabase.from("study_tasks").select("*").order("due_at", { ascending: true, nullsFirst: false }),
        supabase.from("subjects").select("id,name,color,is_archived").order("position", { ascending: true }),
        supabase.from("chapters").select("id,title,subject_id").order("position", { ascending: true }),
      ]);
      if (taskResult.error) throw taskResult.error;
      if (subjectResult.error) throw subjectResult.error;
      if (chapterResult.error) throw chapterResult.error;
      setTasks(taskResult.data || []);
      setSubjects(subjectResult.data || []);
      setChapters(chapterResult.data || []);
    } catch (error) {
      setLoadError(error.message || "Could not load your study plan.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    return tasks.filter((task) => {
      if (subjectFilter !== "all" && task.subject_id !== subjectFilter) return false;
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (!text) return true;
      const subject = subjects.find((item) => item.id === task.subject_id)?.name || "";
      const chapter = chapters.find((item) => item.id === task.chapter_id)?.title || "";
      return [task.title, task.description || "", subject, chapter].some((value) => value.toLocaleLowerCase().includes(text));
    });
  }, [tasks, subjects, chapters, query, subjectFilter, statusFilter]);

  const subjectMap = useMemo(() => Object.fromEntries(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const chapterMap = useMemo(() => Object.fromEntries(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);
  const days = useMemo(() => weekDates(anchor), [anchor]);
  const todayKey = localDateKey(dayStart(new Date()));
  const overdue = filtered.filter((task) => task.status !== "completed" && task.due_at && localDateKey(new Date(task.due_at)) < todayKey);

  async function saveTask(values) {
    if (dialog?.id) {
      const { data, error } = await supabase.from("study_tasks").update(values).eq("id", dialog.id).select().single();
      if (error) throw error;
      setTasks((current) => current.map((task) => task.id === data.id ? data : task));
      setToast("Task updated.");
    } else {
      const { data, error } = await supabase.from("study_tasks").insert({ ...values, user_id: userId }).select().single();
      if (error) throw error;
      setTasks((current) => [...current, data]);
      setToast("Task added.");
    }
  }

  async function toggleTask(task) {
    const status = task.status === "completed" ? "pending" : "completed";
    const { data, error } = await supabase.from("study_tasks").update({ status, completed_at: status === "completed" ? new Date().toISOString() : null }).eq("id", task.id).select().single();
    if (error) return setToast(error.message || "Could not update task.");
    setTasks((current) => current.map((item) => item.id === data.id ? data : item));
  }

  async function deleteTask() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    const { error } = await supabase.from("study_tasks").delete().eq("id", deleteTarget.id);
    if (error) setToast(error.message || "Could not delete task.");
    else { setTasks((current) => current.filter((task) => task.id !== deleteTarget.id)); setDeleteTarget(null); setToast("Task deleted."); }
    setDeleteBusy(false);
  }

  async function postponeTask() {
    if (!postponeTarget || !postponeDate) return;
    setPostponeBusy(true);
    const current = postponeTarget;
    const oldStart = current.starts_at ? new Date(current.starts_at) : null;
    const oldEnd = current.ends_at ? new Date(current.ends_at) : null;
    const oldDue = current.due_at ? new Date(current.due_at) : null;
    const toNewDate = (d) => d ? toIso(postponeDate, pad(d.getHours()) + ":" + pad(d.getMinutes())) : null;
    const updates = { starts_at: toNewDate(oldStart), ends_at: toNewDate(oldEnd), due_at: toNewDate(oldDue) || toIso(postponeDate, "23:59") };
    const { data, error } = await supabase.from("study_tasks").update(updates).eq("id", current.id).select().single();
    if (error) setToast(error.message || "Could not postpone task.");
    else { setTasks((items) => items.map((task) => task.id === data.id ? data : task)); setAnchor(new Date(postponeDate + "T12:00:00")); setPostponeTarget(null); setToast("Task rescheduled."); }
    setPostponeBusy(false);
  }

  const dayTasks = (date) => filtered.filter((task) => sameDay(task.starts_at || task.due_at, date)).sort((a, b) => (a.starts_at || a.due_at || "").localeCompare(b.starts_at || b.due_at || ""));
  const overlaps = (date, task) => {
    if (!task.starts_at || !task.ends_at) return false;
    const events = dayTasks(date).filter((item) => item.starts_at && item.ends_at && item.status !== "completed");
    return events.some((item) => item.id !== task.id && new Date(item.starts_at) < new Date(task.ends_at) && new Date(item.ends_at) > new Date(task.starts_at));
  };

  const navigate = (direction) => {
    const step = mode === "day" || mobile ? 1 : 7;
    setAnchor((date) => shiftDay(date, step * direction));
  };
  const today = () => setAnchor(dayStart(new Date()));

  return (
    <div className="planner-page">
      <section className="planner-header"><div><p className="eyebrow">PLAN WITH PURPOSE</p><h1>Study planner</h1><p>Turn study goals into a realistic timetable.</p></div><button className="button button-primary" type="button" onClick={() => setDialog({})}><Plus size={16} /> Plan a task</button></section>
      <section className="planner-toolbar">
        <div className="planner-date-controls"><button type="button" aria-label="Previous period" onClick={() => navigate(-1)}><ChevronLeft size={17} /></button><button type="button" className="planner-today" onClick={today}>Today</button><button type="button" aria-label="Next period" onClick={() => navigate(1)}><ChevronRight size={17} /></button><strong>{mode === "day" || mobile ? days.find((date) => localDateKey(date) === localDateKey(anchor)) ? anchor.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : "" : days[0].toLocaleDateString([], { month: "short", day: "numeric" }) + " – " + days[6].toLocaleDateString([], { month: "short", day: "numeric" })}</strong></div>
        <div className="planner-mode"><button type="button" className={mode === "day" ? "selected" : ""} onClick={() => setMode("day")}>Day</button><button type="button" className={mode === "week" ? "selected" : ""} onClick={() => setMode("week")}>Week</button></div>
      </section>
      <section className="planner-filterbar">
        <label className="planner-search"><Search size={15} /><input aria-label="Search tasks" placeholder="Search tasks..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <select aria-label="Filter by subject" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}><option value="all">All subjects</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
        <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
      </section>

      {overdue.length > 0 && <section className="planner-overdue"><AlertCircle size={16} /><div><strong>{overdue.length} overdue {overdue.length === 1 ? "task" : "tasks"}</strong><span>Uncompleted tasks past their due date.</span></div><button type="button" onClick={() => setStatusFilter("pending")}>Review</button></section>}
      {loading ? <LoadingState label="Loading your study plan..." /> : loadError ? <ErrorState title="Your study plan could not be loaded" description={loadError} onRetry={loadData} /> : mode === "day" || mobile ? (
        <section className="planner-day">
          <header><strong>{anchor.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</strong><span>{dayTasks(anchor).length} tasks</span></header>
          {dayTasks(anchor).length ? dayTasks(anchor).map((task) => <TaskRow key={task.id} task={task} subject={subjectMap[task.subject_id]} chapter={chapterMap[task.chapter_id]} overlap={overlaps(anchor, task)} onEdit={setDialog} onDelete={setDeleteTarget} onToggle={toggleTask} onPostpone={(item) => { setPostponeTarget(item); setPostponeDate(localDateKey(shiftDay(new Date(item.due_at || Date.now()), 1))); }} />) : <EmptyState icon={CalendarDays} title="Nothing planned for this day" description="Add a task or move to another date." actionLabel="Plan a task" onAction={() => setDialog({})} />}
        </section>
      ) : (
        <section className="planner-week">
          {days.map((date) => {
            const list = dayTasks(date);
            return <article className="planner-week-column" key={localDateKey(date)}>
              <button className="planner-week-date" type="button" onClick={() => { setAnchor(date); setMode("day"); }}><span>{date.toLocaleDateString([], { weekday: "short" })}</span><strong>{date.getDate()}</strong></button>
              <div className="planner-week-items">
                {list.map((task) => <button type="button" key={task.id} className={cx("planner-week-event", "priority-" + task.priority, task.status === "completed" && "is-complete", overlaps(date, task) && "has-overlap")} onClick={() => setDialog(task)}><span>{timeLabel(task.starts_at)}</span><strong>{task.title}</strong>{overlaps(date, task) && <small>Overlap</small>}</button>)}
                {!list.length && <button type="button" className="planner-empty-add" aria-label={"Add task on " + date.toDateString()} onClick={() => setDialog({ date: localDateKey(date) })}><Plus size={14} /></button>}
              </div>
            </article>;
          })}
        </section>
      )}

      {filtered.length > 0 && <section className="planner-all-tasks"><header><h2>All matching tasks</h2><span>{filtered.length}</span></header>{filtered.slice().sort((a, b) => (a.due_at || "").localeCompare(b.due_at || "")).map((task) => <TaskRow key={task.id} task={task} subject={subjectMap[task.subject_id]} chapter={chapterMap[task.chapter_id]} onEdit={setDialog} onDelete={setDeleteTarget} onToggle={toggleTask} onPostpone={(item) => { setPostponeTarget(item); setPostponeDate(localDateKey(shiftDay(new Date(item.due_at || Date.now()), 1))); }} />)}</section>}

      {dialog && <TaskDialog initial={dialog.id ? dialog : null} date={dialog.date ? new Date(dialog.date + "T12:00:00") : anchor} subjects={subjects} chapters={chapters} onClose={() => setDialog(null)} onSave={saveTask} />}
      {deleteTarget && <div className="dialog-backdrop" role="presentation"><section className="dialog-card planner-confirm" role="alertdialog" aria-modal="true" aria-labelledby="planner-delete-title"><h2 id="planner-delete-title">Delete this task?</h2><p>This permanently removes “{deleteTarget.title}” from your planner.</p><div className="dialog-actions"><button className="button button-ghost" type="button" onClick={() => setDeleteTarget(null)}>Cancel</button><button className="button button-danger-solid" type="button" onClick={deleteTask} disabled={deleteBusy}>{deleteBusy ? "Deleting..." : "Delete task"}</button></div></section></div>}
      {postponeTarget && <div className="dialog-backdrop" role="presentation"><section className="dialog-card planner-confirm" role="dialog" aria-modal="true" aria-labelledby="planner-postpone-title"><h2 id="planner-postpone-title">Reschedule task</h2><p>Pick a new date. The task’s local time is preserved.</p><label className="field-label">New date<input type="date" value={postponeDate} onChange={(event) => setPostponeDate(event.target.value)} /></label><div className="dialog-actions"><button className="button button-ghost" type="button" onClick={() => setPostponeTarget(null)}>Cancel</button><button className="button button-primary" type="button" onClick={postponeTask} disabled={postponeBusy}>{postponeBusy ? "Saving..." : "Save date"}</button></div></section></div>}
      {toast && <div className="toast" role="status"><Check size={14} />{toast}</div>}
    </div>
  );
}
