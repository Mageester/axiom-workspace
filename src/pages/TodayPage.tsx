import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Code2,
  FolderOpen,
  GitBranch,
  Loader2,
  Play,
  RefreshCw,
  Square,
  Terminal,
} from "lucide-react";
import type {
  LiveRepo,
  SyncSettings,
  SyncStatus,
  WorkSession,
  WorkspaceEvent,
} from "../types";
import type { AttentionItem, RegisteredProject } from "../types/workspace";
import type { SyncModeInfo } from "../lib/sync-mode";
import type { CreateSessionInput } from "../lib/sessions";
import { FinishWorkModal } from "../components/FinishWorkModal";
import { NeedsAttention } from "../components/NeedsAttention";
import { computeAttentionItems } from "../lib/attention";
import { humanizeActivityEvent } from "../lib/activity";
import { normalizeDisplayName, samePerson } from "../lib/identity";
import { formatChangedFiles } from "../lib/project-status";
import { getRepoDisplayName } from "../lib/repos";

interface TodayPageProps {
  repos: LiveRepo[];
  activeSessions: WorkSession[];
  recentEvents: WorkspaceEvent[];
  defaultUserName: string;
  syncSettings: SyncSettings;
  syncInfo: SyncModeInfo;
  syncStatus: SyncStatus;
  loading: boolean;
  registeredProjects: RegisteredProject[];
  cloudSyncUnavailable: boolean;
  onSyncNow: () => Promise<void>;
  onStartSession: (input: CreateSessionInput) => void;
  onFinishSession: (sessionId: string, summary?: string, details?: string) => void;
  onCloneProject: (project: RegisteredProject) => Promise<void>;
  onOpenInCode: (path: string) => Promise<void>;
  onOpenFolder: (path: string) => Promise<void>;
  onOpenTerminal: (path: string) => Promise<void>;
  onNavigate: (page: any) => void;
}

interface LauncherItem {
  id: string;
  name: string;
  branch: string;
  status: string;
  detail: string;
  repo?: LiveRepo;
  project?: RegisteredProject;
  session?: WorkSession;
  teammateSession?: WorkSession;
  needsReview: boolean;
  cloneRequired: boolean;
}

function durationLabel(startedAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (minutes < 1) return "< 1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
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

function buildLauncherItems(
  repos: LiveRepo[],
  projects: RegisteredProject[],
  sessions: WorkSession[],
  currentUser: string,
): LauncherItem[] {
  const byPath = new Map(projects.map((project) => [project.localPath?.toLowerCase(), project]));
  const installedPaths = new Set(repos.map((repo) => repo.path.toLowerCase()));
  const repoItems = repos.map((repo): LauncherItem => {
    const mySession = sessions.find((session) => session.repoId === repo.id && samePerson(session.userName, currentUser));
    const teammateSession = sessions.find((session) => session.repoId === repo.id && !samePerson(session.userName, currentUser));
    const dirty = repo.changedFileCount > 0;
    const needsReview = repo.status === "error" || repo.ahead > 0 || repo.behind > 0 || repo.changedFileCount > 0 || Boolean(teammateSession);
    let status = "Safe to start";
    if (mySession) status = "Working here";
    else if (repo.status === "error") status = "Needs attention";
    else if (teammateSession) status = `${normalizeDisplayName(teammateSession.userName)} active`;
    else if (needsReview) status = "Review first";

    return {
      id: repo.id,
      name: getRepoDisplayName(repo),
      branch: repo.currentBranch || "main",
      status,
      detail: dirty ? formatChangedFiles(repo.changedFileCount) : repo.status === "clean" ? "Ready" : repo.status,
      repo,
      project: byPath.get(repo.path.toLowerCase()),
      session: mySession,
      teammateSession,
      needsReview,
      cloneRequired: false,
    };
  });

  const missingItems = projects
    .filter((project) => project.installStatus === "not_installed" || (project.localPath && !installedPaths.has(project.localPath.toLowerCase())))
    .map((project): LauncherItem => ({
      id: project.id,
      name: project.name,
      branch: project.defaultBranch || "main",
      status: "Clone required",
      detail: "Missing on this device",
      project,
      needsReview: false,
      cloneRequired: true,
    }));

  return [...repoItems, ...missingItems].sort((a, b) => {
    if (a.session && !b.session) return -1;
    if (!a.session && b.session) return 1;
    if (a.cloneRequired !== b.cloneRequired) return a.cloneRequired ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

export function TodayPage({
  repos,
  activeSessions,
  recentEvents,
  defaultUserName,
  syncSettings,
  syncInfo,
  syncStatus,
  loading,
  registeredProjects,
  cloudSyncUnavailable,
  onSyncNow,
  onStartSession,
  onFinishSession,
  onCloneProject,
  onOpenInCode,
  onOpenFolder,
  onOpenTerminal,
  onNavigate,
}: TodayPageProps) {
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState<LauncherItem | null>(null);

  const myActiveSession = useMemo(
    () => activeSessions.find((session) => samePerson(session.userName, defaultUserName)),
    [activeSessions, defaultUserName],
  );
  const myRepo = useMemo(
    () => myActiveSession ? repos.find((repo) => repo.id === myActiveSession.repoId) ?? null : null,
    [myActiveSession, repos],
  );
  const launcherItems = useMemo(
    () => buildLauncherItems(repos, registeredProjects, activeSessions, defaultUserName),
    [repos, registeredProjects, activeSessions, defaultUserName],
  );
  const attentionItems = useMemo(
    () => computeAttentionItems(repos, activeSessions, defaultUserName, registeredProjects, syncSettings, cloudSyncUnavailable).slice(0, 3),
    [repos, activeSessions, defaultUserName, registeredProjects, syncSettings, cloudSyncUnavailable],
  );
  const recentImportant = useMemo(
    () => [...recentEvents]
      .filter((event) => event.type !== "sync_completed" && event.type !== "snapshot_created")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3),
    [recentEvents],
  );

  const syncing = syncStatus !== "idle" && syncStatus !== "complete" && syncStatus !== "error";
  const suggestedItem = launcherItems.find((item) => !item.cloneRequired && !item.session) ?? launcherItems[0];

  function startItem(item: LauncherItem, force = false) {
    if (!item.repo) return;
    if (item.needsReview && !force) {
      setReviewItem(item);
      return;
    }
    onStartSession({
      repoId: item.repo.id,
      repoName: item.name,
      repoPath: item.repo.path,
      userName: defaultUserName,
      title: `Work on ${item.name}`,
      notes: "",
      branch: item.repo.currentBranch,
      targets: [{ id: `${item.repo.id}-general`, type: "area", value: "general work" }],
    });
    setReviewItem(null);
  }

  function primaryAction(item: LauncherItem) {
    if (item.session) {
      setFinishModalOpen(true);
    } else if (item.cloneRequired && item.project) {
      void onCloneProject(item.project);
    } else if (item.needsReview) {
      setReviewItem(item);
    } else {
      startItem(item);
    }
  }

  return (
    <div className="flex-1 overflow-auto bg-surface-0">
      <div className="sticky top-0 z-20 border-b border-border/25 bg-surface-0/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-text-primary">Axiom Workspace</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${syncInfo.dotClass}`} />
              <span>{syncInfo.label}</span>
              <span className="text-text-muted/50">/</span>
              <span>{syncInfo.detail}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="hidden rounded-md border border-border/50 bg-surface-2 px-2 py-1 text-[10px] font-bold text-text-secondary sm:inline">Ctrl+K</kbd>
            <button
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border/40 bg-surface-1 px-3 text-[11px] font-bold text-text-primary hover:bg-surface-2"
              onClick={() => void onSyncNow()}
              disabled={syncing}
            >
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Refresh
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-border/30 bg-surface-1/70 p-5 shadow-2xl shadow-black/20">
            <p className="text-[11px] font-bold text-text-muted">Now</p>
            {myActiveSession ? (
              <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">You are working on {myActiveSession.repoName}</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                    <span className="flex items-center gap-1.5"><GitBranch size={14} />{myActiveSession.branch || "main"}</span>
                    <span className="flex items-center gap-1.5"><Clock size={14} />{durationLabel(myActiveSession.startedAt)}</span>
                    {myRepo && myRepo.changedFileCount > 0 && <span className="text-status-dirty">{formatChangedFiles(myRepo.changedFileCount)}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="h-10 rounded-xl bg-accent px-4 text-xs font-bold text-white hover:bg-accent-hover" onClick={() => setFinishModalOpen(true)}>
                    <Square size={12} className="mr-1.5 inline" fill="currentColor" />Finish Work
                  </button>
                  {myRepo && <button className="h-10 rounded-xl border border-border/40 bg-surface-2 px-4 text-xs font-bold text-text-primary hover:bg-surface-3" onClick={() => void onOpenInCode(myRepo.path)}><Code2 size={13} className="mr-1.5 inline" />Open in VS Code</button>}
                  {myRepo && <button className="h-10 rounded-xl border border-border/40 bg-surface-2 px-4 text-xs font-bold text-text-primary hover:bg-surface-3" onClick={() => void onOpenTerminal(myRepo.path)}><Terminal size={13} className="mr-1.5 inline" />Terminal</button>}
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">You are not working</h2>
                  <p className="mt-2 text-sm text-text-secondary">
                    {suggestedItem ? `Start from ${suggestedItem.name}, or pick any project below.` : "Add your first Axiom project to begin."}
                  </p>
                </div>
                {suggestedItem && !suggestedItem.cloneRequired && (
                  <button className="h-10 rounded-xl bg-accent px-4 text-xs font-bold text-white hover:bg-accent-hover" onClick={() => startItem(suggestedItem)}>
                    <Play size={13} className="mr-1.5 inline" fill="currentColor" />Start Work
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/25 bg-surface-1/45 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-bold text-text-muted">Next</p>
              {attentionItems.length > 0 && <button className="text-[11px] font-bold text-accent" onClick={() => onNavigate("projects")}>Review all</button>}
            </div>
            {attentionItems.length > 0 ? (
              <NeedsAttention items={attentionItems} onAction={(item: AttentionItem) => item.actionLabel === "Open settings" ? onNavigate("settings") : onNavigate("projects")} />
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-border/15 bg-surface-2/20 p-3">
                <Check size={15} className="text-status-clean" />
                <div>
                  <p className="text-xs font-bold text-text-primary">Workspace clear</p>
                  <p className="mt-0.5 text-[11px] text-text-muted">No action needed before starting.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border/25 bg-surface-1/45">
          <div className="flex items-center justify-between border-b border-border/20 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Project Launcher</h2>
              <p className="mt-0.5 text-[11px] text-text-muted">Open, start, finish, review, or clone without leaving Home.</p>
            </div>
            {loading && <Loader2 size={14} className="animate-spin text-text-muted" />}
          </div>
          <div className="divide-y divide-border/15">
            {launcherItems.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-semibold text-text-primary">Add your first Axiom project</p>
                <p className="mt-2 text-xs text-text-muted">Projects appear here as launchable rows once registered or discovered.</p>
              </div>
            ) : launcherItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-surface-2/25">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-text-primary">{item.name}</p>
                  <p className="mt-1 truncate text-[11px] text-text-muted">{item.status} · {item.detail}</p>
                </div>
                <div className="hidden min-w-0 items-center gap-2 text-[11px] text-text-secondary md:flex">
                  <GitBranch size={12} />
                  <span className="truncate">{item.branch}</span>
                  {item.teammateSession && <span className="truncate text-status-dirty">{normalizeDisplayName(item.teammateSession.userName)}</span>}
                </div>
                <div className="flex items-center justify-end gap-2">
                  {item.repo && <button title="Open in VS Code" className="hidden h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-surface-3 hover:text-text-primary md:grid" onClick={() => void onOpenInCode(item.repo!.path)}><Code2 size={14} /></button>}
                  {item.repo && <button title="Open folder" className="hidden h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-surface-3 hover:text-text-primary md:grid" onClick={() => void onOpenFolder(item.repo!.path)}><FolderOpen size={14} /></button>}
                  <button
                    className={`h-8 rounded-lg px-3 text-[11px] font-bold ${item.needsReview && !item.session ? "bg-status-dirty/10 text-status-dirty hover:bg-status-dirty/15" : "bg-accent text-white hover:bg-accent-hover"}`}
                    onClick={() => primaryAction(item)}
                  >
                    {item.session ? "Finish" : item.cloneRequired ? "Clone Latest" : item.needsReview ? "Review" : "Start"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {recentImportant.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold text-text-muted">Recent</h2>
              <button className="text-[11px] font-bold text-accent" onClick={() => onNavigate("activity")}>Activity</button>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {recentImportant.map((event) => (
                <div key={event.id} className="rounded-xl border border-border/15 bg-surface-1/35 px-3 py-2.5">
                  <p className="truncate text-xs text-text-secondary">{humanizeActivityEvent(event)}</p>
                  <p className="mt-1 text-[10px] text-text-muted">{timeAgo(event.createdAt)}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {reviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={() => setReviewItem(null)}>
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-surface-1 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex gap-3">
              <AlertTriangle size={18} className="mt-0.5 text-status-dirty" />
              <div>
                <h2 className="text-sm font-bold text-text-primary">Review before starting</h2>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                  {reviewItem.name} is marked {reviewItem.status.toLowerCase()}. {reviewItem.detail}.
                  {reviewItem.teammateSession ? ` ${normalizeDisplayName(reviewItem.teammateSession.userName)} is active on this project.` : ""}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="h-9 rounded-lg border border-border/40 bg-surface-2 px-4 text-xs font-bold text-text-secondary hover:bg-surface-3" onClick={() => setReviewItem(null)}>Cancel</button>
              <button className="h-9 rounded-lg bg-accent px-4 text-xs font-bold text-white hover:bg-accent-hover" onClick={() => startItem(reviewItem, true)}>Start anyway</button>
            </div>
          </div>
        </div>
      )}

      {myActiveSession && (
        <FinishWorkModal
          open={finishModalOpen}
          projectName={myActiveSession.repoName}
          branch={myActiveSession.branch}
          startedAt={myActiveSession.startedAt}
          onClose={() => setFinishModalOpen(false)}
          onFinish={(summary, details) => {
            onFinishSession(myActiveSession.id, summary, details);
            setFinishModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
