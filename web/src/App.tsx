import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  FileJson,
  GitBranch,
  LockKeyhole,
  MonitorDown,
  ShieldCheck,
  Users,
} from "lucide-react";

const latestVersion = "1.5.2";
const targetVersion = "1.5.2";
const releasesUrl = "https://github.com/Mageester/axiom-workspace/releases";

const workflow = [
  "Install Git for Windows if it is missing.",
  "Download and open the Windows desktop app.",
  "Connect to the Axiom Team Workspace sync repo.",
  "Start Work before touching a repo area.",
  "Finish Work with a short handoff note.",
  "Let auto-sync share coordination state quietly.",
];

const troubleshooting = [
  ["I cannot sync", "Open Settings in the desktop app, verify GitHub access, then run Sync Now."],
  ["Repo shows attention needed", "Read the repo card. Axiom distinguishes local changes, remote updates, no upstream, and real errors."],
  ["Installer is missing", "Use the GitHub Releases link until the current internal installer asset is published."],
];

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "safe" | "warn" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function App() {
  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <div className="mark">AX</div>
          <div>
            <strong>Axiom Workspace</strong>
            <span>Private team portal</span>
          </div>
        </div>
        <div className="top-actions">
          <Pill tone="warn"><LockKeyhole size={13} /> Access restricted</Pill>
          <a href={releasesUrl} target="_blank" rel="noreferrer" className="ghost-link">
            Releases <ExternalLink size={14} />
          </a>
        </div>
      </header>

      <section className="hero">
        <div className="access-card">
          <ShieldCheck size={16} />
          <span>Private workspace for Aidan and Riley. Protect this domain with Cloudflare Access before deployment.</span>
        </div>
        <h1>Private workspace coordination for Axiom.</h1>
        <p className="hero-copy">
          See who is working, what is claimed, and whether it is safe to start. Source code stays in normal repos. Axiom Workspace syncs coordination state only.
        </p>
        <div className="hero-actions">
          <a className="primary" href={releasesUrl} target="_blank" rel="noreferrer">
            <Download size={17} /> Download desktop app
          </a>
          <button className="secondary" disabled title="Future desktop deep link: axiom-workspace://open">
            <MonitorDown size={17} /> Open Axiom Workspace · Coming soon
          </button>
        </div>
      </section>

      <section className="grid two">
        <article className="card release-card">
          <div className="card-head">
            <MonitorDown size={18} />
            <span>Desktop app</span>
          </div>
          <h2>Latest internal build</h2>
          <div className="version-row">
            <span>Current release</span>
            <strong>v{latestVersion}</strong>
          </div>
          <div className="version-row muted">
            <span>Polish release</span>
            <strong>v{targetVersion}</strong>
          </div>
          <p>
            Installer asset links are published from GitHub Releases when an internal build is ready.
          </p>
          <a href={releasesUrl} target="_blank" rel="noreferrer" className="text-link">
            Open release downloads <ArrowRight size={15} />
          </a>
        </article>

        <article className="card status-card">
          <div className="card-head">
            <Users size={18} />
            <span>Team status preview</span>
          </div>
          <h2>Snapshot preview mode</h2>
          <p>
            This portal does not read the private Git sync repo. A future version can import a redacted sync snapshot JSON after access control is in place.
          </p>
          <div className="mini-board">
            <div><span>Aidan</span><strong>Desktop app source of truth</strong></div>
            <div><span>Riley</span><strong>Install, connect, start work</strong></div>
          </div>
          <Pill><FileJson size={13} /> Future: import snapshot JSON</Pill>
        </article>
      </section>

      <Section eyebrow="Setup" title="Riley setup guide">
        <div className="steps">
          {workflow.map((item, index) => (
            <div className="step" key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="How sync works" title="Coordination state only. Never source code.">
        <div className="grid three">
          <article className="card small"><GitBranch size={18} /><h3>Git-based sync repo</h3><p>The desktop app uses a validated team sync repo for work sessions, claimed areas, and handoff notes.</p></article>
          <article className="card small"><ShieldCheck size={18} /><h3>Project repos stay read-only</h3><p>Axiom reads local status diagnostics. It does not write, reset, clean, merge, or sync source code from project repos.</p></article>
          <article className="card small"><CheckCircle2 size={18} /><h3>Safe to start</h3><p>The product question stays simple: who is working on what, and is it safe for me to start?</p></article>
        </div>
      </Section>

      <Section eyebrow="Security" title="Deploy only behind private access control">
        <div className="security-panel">
          <div>
            <h3>Recommended privacy strategy</h3>
            <p>Use Cloudflare Access for workspace.getaxiom.ca and allow only Aidan and Riley emails. Do not deploy this portal publicly without that gate.</p>
          </div>
          <Pill tone="safe"><CheckCircle2 size={13} /> No custom auth in app code</Pill>
        </div>
        <ul className="safety-list">
          <li>Does not sync or expose source code.</li>
          <li>Does not store GitHub passwords or tokens.</li>
          <li>Does not include live private sync state.</li>
          <li>Does not use paid APIs, hosted databases, Prisma, Supabase, Firebase, or Next.js routes.</li>
        </ul>
      </Section>

      <Section eyebrow="Future connection" title="Desktop deep links prepared, not enabled">
        <div className="protocols">
          <code>axiom-workspace://open</code>
          <code>axiom-workspace://sync</code>
          <code>axiom-workspace://start-work</code>
        </div>
        <p className="section-copy">Protocol support should be proposed and reviewed before adding Tauri handlers. The portal currently only documents the future connection path.</p>
      </Section>

      <Section eyebrow="Troubleshooting" title="Common internal support notes">
        <div className="faq">
          {troubleshooting.map(([q, a]) => (
            <article key={q}>
              <h3>{q}</h3>
              <p>{a}</p>
            </article>
          ))}
        </div>
      </Section>

      <footer>
        <AlertTriangle size={15} /> Private internal portal. Deployment is rejected unless access protection is configured first.
      </footer>
    </main>
  );
}
