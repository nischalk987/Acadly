import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, CheckCircle2, Clock3, Pause, Play, RotateCcw, Settings2, SkipForward } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { EmptyState, ErrorState, LoadingState } from "../ui/Feedback.jsx";

const STORAGE_KEY = "acadly.focus.v1";
const DEFAULTS = { focus_minutes: 25, short_break_minutes: 5, long_break_minutes: 15 };
const pad = (value) => String(value).padStart(2, "0");
const formatTime = (seconds) => pad(Math.floor(seconds / 60)) + ":" + pad(seconds % 60);
const safeNumber = (value, fallback) => Number.isFinite(Number(value)) ? Math.min(180, Math.max(1, Number(value))) : fallback;
const readSaved = (userId) => {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return value?.userId === userId ? value : null;
  } catch { return null; }
};

export function FocusPage({ userId }) {
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [mode, setMode] = useState("focus");
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [deadline, setDeadline] = useState(null);
  const [pausedRemaining, setPausedRemaining] = useState(null);
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [focusCount, setFocusCount] = useState(0);
  const [toast, setToast] = useState("");
  const [notificationPermission, setNotificationPermission] = useState(() => ("Notification" in window ? Notification.permission : "unsupported"));
  const [showSettings, setShowSettings] = useState(false);
  const [draftPreferences, setDraftPreferences] = useState(DEFAULTS);
  const completionLock = useRef(false);
  const sessionStart = useRef(null);
  const completionEnd = useRef(null);

  const durationFor = useCallback((timerMode, prefs = preferences) => {
    const minutes = timerMode === "focus" ? prefs.focus_minutes : timerMode === "short_break" ? prefs.short_break_minutes : prefs.long_break_minutes;
    return safeNumber(minutes, DEFAULTS.focus_minutes) * 60;
  }, [preferences]);

  const storeState = useCallback((next) => {
    if (!userId) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, ...next })); } catch { setToast("Timer state could not be saved in this browser."); }
  }, [userId]);

  const loadData = useCallback(async () => {
    if (!supabase || !userId) { setLoadError("Authentication or database connection is unavailable."); setLoading(false); return; }
    setLoading(true); setLoadError("");
    try {
      const [pref, subjectRows, chapterRows, sessions] = await Promise.all([
        supabase.from("user_preferences").select("focus_minutes,short_break_minutes,long_break_minutes").eq("user_id", userId).maybeSingle(),
        supabase.from("subjects").select("id,name,is_archived").order("position"),
        supabase.from("chapters").select("id,title,subject_id").order("position"),
        supabase.from("study_sessions").select("id,session_type,started_at,ended_at,duration_seconds,completed,subject_id,chapter_id").eq("session_type", "focus").eq("completed", true).order("ended_at", { ascending: false }).limit(30),
      ]);
      if (pref.error) throw pref.error;
      if (subjectRows.error) throw subjectRows.error;
      if (chapterRows.error) throw chapterRows.error;
      if (sessions.error) throw sessions.error;
      const nextPrefs = { focus_minutes: safeNumber(pref.data?.focus_minutes, 25), short_break_minutes: safeNumber(pref.data?.short_break_minutes, 5), long_break_minutes: safeNumber(pref.data?.long_break_minutes, 15) };
      setPreferences(nextPrefs); setDraftPreferences(nextPrefs);
      setSubjects(subjectRows.data || []); setChapters(chapterRows.data || []); setHistory(sessions.data || []);
      const saved = readSaved(userId);
      if (saved) {
        const savedMode = ["focus", "short_break", "long_break"].includes(saved.mode) ? saved.mode : "focus";
        setMode(savedMode);
        setSubjectId(saved.subjectId || "");
        setChapterId(saved.chapterId || "");
        setFocusCount(Number(saved.focusCount) || 0);
        if (saved.running && saved.deadline) {
          const left = Math.max(0, Math.ceil((saved.deadline - Date.now()) / 1000));
          setRemaining(left); setRunning(left > 0); setDeadline(left > 0 ? saved.deadline : null); setPausedRemaining(null);
          if (!left) setToast("Your timer ended while Acadly was closed. Complete or reset the session when ready.");
        } else {
          const left = Math.max(0, Number(saved.remaining) || durationFor(savedMode, nextPrefs));
          setRemaining(left); setRunning(false); setDeadline(null); setPausedRemaining(left);
        }
        sessionStart.current = saved.sessionStartedAt || null;
      } else {
        setRemaining(nextPrefs.focus_minutes * 60); setMode("focus"); setRunning(false); setDeadline(null); setPausedRemaining(null);
      }
    } catch (error) { setLoadError(error.message || "Could not load focus settings and history."); }
    finally { setLoading(false); }
  }, [userId, durationFor]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!running || !deadline) return undefined;
    const update = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) setRunning(false);
    };
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [running, deadline]);

  useEffect(() => {
    storeState({ mode, remaining, running, deadline, pausedRemaining, subjectId, chapterId, focusCount, sessionStartedAt: sessionStart.current, completionEnd: completionEnd.current });
  }, [storeState, mode, remaining, running, deadline, pausedRemaining, subjectId, chapterId, focusCount]);

  useEffect(() => {
    if (remaining !== 0 || running || completionLock.current) return;
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(mode === "focus" ? "Focus session finished" : "Break finished", { body: mode === "focus" ? "Nice work. Record your completed focus session in Acadly." : "Your break is over. Ready to focus again?" });
    }
    setToast(mode === "focus" ? "Focus time is complete. Save your session to your study history." : "Break complete. Take a breath and continue when ready.");
  }, [remaining, running, mode]);

  const currentDuration = durationFor(mode);
  const elapsed = Math.max(0, currentDuration - remaining);
  const progress = Math.min(100, currentDuration ? (elapsed / currentDuration) * 100 : 0);
  const selectedSubject = subjects.find((item) => item.id === subjectId);
  const availableChapters = chapters.filter((item) => item.subject_id === subjectId);

  const startTimer = () => {
    if (remaining <= 0) return;
    if (mode === "focus" && !sessionStart.current) sessionStart.current = new Date().toISOString();\n    completionEnd.current = null;
    const end = Date.now() + remaining * 1000;
    setDeadline(end); setPausedRemaining(null); setRunning(true);
  };

  const pauseTimer = () => {
    const left = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : remaining;
    setRemaining(left); setPausedRemaining(left); setDeadline(null); setRunning(false);
  };

  const resetTimer = () => {
    setRunning(false); setDeadline(null); setPausedRemaining(null); sessionStart.current = null;
    completionLock.current = false;
    setRemaining(durationFor(mode));
  };

  const selectMode = (nextMode) => {
    setMode(nextMode); setRunning(false); setDeadline(null); setPausedRemaining(null); sessionStart.current = null; completionLock.current = false;
    setRemaining(durationFor(nextMode));
  };

  const completeFocus = async () => {
    if (mode !== "focus" || remaining > 0 || completionLock.current) return;
    completionLock.current = true;
    const start = sessionStart.current ? new Date(sessionStart.current) : new Date(Date.now() - durationFor("focus") * 1000);
    const endedAt = completionEnd.current || new Date().toISOString();
    const durationSeconds = Math.max(0, Math.min(durationFor("focus"), Math.round((Date.parse(endedAt) - start.getTime()) / 1000)));
    const { data, error } = await supabase.from("study_sessions").insert({
      user_id: userId,
      subject_id: subjectId || null,
      chapter_id: chapterId || null,
      session_type: "focus",
      started_at: start.toISOString(),
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      completed: true,
    }).select("id,session_type,started_at,ended_at,duration_seconds,completed,subject_id,chapter_id").single();
    if (error) {
      completionLock.current = false;
      setToast(error.message || "Could not save this focus session. Try again.");
      return;
    }
    setHistory((items) => [data, ...items].slice(0, 30));
    setFocusCount((count) => count + 1);
    sessionStart.current = null;
    setToast("Focus session saved to your study history.");
    selectMode("short_break");
  };

  const savePreferences = async (event) => {
    event.preventDefault();
    const next = {
      focus_minutes: safeNumber(draftPreferences.focus_minutes, 25),
      short_break_minutes: safeNumber(draftPreferences.short_break_minutes, 5),
      long_break_minutes: safeNumber(draftPreferences.long_break_minutes, 15),
    };
    setSavingSettings(true);
    const { error } = await supabase.from("user_preferences").upsert({ user_id: userId, ...next }, { onConflict: "user_id" });
    if (error) setToast(error.message || "Could not save timer settings.");
    else {
      setPreferences(next); setDraftPreferences(next);
      if (!running && remaining === durationFor(mode)) { setRemaining(durationFor(mode, next)); setPausedRemaining(null); }
      setToast("Timer preferences saved.");
      setShowSettings(false);
    }
    setSavingSettings(false);
  };

  const enableNotifications = async () => {
    if (!("Notification" in window)) return setToast("This browser does not support notifications.");
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setToast(permission === "granted" ? "Focus notifications enabled." : "Notification permission was not granted.");
  };

  const historyMinutes = useMemo(() => history.reduce((total, item) => total + (item.duration_seconds || 0), 0) / 60, [history]);
  const percent = Math.round(progress);

  return (
    <div className="focus-page">
      <section className="focus-header"><div><p className="eyebrow">MAKE SPACE TO FOCUS</p><h1>Focus room</h1><p>One distraction-free session at a time.</p></div><button type="button" className="button button-ghost focus-settings-button" onClick={() => setShowSettings((value) => !value)}><Settings2 size={15} /> Timer settings</button></section>
      {loading ? <LoadingState label="Loading your focus room..." /> : loadError ? <ErrorState title="Focus room unavailable" description={loadError} onRetry={loadData} /> : <>
        <section className="focus-layout">
          <article className="focus-timer-card">
            <div className="focus-mode-tabs"><button type="button" className={mode === "focus" ? "selected" : ""} onClick={() => selectMode("focus")}>Focus</button><button type="button" className={mode === "short_break" ? "selected" : ""} onClick={() => selectMode("short_break")}>Short break</button><button type="button" className={mode === "long_break" ? "selected" : ""} onClick={() => selectMode("long_break")}>Long break</button></div>
            <div className="focus-clock-wrap">
              <svg className="focus-progress" viewBox="0 0 240 240" role="img" aria-label={Math.floor(remaining / 60) + " minutes " + remaining % 60 + " seconds remaining"}>
                <circle cx="120" cy="120" r="103" className="focus-progress-track" />
                <circle cx="120" cy="120" r="103" className="focus-progress-value" strokeDasharray={2 * Math.PI * 103} strokeDashoffset={2 * Math.PI * 103 * (1 - progress / 100)} />
              </svg>
              <div className="focus-clock"><strong>{formatTime(remaining)}</strong><span>{mode === "focus" ? "FOCUS SESSION" : mode === "short_break" ? "SHORT BREAK" : "LONG BREAK"}</span><small>{running ? "IN PROGRESS" : remaining === 0 ? "TIME COMPLETE" : pausedRemaining !== null ? "PAUSED" : "READY"}</small></div>
            </div>
            <div className="focus-controls">
              {!running && remaining > 0 ? <button className="button button-primary" type="button" onClick={startTimer}><Play size={15} /> {pausedRemaining !== null ? "Resume" : "Start focus"}</button> : running ? <button className="button button-primary" type="button" onClick={pauseTimer}><Pause size={15} /> Pause</button> : mode === "focus" ? <button className="button button-primary" type="button" onClick={completeFocus} disabled={completionLock.current}><CheckCircle2 size={15} /> Save completed session</button> : <button className="button button-primary" type="button" onClick={() => selectMode("focus")}><Play size={15} /> Start focus</button>}
              <button className="button button-ghost" type="button" onClick={resetTimer}><RotateCcw size={15} /> Reset</button>
            </div>
            {mode === "focus" && <div className="focus-context"><label className="field-label">Study subject<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} disabled={running}><option value="">No subject selected</option>{subjects.filter((subject) => !subject.is_archived).map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label className="field-label">Chapter<select value={chapterId} onChange={(event) => setChapterId(event.target.value)} disabled={!subjectId || running}><option value="">No chapter selected</option>{availableChapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label></div>}
            <div className="focus-footer-stats"><span><Clock3 size={13} /> {preferences.focus_minutes} min focus</span><span><CheckCircle2 size={13} /> {focusCount} saved this visit</span></div>
          </article>
          <aside className="focus-side-column">
            <article className="focus-tip-card"><div><span className="focus-tip-icon"><CheckCircle2 size={16} /></span><span className="eyebrow">FOCUS RHYTHM</span></div><h2>Progress over perfection.</h2><p>Give one task your full attention. A short break after focus time helps you reset before the next session.</p><button type="button" className="focus-notification" onClick={enableNotifications}>{notificationPermission === "granted" ? <Bell size={14} /> : <BellOff size={14} />}{notificationPermission === "granted" ? "Notifications enabled" : "Enable browser notifications"}</button><small>Notifications are optional and only requested after you press the button.</small></article>
            <article className="focus-history-card"><header><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Focus history</h2></div><strong>{Math.floor(historyMinutes)} min</strong></header>
              {history.length ? <div className="focus-history-list">{history.slice(0, 8).map((item) => <div className="focus-history-row" key={item.id}><span className="history-check"><CheckCircle2 size={13} /></span><div><strong>{Math.round(item.duration_seconds / 60)} min focus</strong><small>{new Date(item.started_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</small></div></div>)}</div> : <EmptyState title="No focus sessions yet" description="Complete your first focus session to start building your study history." />}
            </article>
          </aside>
        </section>
        {showSettings && <section className="focus-settings-panel"><header><div><p className="eyebrow">YOUR POMODORO</p><h2>Timer durations</h2></div><button type="button" className="icon-button" aria-label="Close timer settings" onClick={() => setShowSettings(false)}><X size={17} /></button></header>
          <form onSubmit={savePreferences}><div className="focus-duration-grid">{[["focus_minutes", "Focus", "Minutes of deep work"], ["short_break_minutes", "Short break", "Quick reset"], ["long_break_minutes", "Long break", "Longer recharge"]].map(([key, label, hint]) => <label key={key}><span>{label}</span><small>{hint}</small><input type="number" min="1" max="180" value={draftPreferences[key]} onChange={(event) => setDraftPreferences((old) => ({ ...old, [key]: event.target.value }))} required /></label>)}</div><div className="dialog-actions"><button type="button" className="button button-ghost" onClick={() => setShowSettings(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={savingSettings}>{savingSettings ? "Saving..." : "Save durations"}</button></div></form>
        </section>}
      </>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
