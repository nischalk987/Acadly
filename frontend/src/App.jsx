import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  FileText,
  Flame,
  GraduationCap,
  LayoutDashboard,
  ListTodo,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  X,
  ShieldCheck,
} from "lucide-react";
import { createElement, useCallback, useEffect, useState } from "react";
import { AuthScreen } from "./components/auth/AuthScreen.jsx";
import { ProfileSettings } from "./components/settings/ProfileSettings.jsx";
import { supabase } from "./lib/supabase.js";
import { EmptyState } from "./components/ui/Feedback.jsx";

const BRAND_NAME = import.meta.env.VITE_BRAND_NAME?.trim() || "Acadly";

const navigation = [
  { section: "WORKSPACE", items: [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "subjects", label: "Subjects", icon: BookOpen, count: "0" },
    { id: "planner", label: "Study planner", icon: CalendarDays },
    { id: "focus", label: "Focus room", icon: Timer },
    { id: "notes", label: "Notes & PDFs", icon: FileText },
  ]},
  { section: "TRACK YOURSELF", items: [
    { id: "exams", label: "Exams", icon: Target },
    { id: "revision", label: "Revision", icon: ListTodo },
    { id: "analytics", label: "Analytics", icon: Activity },
  ]},
];

const week = [
  { day: "Mon", date: "09", value: 2.5, today: true },
  { day: "Tue", date: "10", value: 3.4 },
  { day: "Wed", date: "11", value: 1.8 },
  { day: "Thu", date: "12", value: 4.2 },
  { day: "Fri", date: "13", value: 2.7 },
  { day: "Sat", date: "14", value: 3.8 },
  { day: "Sun", date: "15", value: 1.2 },
];

const initialTasks = [
  { id: 1, title: "Review process synchronization", subject: "Operating Systems", time: "09:30 AM", done: false, color: "violet" },
  { id: 2, title: "Practice graph traversal problems", subject: "Data Structures", time: "11:00 AM", done: false, color: "blue" },
  { id: 3, title: "Revise TCP congestion control", subject: "Computer Networks", time: "02:00 PM", done: true, color: "amber" },
];

const upcoming = [
  { subject: "Computer Networks", title: "Internal Assessment 2", date: "Nov 23", days: 14, color: "blue" },
  { subject: "Operating Systems", title: "Unit test", date: "Nov 28", days: 19, color: "violet" },
];

const cx = (...values) => values.filter(Boolean).join(" ");

function Brand() {
  return (
    <a className="brand-lockup" href="#overview" aria-label={`${BRAND_NAME} home`}>
      <span className="brand-symbol"><GraduationCap size={21} strokeWidth={2.2} /></span>
      <span className="brand-name">{BRAND_NAME}<span className="brand-period">.</span></span>
    </a>
  );
}

function IconButton({ label, children, className = "", onClick }) {
  return <button className={cx("icon-button", className)} type="button" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function Sidebar({ active, setActive, mobileOpen, closeMobile, onSignOut, displayName, email }) {
  return (
    <>
      {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={closeMobile} />}
      <aside className={cx("sidebar", mobileOpen && "sidebar-open")}>
        <div className="sidebar-brand"><Brand /><IconButton label="Close menu" className="mobile-close" onClick={closeMobile}><X size={18} /></IconButton></div>
        <button className="workspace-switcher" type="button">
          <span className="workspace-avatar">{(displayName || email || "S").charAt(0).toUpperCase()}</span>
          <span className="workspace-copy"><strong>My workspace</strong><small>{email || "Personal account"}</small></span>
          <ChevronDown size={15} />
        </button>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.section}>
              <p className="nav-section-label">{group.section}</p>
              {group.items.map(({ id, label, icon: _Icon, count }) => (
                <button key={id} type="button" className={cx("nav-link", active === id && "nav-link-active")} onClick={() => { setActive(id); closeMobile(); }}>
                  {createElement(_Icon, { size: 17, strokeWidth: 1.85 })}
                  <span>{label}</span>
                  {count && <span className="nav-count">{count}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-quote">
          <div className="quote-icon"><Sparkles size={16} /></div>
          <p>Small steps every day add up to big results.</p>
          <span>YOUR DAILY REMINDER</span>
        </div>
        <button className="nav-link settings-link" type="button" onClick={() => { setActive("settings"); closeMobile(); }}><Settings2 size={17} /><span>Settings</span></button>
        <div className="profile-row">
          <div className="profile-avatar">{(displayName || email || "S").charAt(0).toUpperCase()}</div>
          <div className="profile-info"><strong>{displayName || "Student"}</strong><span>{email || "Signed in"}</span></div>
          <button className="profile-signout" type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </aside>
    </>
  );
}

function Topbar({ onMenu, active, displayName, email }) {
  const title = navigation.flatMap((g) => g.items).find((i) => i.id === active)?.label || (active === "settings" ? "Settings" : "Overview");
  return (
    <header className="topbar">
      <div className="topbar-left">
        <IconButton label="Open navigation" className="menu-trigger" onClick={onMenu}><Menu size={19} /></IconButton>
        <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{title}</strong></div>
      </div>
      <div className="topbar-actions">
        <div className="search-box"><Search size={16} /><input aria-label="Search Acadly" placeholder="Search anything..." /><kbd><Command size={11} /> K</kbd></div>
        <span className="topbar-divider" />
        <IconButton label="Help and support"><CircleHelp size={18} /></IconButton>
        <span className="topbar-profile" title={email}><span className="profile-avatar small">{(displayName || email || "S").charAt(0).toUpperCase()}</span></span>
      </div>
    </header>
  );
}

function MetricCard({ label, value, unit, icon: _Icon, tone, note, trend }) {
  return (
    <article className="metric-card">
      <div className="metric-top"><span>{label}</span><span className={cx("metric-icon", tone)}>{createElement(_Icon, { size: 17 })}</span></div>
      <div className="metric-value">{value}<small>{unit}</small></div>
      <div className="metric-foot">{trend && <span className="trend-positive"><TrendingUp size={13} /> {trend}</span>}<span>{note}</span></div>
    </article>
  );
}

function StudyChart() {
  const max = Math.max(...week.map((d) => d.value));
  return (
    <div className="study-chart" role="img" aria-label="Weekly study hours: Monday 2.5, Tuesday 3.4, Wednesday 1.8, Thursday 4.2, Friday 2.7, Saturday 3.8, Sunday 1.2 hours">
      <div className="chart-grid"><span>5h</span><span>4h</span><span>3h</span><span>2h</span><span>1h</span></div>
      <div className="chart-bars">{week.map((d) => (
        <div className="chart-day" key={d.day}>
          <div className="chart-bar-track"><div className={cx("chart-bar", d.today && "chart-bar-today")} style={{ height: `${(d.value / max) * 100}%` }} title={`${d.value} hours`} /></div>
          <span className={cx("chart-day-label", d.today && "chart-day-active")}>{d.day}</span>
        </div>
      ))}</div>
    </div>
  );
}

function Dashboard({ tasks, toggleTask, onAddTask, onNavigate }) {
  const completed = tasks.filter((task) => task.done).length;
  return (
    <div className="dashboard-page">
      <section className="welcome-row">
        <div><p className="eyebrow">MONDAY, NOVEMBER 9, 2026</p><h1>Good afternoon, Student <span className="wave">✦</span></h1><p className="welcome-subtitle">A little progress each day adds up to big results.</p></div>
        <button className="button button-primary" onClick={onAddTask}><Plus size={16} /> Add a task</button>
      </section>

      <section className="metric-grid" aria-label="Study overview">
        <MetricCard label="Study time this week" value="18.4" unit="hrs" icon={Clock3} tone="metric-violet" note="Across 6 study days" trend="+12.5%" />
        <MetricCard label="Tasks completed" value={String(12 + completed)} unit="/ 18" icon={Check} tone="metric-green" note="You're making progress" />
        <MetricCard label="Current study streak" value="7" unit="days" icon={Flame} tone="metric-amber" note="Keep the momentum going" trend="Personal best" />
        <MetricCard label="Focus sessions" value="24" unit="sessions" icon={Target} tone="metric-blue" note="This week so far" />
      </section>

      <section className="dashboard-grid">
        <article className="panel study-overview">
          <div className="panel-heading"><div><h2>Study overview</h2><p>Your study activity this week</p></div><button className="select-button">This week <ChevronDown size={14} /></button></div>
          <div className="chart-summary"><strong>18h 24m</strong><span><span className="summary-dot" /> Study hours</span><span className="summary-comparison"><ArrowDownRight size={14} /> 8% vs last week</span></div>
          <StudyChart />
        </article>

        <article className="panel tasks-panel">
          <div className="panel-heading"><div><h2>Today's tasks</h2><p>{completed} of {tasks.length} completed</p></div><button className="text-button" onClick={onAddTask}>View all <ArrowRight size={14} /></button></div>
          <div className="task-list">{tasks.map((task) => (
            <div className={cx("task-row", task.done && "task-done")} key={task.id}>
              <button className={cx("task-check", task.done && "task-check-done")} aria-label={task.done ? `Mark ${task.title} incomplete` : `Complete ${task.title}`} onClick={() => toggleTask(task.id)}>{task.done && <Check size={13} />}</button>
              <div className="task-content"><strong>{task.title}</strong><span><i className={cx("subject-dot", task.color)} />{task.subject}</span></div>
              <time>{task.time}</time>
            </div>
          ))}</div>
          {tasks.length === 0 && <EmptyState title="Your task list is clear" description="Add a study task to give your next session a direction." actionLabel="Add a task" onAction={onAddTask} /> }
          <button className="add-task-link" onClick={onAddTask}><Plus size={15} /> Add another task</button>
        </article>
      </section>

      <section className="lower-grid">
        <article className="panel exams-panel">
          <div className="panel-heading"><div><h2>Upcoming exams</h2><p>Stay prepared and on track</p></div><button className="text-button" onClick={() => onNavigate("exams")}>See all <ArrowRight size={14} /></button></div>
          {upcoming.map((exam) => (
            <div className="exam-row" key={exam.title}>
              <div className={cx("exam-icon", exam.color)}><CalendarDays size={18} /></div>
              <div className="exam-copy"><strong>{exam.subject}</strong><span>{exam.title}</span></div>
              <div className="exam-date"><strong>{exam.date}</strong><span>in {exam.days} days</span></div>
            </div>
          ))}
        </article>
        <article className="panel focus-panel">
          <div className="panel-heading"><div><h2>Quick focus</h2><p>One session at a time</p></div><span className="focus-pill"><span /> Ready</span></div>
          <div className="focus-widget">
            <div className="focus-ring"><div className="focus-ring-inner"><span>25:00</span><small>FOCUS TIME</small></div></div>
            <div className="focus-details"><strong>Ready when you are.</strong><span>25 min focus · 5 min break</span><button className="button button-primary button-small" onClick={() => window.dispatchEvent(new CustomEvent("acadly:navigate", { detail: "focus" }))}><Timer size={14} /> Open focus room</button></div>
          </div>
        </article>
      </section>
    </div>
  );
}

function AuthCallback({ onAuthenticated }) {
  const [message, setMessage] = useState("Verifying your secure link...");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    async function exchange() {
      if (!supabase) { setFailed(true); setMessage("Authentication is not configured. Please contact the site administrator."); return; }
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const errorDescription = url.searchParams.get("error_description");
      if (errorDescription) { setFailed(true); setMessage(errorDescription); return; }
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) throw new Error("The link may have expired or already been used. Request a new email link.");
        if (!alive) return;
        const next = url.searchParams.get("next");
        window.history.replaceState({}, "", next === "/reset-password" ? "/reset-password" : "/");
        onAuthenticated(data.session);
      } catch (err) { if (alive) { setFailed(true); setMessage(err.message || "Could not verify this link."); } }
    }
    exchange();
    return () => { alive = false; };
  }, [onAuthenticated]);
  return <main className="auth-page"><section className="auth-card auth-callback-card"><span className="auth-heading-icon"><ShieldCheck size={20} /></span><h1>{failed ? "Link could not be verified" : "Securing your account"}</h1><p role={failed ? "alert" : "status"}>{message}</p>{failed && <button className="auth-submit" onClick={() => { window.history.replaceState({}, "", "/"); window.location.reload(); }}>Back to sign in</button>}</section></main>;
}

function PlaceholderPage({ active }) {
  const items = {
    subjects: ["Your subjects", "Add subjects and break them into manageable chapters."],
    planner: ["Study planner", "Build a weekly plan that works with your schedule."],
    focus: ["Focus room", "A distraction-free place for your next study session."],
    notes: ["Notes & PDFs", "Keep your study resources organized in one private library."],
    exams: ["Exam tracker", "Keep upcoming assessments and important dates in view."],
    revision: ["Revision tracker", "Know what to revise next and keep track of each review."],
    analytics: ["Your analytics", "Understand your study habits and see your progress."],
    settings: ["Settings", "Manage your profile and workspace preferences."],
  };
  const [title, description] = items[active] || items.subjects;
  return <section className="placeholder-page"><div className="placeholder-icon"><Sparkles size={22} /></div><p className="eyebrow">COMING INTO FOCUS</p><h1>{title}</h1><p>{description}</p><span className="coming-soon-label">This module is scheduled for development.</span></section>;
}

function QuickAddDialog({ onClose, onSave }) {
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Computer Networks");
  const [time, setTime] = useState("04:00");
  const [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    if (!title.trim()) { setError("Enter a task title to continue."); return; }
    onSave({ title: title.trim(), subject, time: new Date(`2026-11-09T${time}:00`).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), color: "violet" });
    onClose();
  }
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h2 id="dialog-title">Add a study task</h2></div><IconButton label="Close dialog" onClick={onClose}><X size={18} /></IconButton></div>
        <form onSubmit={submit}>
          <label className="field-label">Task name<input autoFocus value={title} onChange={(e) => { setTitle(e.target.value); setError(""); }} placeholder="e.g. Revise operating systems" /></label>
          <label className="field-label">Subject<select value={subject} onChange={(e) => setSubject(e.target.value)}><option>Computer Networks</option><option>Operating Systems</option><option>Data Structures</option><option>Mathematics</option><option>Digital Logic</option></select></label>
          <label className="field-label">Start time<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="dialog-actions"><button type="button" className="button button-ghost" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary"><Plus size={15} /> Add task</button></div>
        </form>
      </section>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const acceptSession = useCallback((nextSession) => setSession(nextSession), []);
  const displayName = profileName || session?.user?.user_metadata?.display_name || session?.user?.email?.split("@")[0] || "Student";
  const email = session?.user?.email || "";
  const [active, setActive] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tasks, setTasks] = useState(initialTasks);
  const [toast, setToast] = useState("");
  useEffect(() => {
    let alive = true;
    setProfileName("");
    if (!session?.user?.id || !supabase) return undefined;
    supabase.from("profiles").select("display_name").eq("id", session.user.id).single()
      .then(({ data, error }) => {
        if (!alive) return;
        if (!error && data?.display_name) setProfileName(data.display_name);
      });
    return () => { alive = false; };
  }, [session?.user?.id]);
  useEffect(() => {
    let alive = true;
    if (!supabase) { setAuthLoading(false); return undefined; }
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setToast("Session could not be restored. Please sign in again.");
      setSession(data?.session ?? null);
      setAuthLoading(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      // Supabase persists and refreshes the session. Initial routing is set by getSession.
    });
    return () => { alive = false; authListener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    const listener = (event) => setActive(event.detail);
    window.addEventListener("acadly:navigate", listener);
    return () => window.removeEventListener("acadly:navigate", listener);
  }, []);
  function addTask(task) {
    setTasks((current) => [...current, { ...task, id: Date.now(), done: false }]);
    setToast("Task added to your preview workspace");
    window.setTimeout(() => setToast(""), 2800);
  }
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) { setToast("Sign out failed. Please try again."); return; }
    setSession(null);
    setActive("overview");
  }
  if (authLoading) return <div className="auth-page"><div className="loading-state"><span className="loading-spinner" /> Restoring your secure session...</div></div>;
  if (window.location.pathname === "/auth/callback") return <AuthCallback onAuthenticated={acceptSession} />;
  if (!session) return <AuthScreen onAuthenticated={acceptSession} />;
  return (
    <div className="app-frame">
      <Sidebar active={active} setActive={setActive} mobileOpen={mobileOpen} closeMobile={() => setMobileOpen(false)} onSignOut={signOut} displayName={displayName} email={email} />
      <div className="main-column">
        <Topbar active={active} onMenu={() => setMobileOpen(true)} displayName={displayName} email={email} />
        <main id="main-content" className="main-content">
          {active === "overview" ? <Dashboard tasks={tasks} toggleTask={(id) => setTasks((current) => current.map((t) => t.id === id ? { ...t, done: !t.done } : t))} onAddTask={() => setDialogOpen(true)} onNavigate={setActive} /> : active === "settings" ? <ProfileSettings session={session} onDisplayNameChange={setProfileName} onSignOut={signOut} /> : <PlaceholderPage active={active} />}
        </main>
        <footer className="app-footer"><span>© 2026 {BRAND_NAME}</span><span>Made for focused learning <span className="footer-heart">✦</span></span></footer>
      </div>
      {dialogOpen && <QuickAddDialog onClose={() => setDialogOpen(false)} onSave={addTask} />}
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}
