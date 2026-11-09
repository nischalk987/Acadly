import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Check, CheckCheck, Clock3, ExternalLink, Inbox, MoreHorizontal, Settings2, Trash2, X } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { EmptyState, ErrorState, LoadingState } from "./Feedback.jsx";

const pad = (n) => String(n).padStart(2, "0");
const localDate = (date) => date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
const sameLocalDay = (a, b) => localDate(new Date(a)) === localDate(b);
const labelDate = (value) => {
  const date = new Date(value);
  const now = new Date();
  if (sameLocalDay(date, now)) return "Today · " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (sameLocalDay(date, tomorrow)) return "Tomorrow · " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};
const typeIcon = (type) => type === "exam" ? "EXAM" : type === "revision" ? "REVISION" : type === "task" ? "TASK" : "UPDATE";

export function NotificationCenter({ userId, onNavigate, syncToken = 0, notificationToken = 0, newReminderIds = [] }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const announcedRef = useState(() => new Set())[0];
  const [open, setOpen] = useState(false);
  const unread = useMemo(() => items.filter((item) => !item.is_read && !item.dismissed_at), [items]);
  const visible = useMemo(() => items.filter((item) => !item.dismissed_at), [items]);

  const load = useCallback(async () => {
    if (!supabase || !userId) return;
    setLoading(true); setError("");
    const [rows, prefs] = await Promise.all([
      supabase.from("reminders").select("*").order("remind_at", { ascending: false }).limit(50),
      supabase.from("user_preferences").select("reminders_enabled,quiet_hours_start,quiet_hours_end").eq("user_id", userId).maybeSingle(),
    ]);
    if (rows.error) setError(rows.error.message || "Could not load notifications.");
    else setItems(rows.data || []);
    if (prefs.error) setError((current) => current || prefs.error.message);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load, syncToken]);
  useEffect(() => {
    if (!newReminderIds.length || notificationToken < 1 || typeof window === "undefined" || !("Notification" in window) || window.Notification.permission !== "granted" || document.visibilityState !== "visible") return;
    const announce = async () => {
      const { data, error: queryError } = await supabase.from("reminders").select("*").in("id", newReminderIds).eq("is_read", false).is("dismissed_at", null).lte("remind_at", new Date().toISOString());
      if (queryError) return;
      (data || []).forEach((item) => {
        const key = item.event_key || item.id;
        if (announcedRef.has(key)) return;
        announcedRef.add(key);
        new window.Notification(item.title, { body: item.body || "You have an Acadly reminder.", tag: key });
      });
    };
    announce();
  }, [notificationToken, newReminderIds, userId]);

  async function update(id, changes) {
    setBusy(true);
    const { data, error: updateError } = await supabase.from("reminders").update(changes).eq("id", id).select().single();
    if (updateError) setError(updateError.message || "Could not update notification.");
    else setItems((current) => current.map((item) => item.id === id ? data : item));
    setBusy(false);
  }

  async function markAllRead() {
    if (!unread.length) return;
    setBusy(true);
    const ids = unread.map((item) => item.id);
    const { error: updateError } = await supabase.from("reminders").update({ is_read: true }).in("id", ids);
    if (updateError) setError(updateError.message || "Could not mark notifications read.");
    else setItems((current) => current.map((item) => ids.includes(item.id) ? { ...item, is_read: true } : item));
    setBusy(false);
  }

  async function dismiss(item) {
    await update(item.id, { dismissed_at: new Date().toISOString(), is_read: true });
  }


  function openNotification(item) {
    if (!item.is_read) update(item.id, { is_read: true });
    const destination = item.source_type === "exam" ? "exams" : item.source_type === "revision" ? "revisions" : item.source_type === "task" ? "planner" : null;
    if (destination) onNavigate?.(destination);
    setOpen(false);
  }

  return <div className="notification-center">
    <button type="button" className="notification-bell" aria-label={"Notifications, " + unread.length + " unread"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Bell size={17}/>{unread.length > 0 && <span className="notification-badge">{unread.length > 99 ? "99+" : unread.length}</span>}
    </button>
    {open && <>
      <button type="button" className="notification-dismiss-layer" aria-label="Close notifications" onClick={() => setOpen(false)}/>
      <section className="notification-popover" aria-label="Notifications">
        <header><div><p className="eyebrow">YOUR UPDATES</p><h2>Notifications <span>{unread.length}</span></h2></div><button type="button" className="icon-button" aria-label="Close" onClick={() => setOpen(false)}><X size={17}/></button></header>
        <div className="notification-toolbar"><span>{visible.length} recent</span><button type="button" onClick={markAllRead} disabled={!unread.length || busy}><CheckCheck size={13}/> Mark all read</button></div>
        {loading ? <LoadingState label="Loading notifications..."/> : error ? <ErrorState title="Notifications unavailable" description={error} onRetry={load}/> : visible.length ? <div className="notification-list">{visible.map((item) => <article className={"notification-item " + (!item.is_read ? "notification-unread" : "")} key={item.id}>
          <button type="button" className="notification-content" onClick={() => openNotification(item)}><span className={"notification-type notification-type-" + (item.notification_type || item.source_type || "system")}>{typeIcon(item.notification_type || item.source_type)}</span><span className="notification-copy"><strong>{item.title}</strong><span>{item.body}</span><small><Clock3 size={11}/>{labelDate(item.remind_at)}</small></span><span className="notification-unread-dot"/></button>
          <div className="notification-actions">{!item.is_read && <button type="button" aria-label="Mark as read" title="Mark as read" onClick={() => update(item.id, { is_read: true })}><Check size={13}/></button>}<button type="button" aria-label="Dismiss notification" title="Dismiss" onClick={() => dismiss(item)}><X size={13}/></button></div>
        </article>)}</div> : <EmptyState icon={Inbox} title="You're all caught up" description="New study, exam, and revision reminders will appear here."/>}
        <footer><span><Settings2 size={13}/> Preferences are in Settings</span><button type="button" onClick={() => { setOpen(false); onNavigate?.("settings"); }}>Manage <ExternalLink size={12}/></button></footer>
      </section>
    </>}
  </div>;
}
