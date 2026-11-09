import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Download, Eye, FileImage, FileText, FolderOpen, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Trash2, UploadCloud, X } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { EmptyState, ErrorState, LoadingState } from "../ui/Feedback.jsx";

const BUCKET = "student-notes";
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const FAIR_USE_BYTES = 500 * 1024 * 1024;
const ACCEPTED = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};
const formatBytes = (bytes) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};
const cleanFileName = (name) => name.normalize("NFKC").replace(/[^\w.\- ()]/g, "_").replace(/\s+/g, " ").slice(0, 120);
const extOf = (name) => name.slice(name.lastIndexOf(".")).toLowerCase();
const typeFromFile = (file) => {
  if (file.type && Object.hasOwn(ACCEPTED, file.type)) return file.type;
  const extension = extOf(file.name);
  return Object.entries(ACCEPTED).find(([, extensions]) => extensions.includes(extension))?.[0] || "";
};
const isSafePath = (path, userId) => typeof path === "string" && path.startsWith(userId + "/") && !path.includes("..");

function fileIcon(mime) {
  if (mime === "application/pdf") return FileText;
  if (mime?.startsWith("image/")) return FileImage;
  return FileText;
}

function NoteDialog({ note, subjects, chapters, onClose, onSave }) {
  const [title, setTitle] = useState(note?.title || "");
  const [subjectId, setSubjectId] = useState(note?.subject_id || "");
  const [chapterId, setChapterId] = useState(note?.chapter_id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options = chapters.filter((chapter) => chapter.subject_id === subjectId);
  async function submit(event) {
    event.preventDefault();
    if (!title.trim()) return setError("Enter a note name.");
    setBusy(true); setError("");
    try { await onSave({ title: title.trim(), subject_id: subjectId || null, chapter_id: chapterId || null }); onClose(); }
    catch (err) { setError(err.message || "Could not save note details."); }
    finally { setBusy(false); }
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="dialog-card notes-dialog" role="dialog" aria-modal="true" aria-labelledby="note-edit-title">
      <div className="dialog-heading"><div><p className="eyebrow">YOUR LIBRARY</p><h2 id="note-edit-title">{note ? "Edit file details" : "New note"}</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
      <form onSubmit={submit}>
        <label className="field-label">Name<input autoFocus maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
        <div className="notes-fields-two">
          <label className="field-label">Subject<select value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setChapterId(""); }}><option value="">No subject</option>{subjects.filter((s) => !s.is_archived).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="field-label">Chapter<select value={chapterId} onChange={(event) => setChapterId(event.target.value)} disabled={!subjectId}><option value="">No chapter</option>{options.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="dialog-actions"><button className="button button-ghost" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Saving..." : "Save details"}</button></div>
      </form>
    </section>
  </div>;
}

function PreviewDialog({ note, signedUrl, onClose }) {
  const pdf = note.mime_type === "application/pdf";
  return <div className="dialog-backdrop notes-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="notes-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="notes-preview-title">
      <header><div><p className="eyebrow">PRIVATE PREVIEW</p><h2 id="notes-preview-title">{note.title}</h2></div><button className="icon-button" type="button" aria-label="Close preview" onClick={onClose}><X size={18}/></button></header>
      {pdf ? <iframe title={"PDF preview: " + note.title} src={signedUrl} /> : note.mime_type?.startsWith("image/") ? <img src={signedUrl} alt={note.title} /> : <pre>{note.content || "No text content is available."}</pre>}
    </section>
  </div>;
}

export function NotesPage({ userId }) {
  const [notes, setNotes] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [editNote, setEditNote] = useState(null);
  const [preview, setPreview] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [dragging, setDragging] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [replaceBusy, setReplaceBusy] = useState(false);
  const inputRef = useRef(null);
  const replaceRef = useRef(null);

  const loadData = useCallback(async () => {
    if (!supabase || !userId) return;
    setLoading(true); setLoadError("");
    try {
      const [noteRows, subjectRows, chapterRows] = await Promise.all([
        supabase.from("notes").select("*").order("updated_at", { ascending: false }),
        supabase.from("subjects").select("id,name,is_archived").order("position"),
        supabase.from("chapters").select("id,title,subject_id").order("position"),
      ]);
      if (noteRows.error) throw noteRows.error;
      if (subjectRows.error) throw subjectRows.error;
      if (chapterRows.error) throw chapterRows.error;
      setNotes(noteRows.data || []); setSubjects(subjectRows.data || []); setChapters(chapterRows.data || []);
    } catch (error) { setLoadError(error.message || "Could not load your notes."); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);
  const chapterMap = useMemo(() => Object.fromEntries(chapters.map((c) => [c.id, c])), [chapters]);
  const usedBytes = notes.reduce((sum, note) => sum + (Number(note.file_size_bytes) || 0), 0);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return notes.filter((note) => {
      if (subjectFilter !== "all" && note.subject_id !== subjectFilter) return false;
      if (!term) return true;
      const subject = subjectMap[note.subject_id]?.name || "";
      const chapter = chapterMap[note.chapter_id]?.title || "";
      return [note.title, note.file_name || "", note.content || "", subject, chapter].some((v) => v.toLocaleLowerCase().includes(term));
    });
  }, [notes, query, subjectFilter, subjectMap, chapterMap]);

  async function uploadFile(file, targetNote = null) {
    setUploadError("");
    const mime = typeFromFile(file);
    if (!mime) throw new Error("Unsupported file type. Upload PDF, TXT, PNG or JPG files.");
    if (file.size <= 0) throw new Error("This file is empty.");
    if (file.size > MAX_FILE_BYTES) throw new Error("Files must be 20 MB or smaller.");
    const currentUsage = usedBytes - (targetNote?.file_size_bytes || 0);
    if (currentUsage + file.size > FAIR_USE_BYTES) throw new Error("You have reached Acadly's 500 MB per-student fair-use guideline. Delete files you no longer need to continue.");
    const originalName = cleanFileName(file.name);
    if (!originalName || originalName.startsWith(".")) throw new Error("This filename is not supported.");
    const path = userId + "/" + crypto.randomUUID() + extOf(originalName);
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: mime, upsert: false });
    if (uploadError) throw uploadError;
    setUploadProgress(100);
    const metadata = {
      user_id: userId,
      title: targetNote?.title || originalName,
      subject_id: targetNote?.subject_id || null,
      chapter_id: targetNote?.chapter_id || null,
      file_path: path,
      file_name: originalName,
      mime_type: mime,
      file_size_bytes: file.size,
      content: null,
    };
    if (targetNote) {
      const { data, error } = await supabase.from("notes").update(metadata).eq("id", targetNote.id).select().single();
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
      if (targetNote.file_path && isSafePath(targetNote.file_path, userId)) {
        const { error: removeError } = await supabase.storage.from(BUCKET).remove([targetNote.file_path]);
        if (removeError) setToast("Replacement saved. Old file cleanup needs another attempt: " + removeError.message);
      }
      setNotes((rows) => rows.map((row) => row.id === data.id ? data : row));
      setToast("File replaced.");
    } else {
      const { data, error } = await supabase.from("notes").insert(metadata).select().single();
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
      setNotes((rows) => [data, ...rows]);
      setToast("File uploaded to your private library.");
    }
  }

  async function handleFiles(files, target = null) {
    const file = files?.[0];
    if (!file) return;
    setUploadBusy(true); setUploadProgress(0); setUploadError("");
    try { await uploadFile(file, target); }
    catch (error) { setUploadError(error.message || "Upload failed. Please retry."); }
    finally { setUploadBusy(false); setUploadProgress(0); if (inputRef.current) inputRef.current.value = ""; if (replaceRef.current) replaceRef.current.value = ""; setReplaceTarget(null); }
  }

  async function saveMetadata(values) {
    if (!editNote) return;
    const { data, error } = await supabase.from("notes").update(values).eq("id", editNote.id).select().single();
    if (error) throw error;
    setNotes((rows) => rows.map((row) => row.id === data.id ? data : row));
    setToast("File details updated.");
  }

  async function deleteNote() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    const { error: dbError } = await supabase.from("notes").delete().eq("id", deleteTarget.id);
    if (dbError) { setToast(dbError.message || "Could not delete metadata."); setDeleteBusy(false); return; }
    if (deleteTarget.file_path && isSafePath(deleteTarget.file_path, userId)) {
      const { error: fileError } = await supabase.storage.from(BUCKET).remove([deleteTarget.file_path]);
      if (fileError) {
        setToast("Metadata removed, but the private file could not be deleted. Contact support with this error: " + fileError.message);
      } else setToast("Note and stored file deleted.");
    } else setToast("Note deleted.");
    setNotes((rows) => rows.filter((row) => row.id !== deleteTarget.id));
    setDeleteTarget(null); setDeleteBusy(false);
  }

  async function openPreview(note) {
    if (!note.file_path || !isSafePath(note.file_path, userId)) return setToast("This file path is invalid.");
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(note.file_path, 300);
    if (error) return setToast(error.message || "Could not create a private preview link.");
    setPreview({ note, signedUrl: data.signedUrl });
  }

  async function downloadNote(note) {
    if (!note.file_path || !isSafePath(note.file_path, userId)) return setToast("This file path is invalid.");
    const { data, error } = await supabase.storage.from(BUCKET).download(note.file_path);
    if (error) return setToast(error.message || "Could not download this file.");
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = note.file_name || note.title; anchor.click();
    URL.revokeObjectURL(url);
  }

  async function renameNote(note, nextTitle) {
    const title = window.prompt("New file title", note.title);
    if (title === null || !title.trim()) return;
    const { data, error } = await supabase.from("notes").update({ title: title.trim() }).eq("id", note.id).select().single();
    if (error) return setToast(error.message || "Could not rename this file.");
    setNotes((rows) => rows.map((row) => row.id === data.id ? data : row));
    setToast("File renamed.");
  }

  const accept = Object.values(ACCEPTED).flat().join(",");
  return (
    <div className="notes-page">
      <section className="notes-header"><div><p className="eyebrow">YOUR PRIVATE LIBRARY</p><h1>Notes & PDFs</h1><p>Keep course files organized, searchable and private.</p></div><button className="button button-primary" type="button" onClick={() => inputRef.current?.click()} disabled={uploadBusy}><Plus size={16}/> Upload file</button></section>
      <section className="notes-storage-card"><div><span>YOUR STORAGE</span><strong>{formatBytes(usedBytes)} <small>used</small></strong><p>500 MB per-student fair-use guideline · {formatBytes(FAIR_USE_BYTES - usedBytes)} remaining</p></div><div className="notes-storage-bar"><span style={{ width: Math.min(100, usedBytes / FAIR_USE_BYTES * 100) + "%" }}/></div></section>
      <section className={cx("notes-dropzone", dragging && "dragging", uploadBusy && "uploading")} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); handleFiles(event.dataTransfer.files); }}>
        <UploadCloud size={24}/><strong>{uploadBusy ? "Uploading your file..." : dragging ? "Drop file to upload" : "Drag and drop a file here"}</strong><span>PDF, TXT, PNG or JPG · up to 20 MB per file</span>
        {uploadBusy && <div className="notes-progress"><span style={{ width: uploadProgress + "%" }}/></div>}
        {uploadError && <p className="notes-error" role="alert"><AlertCircle size={14}/>{uploadError}<button type="button" onClick={() => setUploadError("")}>Dismiss</button></p>}
        <input ref={inputRef} type="file" accept={accept} hidden disabled={uploadBusy} onChange={(event) => handleFiles(event.target.files)}/>
        <input ref={replaceRef} type="file" accept={accept} hidden disabled={uploadBusy} onChange={(event) => handleFiles(event.target.files, replaceTarget)}/>
      </section>
      <section className="notes-toolbar"><label className="notes-search"><Search size={15}/><input aria-label="Search files" placeholder="Search notes, filenames, subjects..." value={query} onChange={(event) => setQuery(event.target.value)}/></label><select aria-label="Filter by subject" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}><option value="all">All subjects</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><button type="button" className="button button-ghost" onClick={loadData}><RefreshCw size={14}/> Refresh</button></section>
      {loading ? <LoadingState label="Loading your private library..."/> : loadError ? <ErrorState title="Your files could not be loaded" description={loadError} onRetry={loadData}/> : filtered.length ? <section className="notes-list">{filtered.map((note) => { const Icon = fileIcon(note.mime_type); return <article className="notes-file-row" key={note.id}><span className="notes-file-icon"><Icon size={18}/></span><div className="notes-file-info"><strong>{note.title}</strong><span>{subjectMap[note.subject_id]?.name || "Unsorted"}{chapterMap[note.chapter_id] ? " · " + chapterMap[note.chapter_id].title : ""}</span><small>{note.file_name || "Text note"} · {formatBytes(Number(note.file_size_bytes) || 0)} · Updated {new Date(note.updated_at).toLocaleDateString()}</small></div><div className="notes-file-actions">{note.file_path && <><button type="button" aria-label={"Preview " + note.title} onClick={() => openPreview(note)}><Eye size={14}/></button><button type="button" aria-label={"Download " + note.title} onClick={() => downloadNote(note)}><Download size={14}/></button><button type="button" aria-label={"Replace " + note.title} onClick={() => { setReplaceTarget(note); replaceRef.current?.click(); }}><RefreshCw size={14}/></button></>}<button type="button" aria-label={"Organize " + note.title} onClick={() => setEditNote(note)}><Pencil size={14}/></button><button type="button" aria-label={"Delete " + note.title} onClick={() => setDeleteTarget(note)}><Trash2 size={14}/></button></div></article>; })}</section> : <EmptyState icon={FolderOpen} title="Your library is empty" description="Upload your first PDF or study file to keep it organized here." actionLabel="Upload a file" onAction={() => inputRef.current?.click()}/>}
      <p className="notes-privacy-note">Files are stored in a private Supabase Storage bucket. Signed preview links expire after 5 minutes. Per-file size is limited to 20 MB. Storage availability depends on the shared free infrastructure quotas; the 500 MB guideline is a per-student fair-use cap, not a guarantee of infrastructure capacity.</p>
      {editNote && <NoteDialog note={editNote} subjects={subjects} chapters={chapters} onClose={() => setEditNote(null)} onSave={saveMetadata}/>}
      {preview && <PreviewDialog note={preview.note} signedUrl={preview.signedUrl} onClose={() => setPreview(null)}/>}
      {deleteTarget && <div className="dialog-backdrop" role="presentation"><section className="dialog-card notes-confirm" role="alertdialog" aria-modal="true" aria-labelledby="notes-delete-title"><h2 id="notes-delete-title">Delete this file?</h2><p>This removes the file metadata and attempts to delete its private Storage object. This cannot be undone.</p><div className="dialog-actions"><button type="button" className="button button-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button><button type="button" className="button button-danger-solid" onClick={deleteNote} disabled={deleteBusy}>{deleteBusy ? "Deleting..." : "Delete file"}</button></div></section></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
