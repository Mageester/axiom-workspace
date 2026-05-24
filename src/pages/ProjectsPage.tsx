import { useMemo, useState } from "react";
import {
  Code2,
  Download,
  FolderOpen,
  GitBranch,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Square,
  Terminal,
} from "lucide-react";
import type { LiveRepo, WorkSession } from "../types";
import type { RegisteredProject } from "../types/workspace";
import { AddProjectModal } from "../components/AddProjectModal";
import { RepoDiscoveryModal } from "../components/RepoDiscoveryModal";
import type { CreateSessionInput } from "../lib/sessions";
import { formatChangedFiles } from "../lib/project-status";
import { getRepoDisplayName } from "../lib/repos";
import { samePerson, normalizeDisplayName } from "../lib/identity";

interface ProjectsPageProps {
  repos: LiveRepo[];
  registeredProjects: RegisteredProject[];
  repoNicknames: Record<string, string>;
  activeSessions: WorkSession[];
  loading: boolean;
  refreshingPaths: Set<string>;
  pullingPaths: Set<string>;
  onRefreshAll: () => Promise<void>;
  onRefreshRepo: (path: string) => Promise<void>;
  onAddRepo: (path: string) => Promise<LiveRepo>;
  onAddProject: (name: string, repoUrl: string, defaultBranch: string) => Promise<void>;
  onCloneProject: (project: RegisteredProject) => Promise<void>;
  onRemoveRepo: (path: string) => void;
  onRenameRepo: (path: string, name: string) => void;
  onStartSession: (input: CreateSessionInput) => void;
  onFinishSession: (sessionId: string, summary?: string, details?: string) => void;
  onPullRepo: (path: string) => Promise<void>;
  onOpenInCode: (path: string) => Promise<void>;
  onOpenFolder: (path: string) => Promise<void>;
  onOpenTerminal: (path: string) => Promise<void>;
  getRepoSessions: (repo: LiveRepo) => WorkSession[];
  defaultUserName: string;
}

interface ProjectRow {
  id: string;
  name: string;
  branch: string;
  health: string;
  teammate: string;
  installState: string;
  lastChecked: string;
  repo?: LiveRepo;
  project?: RegisteredProject;
  mySession?: WorkSession;
  primary: "Open" | "Start" | "Finish" | "Review" | "Clone Latest";
}

function timeAgo(value?: string): string {
  if (!value) return "never";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function buildRows(
  repos: LiveRepo[],
  projects: RegisteredProject[],
  nicknames: Record<string, string>,
  sessions: WorkSession[],
  currentUser: string,
): ProjectRow[] {
  const installedPaths = new Set(repos.map((repo) => repo.path.toLowerCase()));
  const rows = repos.map((repo): ProjectRow => {
    const mySession = sessions.find((session) => session.repoId === repo.id && samePerson(session.userName, currentUser));
    const teammateSessions = sessions.filter((session) => session.repoId === repo.id && !samePerson(session.userName, currentUser));
    const dirty = repo.changedFileCount > 0;
    const needsReview = repo.status === "error" || repo.behind > 0 || repo.ahead > 0 || dirty || teammateSessions.length > 0;
    const health = mySession
      ? "Working here"
      : repo.status === "error"
        ? "Needs attention"
        : teammateSessions.length > 0
          ? "Review first"
          : needsReview
            ? "Review first"
            : "Safe to start";
    const primary = mySession ? "Finish" : needsReview ? "Review" : "Start";
    return {
      id: repo.id,
      name: getRepoDisplayName(repo, nicknames[repo.path]),
      branch: repo.currentBranch || "main",
      health,
      teammate: teammateSessions.length > 0 ? normalizeDisplayName(teammateSessions[0].userName) : "Inactive",
      installState: dirty ? formatChangedFiles(repo.changedFileCount) : "Installed",
      lastChecked: timeAgo(repo.lastCheckedAt),
      repo,
      mySession,
      primary,
    };
  });

  const missing = projects
    .filter((project) => project.installStatus === "not_installed" || (project.localPath && !installedPaths.has(project.localPath.toLowerCase())))
    .map((project): ProjectRow => ({
      id: project.id,
      name: project.name,
      branch: project.defaultBranch || "main",
      health: "Clone required",
      teammate: "Inactive",
      installState: "Missing locally",
      lastChecked: timeAgo(project.lastCheckedAt),
      project,
      primary: "Clone Latest",
    }));

  return [...rows, ...missing].sort((a, b) => {
    if (a.mySession && !b.mySession) return -1;
    if (!a.mySession && b.mySession) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function ProjectsPage({
  repos,
  registeredProjects,
  repoNicknames,
  activeSessions,
  loading,
  refreshingPaths,
  pullingPaths,
  onRefreshAll,
  onRefreshRepo,
  onAddRepo,
  onAddProject,
  onCloneProject,
  onRemoveRepo,
  onRenameRepo,
  onStartSession,
  onFinishSession,
  onPullRepo,
  onOpenInCode,
  onOpenFolder,
  onOpenTerminal,
  defaultUserName,
}: ProjectsPageProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [menuRow, setMenuRow] = useState<string | null>(null);
  const rows = useMemo(
    () => buildRows(repos, registeredProjects, repoNicknames, activeSessions, defaultUserName),
    [repos, registeredProjects, repoNicknames, activeSessions, defaultUserName],
  );
  const safeRows = rows.filter((row) => row.health === "Safe to start").length;
  const reviewRows = rows.filter((row) => row.health === "Review first" || row.health === "Needs attention").length;
  const activeRows = rows.filter((row) => row.health === "Working here").length;
  const missingRows = rows.filter((row) => row.primary === "Clone Latest").length;

  function startRepo(repo: LiveRepo) {
    onStartSession({
      repoId: repo.id,
      repoName: getRepoDisplayName(repo, repoNicknames[repo.path]),
      repoPath: repo.path,
      userName: defaultUserName,
      title: `Work on ${getRepoDisplayName(repo, repoNicknames[repo.path])}`,
      notes: "",
      branch: repo.currentBranch,
      targets: [{ id: `${repo.id}-general`, type: "area", value: "general work" }],
    });
  }

  function runPrimary(row: ProjectRow) {
    if (row.mySession) onFinishSession(row.mySession.id);
    else if (row.project && row.primary === "Clone Latest") void onCloneProject(row.project);
    else if (row.repo && row.primary === "Open") void onOpenInCode(row.repo.path);
    else if (row.repo) startRepo(row.repo);
  }

  return (
    <div className="flex-1 overflow-auto bg-surface-0">
      <div className="border-b border-border/25 bg-surface-0/90 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Projects</h1>
            <p className="mt-1 text-xs text-text-muted">Operational list for local installs, branches, risk, and work claims.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex h-8 items-center gap-1.5 rounded-lg border border-border/40 bg-surface-1 px-3 text-[11px] font-bold text-text-primary hover:bg-surface-2" onClick={onRefreshAll} disabled={loading || repos.length === 0}>
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Refresh
            </button>
            <button className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[11px] font-bold text-white hover:bg-accent-hover" onClick={() => setShowAddModal(true)}>
              <Plus size={12} />
              Add Project
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {rows.length === 0 ? (
          <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-dashed border-border/45 bg-surface-1/35 px-6">
            <p className="text-base font-semibold text-text-primary">Add your first Axiom project</p>
            <p className="mt-2 max-w-sm text-center text-xs text-text-muted">Register or discover a repository. Workspace tracks coordination state, not source code.</p>
            <button className="mt-6 flex h-9 items-center gap-1.5 rounded-xl bg-accent px-4 text-xs font-bold text-white hover:bg-accent-hover" onClick={() => setShowDiscoveryModal(true)}>
              <Search size={13} />
              Find Repositories
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Safe", safeRows, "text-status-clean"],
                ["Review", reviewRows, "text-status-dirty"],
                ["Active", activeRows, "text-accent-hover"],
                ["Missing", missingRows, "text-text-secondary"],
              ].map(([label, value, className]) => (
                <div key={label} className="rounded-xl border border-border/20 bg-surface-1/35 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">{label}</p>
                  <p className={`mt-1 text-xl font-bold ${className}`}>{value}</p>
                </div>
              ))}
            </div>

          <div className="overflow-x-auto rounded-2xl border border-border/25 bg-surface-1/45 shadow-sm">
            <div className="min-w-[860px]">
            <div className="grid grid-cols-[minmax(190px,1.4fr)_0.8fr_0.9fr_0.75fr_0.65fr_160px] gap-3 border-b border-border/20 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted">
              <span>Project</span>
              <span>Branch</span>
              <span>Health</span>
              <span>Teammate</span>
              <span>Checked</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-border/15">
              {rows.map((row) => (
                <div key={row.id} className="group grid grid-cols-[minmax(190px,1.4fr)_0.8fr_0.9fr_0.75fr_0.65fr_160px] items-center gap-3 px-4 py-3.5 text-xs transition-colors hover:bg-surface-2/30">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-text-primary">{row.name}</p>
                    <p className="mt-1 truncate text-[11px] text-text-muted">{row.installState}</p>
                  </div>
                  <div className="flex min-w-0 items-center gap-1.5 text-text-secondary" title={row.branch}>
                    <GitBranch size={12} />
                    <span className="truncate">{row.branch}</span>
                  </div>
                  <span className={`w-fit rounded-md px-2 py-1 text-[10px] font-bold ${row.health === "Safe to start" ? "bg-status-clean/10 text-status-clean" : row.health === "Working here" ? "bg-accent/10 text-accent-hover" : "bg-status-dirty/10 text-status-dirty"}`}>
                    {row.health}
                  </span>
                  <span className="truncate text-text-secondary">{row.teammate}</span>
                  <span className="text-text-muted">{row.lastChecked}</span>
                  <div className="relative flex items-center justify-end gap-1.5">
                    {row.repo && (
                      <>
                        <button title="Open in VS Code" className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-surface-3 hover:text-text-primary" onClick={() => void onOpenInCode(row.repo!.path)}><Code2 size={14} /></button>
                        <button title="Open terminal" className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-surface-3 hover:text-text-primary" onClick={() => void onOpenTerminal(row.repo!.path)}><Terminal size={14} /></button>
                      </>
                    )}
                    <button
                      className={`h-8 rounded-lg px-3 text-[11px] font-bold transition-colors ${
                        row.primary === "Finish" ? "bg-accent text-white hover:bg-accent-hover" :
                        row.primary === "Clone Latest" ? "bg-surface-2 border border-border/40 text-text-primary hover:bg-surface-3" :
                        row.primary === "Review" ? "bg-status-dirty/10 border border-status-dirty/20 text-status-dirty hover:bg-status-dirty/20" :
                        "bg-accent text-white hover:bg-accent-hover"
                      }`}
                      onClick={() => runPrimary(row)}
                    >
                      {row.primary === "Finish" && <Square size={10} className="mr-1 inline" fill="currentColor" />}
                      {row.primary}
                    </button>
                    <button className="grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-surface-3 hover:text-text-primary" onClick={() => setMenuRow(menuRow === row.id ? null : row.id)}>
                      <MoreHorizontal size={15} />
                    </button>
                    {menuRow === row.id && (
                      <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-border/35 bg-surface-1 shadow-2xl animate-slide-in">
                        {row.repo && <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-text-secondary hover:bg-surface-2" onClick={() => void onOpenFolder(row.repo!.path)}><FolderOpen size={12} />Open folder</button>}
                        {row.repo && <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-text-secondary hover:bg-surface-2" onClick={() => void onRefreshRepo(row.repo!.path)}><RefreshCw size={12} />Refresh</button>}
                        {row.repo && <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-text-secondary hover:bg-surface-2" onClick={() => void onPullRepo(row.repo!.path)} disabled={pullingPaths.has(row.repo.path)}>Pull latest</button>}
                        {row.project?.repoUrl && <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-text-secondary hover:bg-surface-2" onClick={() => navigator.clipboard?.writeText(row.project!.repoUrl)}>Copy repo URL</button>}
                        {row.repo && <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-status-locked hover:bg-status-locked/10" onClick={() => onRemoveRepo(row.repo!.path)}>Remove</button>}
                      </div>
                    )}
                    {row.repo && refreshingPaths.has(row.repo.path) && <Loader2 size={12} className="animate-spin text-text-muted" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-4 py-4 mt-2">
            <button className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted hover:text-text-primary transition-colors" onClick={onRefreshAll}>
              <RefreshCw size={12} /> Refresh all projects
            </button>
            <span className="text-border/40">•</span>
            <button className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted hover:text-text-primary transition-colors" onClick={() => setShowAddModal(true)}>
              <Plus size={12} /> Add project
            </button>
            <span className="text-border/40">•</span>
            <button className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted hover:text-text-primary transition-colors" onClick={() => setShowDiscoveryModal(true)}>
              <Search size={12} /> Find repositories
            </button>
          </div>
        )}
      </main>

      <AddProjectModal open={showAddModal} onClose={() => setShowAddModal(false)} onAdd={(name, repoUrl, defaultBranch) => void onAddProject(name, repoUrl, defaultBranch)} />
      <RepoDiscoveryModal open={showDiscoveryModal} onClose={() => setShowDiscoveryModal(false)} onAddRepo={onAddRepo} />
    </div>
  );
}
