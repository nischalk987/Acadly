import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
  Check,
  ChevronDown,
  CircleAlert,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { EmptyState, ErrorState, LoadingState } from "../ui/Feedback.jsx";

const SUBJECT_COLORS = [
  "#7C3AED",
  "#2563EB",
  "#0891B2",
  "#059669",
  "#D97706",
  "#DB2777",
  "#DC2626",
  "#64748B",
];

const CHAPTER_STATUSES = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

const cx = (...values) => values.filter(Boolean).join(" ");

function SubjectDialog({ initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [color, setColor] = useState(initial?.color || SUBJECT_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a subject name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({ name: name.trim(), description: description.trim() || null, color });
      onClose();
    } catch (saveError) {
      setError(saveError.message || "Could not save this subject.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dialog-card subject-dialog" role="dialog" aria-modal="true" aria-labelledby="subject-dialog-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">YOUR LEARNING SPACE</p><h2 id="subject-dialog-title">{initial ? "Edit subject" : "Create a subject"}</h2></div>
          <button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="field-label">Subject name
            <input autoFocus maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Computer Networks" required />
          </label>
          <label className="field-label">Description <span className="optional-label">Optional</span>
            <textarea maxLength={500} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are you learning in this subject?" />
          </label>
          <fieldset className="subject-color-field">
            <legend>Choose a color</legend>
            <div className="subject-color-options">
              {SUBJECT_COLORS.map((value) => (
                <button key={value} type="button" aria-label={"Choose color " + value} aria-pressed={color === value} className={cx("subject-color-swatch", color === value && "subject-color-selected")} style={{ "--subject-color": value }} onClick={() => setColor(value)} />
              ))}
            </div>
          </fieldset>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={busy}>{busy ? "Saving..." : initial ? "Save changes" : "Create subject"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ChapterDialog({ initial, subjectId, userId, onClose, onSave }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [status, setStatus] = useState(initial?.status || "not_started");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Enter a chapter title.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        status,
        subject_id: subjectId,
        user_id: userId,
      });
      onClose();
    } catch (saveError) {
      setError(saveError.message || "Could not save this chapter.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="chapter-dialog-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">SUBJECT CHAPTER</p><h2 id="chapter-dialog-title">{initial ? "Edit chapter" : "Add a chapter"}</h2></div>
          <button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label className="field-label">Chapter name
            <input autoFocus maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Transport Layer" required />
          </label>
          <label className="field-label">Description <span className="optional-label">Optional</span>
            <textarea rows={3} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a short note about this chapter" />
          </label>
          <label className="field-label">Progress
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {CHAPTER_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="button button-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={busy}>{busy ? "Saving..." : initial ? "Save chapter" : "Add chapter"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DeleteDialog({ title, description, onClose, onConfirm, busy }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="dialog-card delete-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
        <div className="delete-confirm-icon"><CircleAlert size={21} /></div>
        <h2 id="delete-title">{title}</h2>
        <p>{description}</p>
        <div className="dialog-actions">
          <button className="button button-ghost" type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="button button-danger-solid" type="button" onClick={onConfirm} disabled={busy}>{busy ? "Deleting..." : "Delete"}</button>
        </div>
      </section>
    </div>
  );
}

function ChapterRow({ chapter, index, total, onEdit, onDelete, onStatus, onMove }) {
  const status = CHAPTER_STATUSES.find((item) => item.value === chapter.status) || CHAPTER_STATUSES[0];
  return (
    <div className="chapter-row">
      <div className="chapter-order-controls">
        <GripVertical size={14} aria-hidden="true" />
        <div>
          <button type="button" aria-label={"Move " + chapter.title + " up"} disabled={index === 0} onClick={() => onMove(index, index - 1)}>⌃</button>
          <button type="button" aria-label={"Move " + chapter.title + " down"} disabled={index === total - 1} onClick={() => onMove(index, index + 1)}>⌄</button>
        </div>
      </div>
      <span className={cx("chapter-status-dot", "chapter-status-" + chapter.status)} />
      <div className="chapter-row-copy">
        <strong>{chapter.title}</strong>
        {chapter.description && <small>{chapter.description}</small>}
      </div>
      <select aria-label={"Status for " + chapter.title} className={cx("chapter-status-select", "chapter-status-select-" + chapter.status)} value={chapter.status} onChange={(event) => onStatus(chapter, event.target.value)}>
        {CHAPTER_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <div className="chapter-row-actions">
        <button type="button" aria-label={"Edit " + chapter.title} onClick={() => onEdit(chapter)}><Pencil size={14} /></button>
        <button type="button" aria-label={"Delete " + chapter.title} onClick={() => onDelete(chapter)}><Trash2 size={14} /></button>
      </div>
      <span className="sr-only">{status.label}</span>
    </div>
  );
}

function SubjectCard({ subject, chapters, expanded, onToggle, onEdit, onArchive, onDelete, onAddChapter, onEditChapter, onDeleteChapter, onStatus, onMoveChapter }) {
  const completed = chapters.filter((chapter) => chapter.status === "completed").length;
  const percent = chapters.length ? Math.round((completed / chapters.length) * 100) : 0;
  return (
    <article className="subject-card">
      <div className="subject-card-top">
        <button className="subject-expand-button" type="button" aria-expanded={expanded} onClick={onToggle}>
          <span className="subject-color-mark" style={{ "--subject-color": subject.color }} />
          <span className="subject-card-title"><strong>{subject.name}</strong><small>{chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}</small></span>
          <ChevronDown className={cx("subject-chevron", expanded && "subject-chevron-open")} size={17} />
        </button>
        <div className="subject-card-tools">
          <span className="subject-progress-label">{percent}% complete</span>
          <button type="button" aria-label={"Edit " + subject.name} onClick={() => onEdit(subject)}><Pencil size={14} /></button>
          <button type="button" aria-label={"Archive " + subject.name} onClick={() => onArchive(subject)}><Archive size={14} /></button>
          <button type="button" aria-label={"Delete " + subject.name} onClick={() => onDelete(subject)}><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="subject-progress-track"><span style={{ width: String(percent) + "%", background: subject.color }} /></div>
      {subject.description && <p className="subject-description">{subject.description}</p>}
      {expanded && (
        <div className="subject-chapters">
          <div className="subject-chapters-heading"><strong>Chapters</strong><button type="button" className="text-button" onClick={() => onAddChapter(subject)}><Plus size={14} /> Add chapter</button></div>
          {chapters.length ? chapters.map((chapter, index) => (
            <ChapterRow
              key={chapter.id}
              chapter={chapter}
              index={index}
              total={chapters.length}
              onEdit={onEditChapter}
              onDelete={onDeleteChapter}
              onStatus={onStatus}
              onMove={onMoveChapter}
            />
          )) : <p className="chapter-empty">No chapters yet. Add the first one to start tracking progress.</p>}
        </div>
      )}
    </article>
  );
}

export function SubjectsPage({ userId, onProgressChange }) {
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [expandedIds, setExpandedIds] = useState([]);
  const [searchFilter, setSearchFilter] = useState("all");
  const [subjectDialog, setSubjectDialog] = useState(null);
  const [chapterDialog, setChapterDialog] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState("");

  async function loadData() {
    if (!supabase || !userId) return;
    setLoading(true);
    setLoadError("");
    try {
      const [subjectResult, chapterResult] = await Promise.all([
        supabase.from("subjects").select("*").order("position", { ascending: true }).order("name", { ascending: true }),
        supabase.from("chapters").select("*").order("position", { ascending: true }).order("created_at", { ascending: true }),
      ]);
      if (subjectResult.error) throw subjectResult.error;
      if (chapterResult.error) throw chapterResult.error;
      setSubjects(subjectResult.data || []);
      setChapters(chapterResult.data || []);
      onProgressChange?.(subjectResult.data || [], chapterResult.data || []);
    } catch (error) {
      setLoadError(error.message || "Could not load your subjects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [userId]);

  const filteredSubjects = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return subjects.filter((subject) => {
      if (filter === "active" && subject.is_archived) return false;
      if (filter === "archived" && !subject.is_archived) return false;
      if (searchFilter === "incomplete" && !chapters.some((chapter) => chapter.subject_id === subject.id && chapter.status !== "completed")) return false;
      if (searchFilter === "completed" && !chapters.some((chapter) => chapter.subject_id === subject.id && chapter.status === "completed")) return false;
      if (normalized) {
        const relatedChapters = chapters.filter((chapter) => chapter.subject_id === subject.id);
        const matches = subject.name.toLocaleLowerCase().includes(normalized)
          || (subject.description || "").toLocaleLowerCase().includes(normalized)
          || relatedChapters.some((chapter) => chapter.title.toLocaleLowerCase().includes(normalized));
        if (!matches) return false;
      }
      return true;
    });
  }, [subjects, chapters, query, filter, searchFilter]);

  async function saveSubject(values) {
    if (subjectDialog?.id) {
      const { data, error } = await supabase.from("subjects").update(values).eq("id", subjectDialog.id).select().single();
      if (error) throw error;
      setSubjects((current) => current.map((item) => item.id === data.id ? data : item));
      setToast("Subject updated.");
    } else {
      const { data, error } = await supabase.from("subjects").insert({
        ...values,
        user_id: userId,
        position: subjects.length,
      }).select().single();
      if (error) throw error;
      setSubjects((current) => [...current, data]);
      setExpandedIds((current) => [...current, data.id]);
      setToast("Subject created.");
    }
    onProgressChange?.(subjects, chapters);
  }

  async function saveChapter(values) {
    if (chapterDialog?.id) {
      const { data, error } = await supabase.from("chapters").update({
        title: values.title,
        description: values.description,
        status: values.status,
      }).eq("id", chapterDialog.id).eq("subject_id", chapterDialog.subject_id).select().single();
      if (error) throw error;
      setChapters((current) => current.map((item) => item.id === data.id ? data : item));
      setToast("Chapter updated.");
    } else {
      const { data, error } = await supabase.from("chapters").insert({
        ...values,
        position: chapters.filter((item) => item.subject_id === values.subject_id).length,
      }).select().single();
      if (error) throw error;
      setChapters((current) => [...current, data]);
      setToast("Chapter added.");
    }
    setExpandedIds((current) => current.includes(values.subject_id) ? current : [...current, values.subject_id]);
  }

  async function updateChapterStatus(chapter, status) {
    const { data, error } = await supabase.from("chapters").update({ status }).eq("id", chapter.id).eq("subject_id", chapter.subject_id).select().single();
    if (error) {
      setToast(error.message || "Could not update chapter status.");
      return;
    }
    setChapters((current) => current.map((item) => item.id === data.id ? data : item));
  }

  async function moveChapter(subjectId, from, to) {
    const list = chapters.filter((chapter) => chapter.subject_id === subjectId).sort((a, b) => a.position - b.position);
    if (to < 0 || to >= list.length) return;
    const reordered = [...list];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const updated = reordered.map((chapter, index) => ({ ...chapter, position: index }));
    setChapters((current) => current.map((chapter) => updated.find((item) => item.id === chapter.id) || chapter));
    try {
      for (const chapter of updated) {
        const { error } = await supabase.from("chapters").update({ position: chapter.position }).eq("id", chapter.id).eq("subject_id", subjectId);
        if (error) throw error;
      }
      setToast("Chapter order saved.");
    } catch (error) {
      setToast(error.message || "Could not save chapter order.");
      loadData();
    }
  }

  async function archiveSubject(subject) {
    const { data, error } = await supabase.from("subjects").update({ is_archived: !subject.is_archived }).eq("id", subject.id).select().single();
    if (error) {
      setToast(error.message || "Could not update archive status.");
      return;
    }
    setSubjects((current) => current.map((item) => item.id === data.id ? data : item));
    setToast(data.is_archived ? "Subject archived." : "Subject restored.");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      if (deleteTarget.kind === "subject") {
        const { error } = await supabase.from("subjects").delete().eq("id", deleteTarget.record.id);
        if (error) throw error;
        setChapters((current) => current.filter((chapter) => chapter.subject_id !== deleteTarget.record.id));
        setSubjects((current) => current.filter((subject) => subject.id !== deleteTarget.record.id));
        setToast("Subject and its chapters deleted.");
      } else {
        const { error } = await supabase.from("chapters").delete().eq("id", deleteTarget.record.id).eq("subject_id", deleteTarget.record.subject_id);
        if (error) throw error;
        setChapters((current) => current.filter((chapter) => chapter.id !== deleteTarget.record.id));
        setToast("Chapter deleted.");
      }
      setDeleteTarget(null);
    } catch (error) {
      setToast(error.message || "Could not delete this item.");
    } finally {
      setDeleteBusy(false);
    }
  }


  return (
    <div className="subjects-page">
      <section className="subjects-page-heading">
        <div><p className="eyebrow">YOUR LEARNING SPACE</p><h1>Subjects & chapters</h1><p>Organize your courses, track chapter progress, and keep your learning structured.</p></div>
        <button className="button button-primary" type="button" onClick={() => setSubjectDialog({})}><Plus size={16} /> Add subject</button>
      </section>

      <section className="subjects-summary-grid">
        <article className="subjects-summary-card"><span>Subjects</span><strong>{subjects.filter((subject) => !subject.is_archived).length}</strong><small>Active courses</small></article>
        <article className="subjects-summary-card"><span>Total chapters</span><strong>{chapters.length}</strong><small>Across all subjects</small></article>
        <article className="subjects-summary-card"><span>Completed</span><strong>{chapters.filter((chapter) => chapter.status === "completed").length}</strong><small>Chapters completed</small></article>
        <article className="subjects-summary-card"><span>In progress</span><strong>{chapters.filter((chapter) => chapter.status === "in_progress").length}</strong><small>Currently learning</small></article>
      </section>

      <section className="subjects-toolbar">
        <label className="subjects-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subjects or chapters..." aria-label="Search subjects or chapters" /></label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter subjects">
          <option value="active">Active subjects</option>
          <option value="archived">Archived subjects</option>
          <option value="all">All subjects</option>
        </select>
        <select value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} aria-label="Filter by chapter progress">
          <option value="all">All progress</option>
          <option value="incomplete">Has unfinished chapters</option>
          <option value="completed">Has completed chapters</option>
        </select>
      </section>

      {loading ? <LoadingState label="Loading your subjects..." /> : loadError ? <ErrorState title="Subjects could not be loaded" description={loadError} onRetry={loadData} /> : filteredSubjects.length === 0 ? (
        <EmptyState icon={BookOpen} title={query ? "No matching subjects" : filter === "archived" ? "No archived subjects" : "Your learning space is empty"} description={query ? "Try a different search term." : "Create your first subject, then add chapters to track your progress."} actionLabel={!query && filter !== "archived" ? "Create a subject" : undefined} onAction={() => setSubjectDialog({})} />
      ) : (
        <div className="subjects-list">
          {filteredSubjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              chapters={chapters.filter((chapter) => chapter.subject_id === subject.id).sort((a, b) => a.position - b.position)}
              expanded={expandedIds.includes(subject.id) || Boolean(query)}
              onToggle={() => setExpandedIds((current) => current.includes(subject.id) ? current.filter((id) => id !== subject.id) : [...current, subject.id])}
              onEdit={(item) => setSubjectDialog(item)}
              onArchive={archiveSubject}
              onDelete={(item) => setDeleteTarget({ kind: "subject", record: item })}
              onAddChapter={(item) => setChapterDialog({ subject_id: item.id })}
              onEditChapter={(item) => setChapterDialog(item)}
              onDeleteChapter={(item) => setDeleteTarget({ kind: "chapter", record: item })}
              onStatus={updateChapterStatus}
              onMoveChapter={(from, to) => moveChapter(subject.id, from, to)}
            />
          ))}
        </div>
      )}

      {subjectDialog && <SubjectDialog initial={subjectDialog.id ? subjectDialog : null} onClose={() => setSubjectDialog(null)} onSave={saveSubject} />}
      {chapterDialog && <ChapterDialog initial={chapterDialog.id ? chapterDialog : null} subjectId={chapterDialog.subject_id} userId={userId} onClose={() => setChapterDialog(null)} onSave={saveChapter} />}
      {deleteTarget && <DeleteDialog
        title={deleteTarget.kind === "subject" ? "Delete this subject?" : "Delete this chapter?"}
        description={deleteTarget.kind === "subject" ? "This permanently deletes the subject and its chapters. Other records keep their own data according to the configured deletion rules." : "This permanently deletes the chapter. Linked revision records follow the configured cascade behavior."}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        busy={deleteBusy}
      />}
      {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
    </div>
  );
}
