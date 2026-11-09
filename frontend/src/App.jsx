import { BookOpen, CalendarDays, CheckCircle2, GraduationCap, Timer } from "lucide-react";

const modules = [
  { name: "Subjects & chapters", description: "Organize your courses and topics.", icon: BookOpen },
  { name: "Study planner", description: "Plan what to study next.", icon: CalendarDays },
  { name: "Focus timer", description: "Build consistent study sessions.", icon: Timer },
];

export default function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Acadly home">
          <span className="brand-mark"><GraduationCap size={22} /></span>
          <span>Acadly</span>
        </a>
        <span className="status"><span className="status-dot" /> Development preview</span>
      </header>

      <section className="hero">
        <p className="eyebrow">YOUR LEARNING SPACE</p>
        <h1>Make every study session count.</h1>
        <p className="hero-copy">
          A free space to plan your studies, stay focused, organize notes, and see your progress.
        </p>
        <div className="promise"><CheckCircle2 size={18} /> All student features. Free for everyone.</div>
      </section>

      <section className="module-section" aria-labelledby="modules-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE WORKSPACE</p>
            <h2 id="modules-heading">Your study toolkit</h2>
          </div>
          <span className="coming-soon">Foundation in progress</span>
        </div>
        <div className="module-grid">
          {modules.map(({ name, description, icon: Icon }) => (
            <article className="module-card" key={name}>
              <span className="module-icon"><Icon size={21} /></span>
              <h3>{name}</h3>
              <p>{description}</p>
              <span className="module-state">Planned module</span>
            </article>
          ))}
        </div>
      </section>

      <footer>Acadly is being built in the open. Your data will be private by default.</footer>
    </main>
  );
}
