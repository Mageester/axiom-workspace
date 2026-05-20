import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Timer,
  Upload,
  Users,
  X,
} from "lucide-react";
import type {
  LiveRepo,
  SetupState,
  SyncSettings,
  SyncStatus,
  WorkCard,
  WorkSession,
  WorkspaceEvent,
} from "../types";
import type { UpdateCheckResult } from "../lib/sync";
import { openUrl } from "@tauri-apps/plugin-opener";
import { RepoDiscoveryModal } from "../components/RepoDiscoveryModal";
import { StartSessionModal } from "../components/StartSessionModal";
import { PageHeader } from "../components/PageHeader";
import { iconBtnClass, secondaryBtnClass, primaryBtnClass } from "../lib/constants";
import type { CreateSessionInput } from "../lib/sessions";
import { assessCardRisk, getBoardStats } from "../lib/board";
import { getSystemJudgment } from "../lib/intelligence";

interface DashboardProps {
  repos: LiveRepo[];
  repoNicknames: Record<string, string>;
  cards: WorkCard[];
  activeSessions: WorkSession[];
  recentEvents: WorkspaceEvent[];
  loading: boolean;
  refreshingPaths: Set<string>;
  onRefreshAll: () => Promise<void>;
  onRefreshRepo: (path: string) => Promise<void>;
  onAddRepo: (path: string) => Promise<LiveRepo>;
  onRemoveRepo: (path: string) => void;
  onRenameRepo: (path: string, name: string) => void;
  onStartSession: (input: CreateSessionInput) => void;
  onFinishSession: (sessionId: string, endNote?: string) => void;
  getRepoSessions: (repo: LiveRepo) => WorkSession[];
  defaultUserName: string;
  setupState: SetupState;
  syncSettings: SyncSettings;
  syncStatus: SyncStatus;
  onSyncNow: () => Promise<void>;
  onDismissSuggestion: (id: string) => void;
  onPullAll: () => Promise<void>;
  onOpenBoard: () => void;
  updateInfo?: UpdateCheckResult | null;
  onDismissUpdate?: () => void;
}

function timeAgo(value?: string): string {
  if (!value) return "never";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function durationLabel(startedAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (minutes < 1) return "< 1m";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function syncStatusLabel(status: SyncStatus, setupComplete: boolean): string {
  if (!setupComplete) return "Local only";
  switch (status) {
    case "checking":
    case "writing_local_events":
    case "pulling_updates":
    case "reading_shared_events":
    case "merging":
    case "pushing":
      return "Syncing...";
    case "error":
      return "Sync needs attention";
    default:
      return "Synced";
  }
}

function eventLabel(type: string): string {
  switch (type) {
    case "session_created": return "Work started";
    case "session_ended": return "Work finished";
    case "session_updated": return "Note edited";
    case "sync_completed": return "Sync completed";
    case "repo_refreshed": return "Repo refreshed";
    default: return type;
  }
}

interface TeamMember {
  name: string;
  activeWork: WorkSession[];
  lastSeenAt?: string;
}

function buildTeamMembers(
  identityName: string,
  sessions: WorkSession[],
  events: WorkspaceEvent[],
): TeamMember[] {
  const byName = new Map<string, TeamMember>();
  const seed = [identityName, "Aidan", "Riley"].filter((n) => n && n.trim());
  for (const name of seed) {
    const key = name.trim();
    if (!byName.has(key.toLowerCase())) {
      byName.set(key.toLowerCase(), { name: key, activeWork: [] });
    }
  }
  for (const session of sessions) {
    const key = session.userName.trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key) ?? { name: session.userName.trim(), activeWork: [] };
    if (session.status === "active") existing.activeWork.push(session);
    const candidate = session.endedAt ?? session.startedAt;
    if (!existing.lastSeenAt || candidate > existing.lastSeenAt) {
      existing.lastSeenAt = candidate;
    }
    byName.set(key, existing);
  }
  for (const event of events) {
    const key = event.userName.trim().toLowerCase();
    if (!key) continue;
    const existing = byName.get(key) ?? { name: event.userName.trim(), activeWork: [] };
    if (!existing.lastSeenAt || event.createdAt > existing.lastSeenAt) {
      existing.lastSeenAt = event.createdAt;
    }
    byName.set(key, existing);
  }
  return Array.from(byName.values()).sort((a, b) => {
    if (a.activeWork.length !== b.activeWork.length) {
      return b.activeWork.length - a.activeWork.length;
    }
    return (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "");
  });
}

export function Dashboard({
  repos,
  cards,
  activeSessions,
  recentEvents,
  loading,
  onRefreshAll,
  onAddRepo,
  onStartSession,
  onFinishSession,
  defaultUserName,
  setupState,
  syncSettings,
  syncStatus,
  onSyncNow,
  onDismissSuggestion,
  onPullAll,
  onOpenBoard,
  updateInfo,
  onDismissUpdate,
}: DashboardProps) {
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [sessionRepo, setSessionRepo] = useState<LiveRepo | null>(null);
  const [startModalOpen, setStartModalOpen] = useState(false);

  const cleanRepos = repos.filter((r) => r.status === "clean").length;
  const dirtyRepos = repos.filter((r) => r.status === "dirty").length;
  const behindRepos = repos.filter((r) => r.status === "behind").length;
  const errorRepos = repos.filter((r) => r.status === "error").length;
  const syncing =
    syncStatus !== "idle" && syncStatus !== "complete" && syncStatus !== "error";
  const boardStats = useMemo(() => getBoardStats(cards), [cards]);
  const riskyCards = useMemo(
    () =>
      cards
        .map((card) => ({ card, risk: assessCardRisk(card, repos, activeSessions) }))
        .filter((item) => item.card.column !== "done" && item.risk.level !== "low")
        .sort((a, b) => {
          const order = { critical: 0, high: 1, medium: 2, low: 3 };
          return order[a.risk.level] - order[b.risk.level];
        })
        .slice(0, 4),
    [activeSessions, cards, repos],
  );
  const attentionRepos = useMemo(
    () =>
      repos
        .filter((repo) => repo.status !== "clean" || repo.behind > 0 || repo.hasUncommittedChanges)
        .sort((a, b) => {
          const score = (repo: LiveRepo) =>
            (repo.status === "error" ? 100 : 0) +
            (repo.hasUncommittedChanges ? 50 : 0) +
            repo.behind * 5;
          return score(b) - score(a);
        })
        .slice(0, 4),
    [repos],
  );

  const systemJudgment = useMemo(() => getSystemJudgment(repos), [repos]);

  const teamMembers = useMemo(
    () => buildTeamMembers(defaultUserName, activeSessions, recentEvents),
    [defaultUserName, activeSessions, recentEvents],
  );

  const suggestions = useMemo(() => {
    const dismissed = new Set(syncSettings.dismissedSuggestions);
    const items: {
      id: string;
      title: string;
      explanation: string;
      actionLabel?: string;
      action?: () => void;
    }[] = [];

    const myName = defaultUserName.trim().toLowerCase();
    const myActiveRepoIds = new Set(
      activeSessions
        .filter((s) => s.userName.trim().toLowerCase() === myName)
        .map((s) => s.repoId),
    );
    const dirtyCandidate = repos.find(
      (repo) =>
        repo.hasUncommittedChanges &&
        repo.status !== "error" &&
        !myActiveRepoIds.has(repo.id),
    );
    if (dirtyCandidate) {
      items.push({
        id: `start-work-${dirtyCandidate.path}`,
        title: `Working on ${dirtyCandidate.name}?`,
        explanation: `${dirtyCandidate.changedFileCount} unsaved change${dirtyCandidate.changedFileCount === 1 ? "" : "s"} found. Let the team know what you're working on.`,
        actionLabel: "Start Work",
        action: () => setSessionRepo(dirtyCandidate),
      });
    }

    if (activeSessions.length > 0 && !syncSettings.lastSyncAt) {
      items.push({
        id: "active-unsynced",
        title: "Active work has not synced yet.",
        explanation: "Sync so the team can see what is in motion.",
        actionLabel: "Sync Now",
        action: () => void onSyncNow(),
      });
    }
    return items.filter((item) => !dismissed.has(item.id)).slice(0, 3);
  }, [activeSessions, defaultUserName, onSyncNow, repos, syncSettings.dismissedSuggestions, syncSettings.lastSyncAt]);

  const topRecentEvents = useMemo(
    () =>
      [...recentEvents]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [recentEvents],
  );

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        title="Home"
        description="Team status and active work."
        actions={
          <button
            className={primaryBtnClass}
            onClick={() => setStartModalOpen(true)}
            disabled={repos.length === 0}
          >
            <Play size={14} />
            Start Work
          </button>
        }
      />

      <main className="p-8 space-y-6">
        {updateInfo && updateInfo.available && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">
                Update available — {updateInfo.latestVersion}
              </p>
              <p className="mt-0.5 text-sm text-text-muted">
                A newer Axiom Workspace is ready to install.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={primaryBtnClass}
                onClick={() => void openUrl(updateInfo.url)}
              >
                Download
              </button>
              {onDismissUpdate && (
                <button
                  className={iconBtnClass}
                  title="Dismiss"
                  onClick={onDismissUpdate}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </section>
        )}

        {suggestions.length > 0 && (
          <section className="space-y-2">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-1 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {suggestion.title}
                  </p>
                  <p className="mt-0.5 text-sm text-text-muted">
                    {suggestion.explanation}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {suggestion.action && suggestion.actionLabel && (
                    <button className={secondaryBtnClass} onClick={suggestion.action}>
                      {suggestion.actionLabel}
                    </button>
                  )}
                  <button
                    className={iconBtnClass}
                    title="Dismiss"
                    onClick={() => onDismissSuggestion(suggestion.id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ClipboardList size={16} className="text-accent" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                  Work Board
                </h3>
              </div>
              <button className={secondaryBtnClass} onClick={onOpenBoard}>
                Open Board
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-md border border-border bg-surface-0 px-3 py-2.5">
                <p className="text-xs uppercase tracking-wide text-text-muted">Cards</p>
                <p className="mt-1 text-lg font-semibold text-text-primary">{cards.length}</p>
              </div>
              <div className="rounded-md border border-border bg-surface-0 px-3 py-2.5">
                <p className="text-xs uppercase tracking-wide text-text-muted">Active</p>
                <p className="mt-1 text-lg font-semibold text-status-behind">{boardStats.active}</p>
              </div>
              <div className="rounded-md border border-border bg-surface-0 px-3 py-2.5">
                <p className="text-xs uppercase tracking-wide text-text-muted">Blocked</p>
                <p className="mt-1 text-lg font-semibold text-status-locked">{boardStats.blocked}</p>
              </div>
              <div className="rounded-md border border-border bg-surface-0 px-3 py-2.5">
                <p className="text-xs uppercase tracking-wide text-text-muted">Review</p>
                <p className="mt-1 text-lg font-semibold text-status-dirty">{boardStats.review}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-status-dirty" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Needs Attention
              </h3>
            </div>
            {riskyCards.length === 0 ? (
              <p className="text-sm text-text-muted">No risky board cards right now.</p>
            ) : (
              <div className="space-y-2">
                {riskyCards.map(({ card, risk }) => (
                  <button
                    key={card.id}
                    className="w-full rounded-md border border-border bg-surface-0 px-3 py-2 text-left transition-colors hover:border-border-hover"
                    onClick={onOpenBoard}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-text-primary">{card.title}</p>
                      <span className="shrink-0 text-xs capitalize text-status-dirty">{risk.level}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-text-muted">
                      {risk.reasons[0] ?? "Review this card"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-accent" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                System Judgment
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-md border border-border bg-surface-0 px-3 py-2.5">
                <p className="text-xs uppercase tracking-wide text-text-muted">Safe</p>
                <p className="mt-1 text-lg font-semibold text-status-clean">{systemJudgment.safeCount}</p>
              </div>
              <div className="rounded-md border border-border bg-surface-0 px-3 py-2.5">
                <p className="text-xs uppercase tracking-wide text-text-muted">Needs Review</p>
                <p className="mt-1 text-lg font-semibold text-status-dirty">{systemJudgment.needsReviewCount}</p>
              </div>
              <div className="rounded-md border border-border bg-surface-0 px-3 py-2.5">
                <p className="text-xs uppercase tracking-wide text-text-muted">Highest Risk</p>
                <p className="mt-1 truncate text-lg font-semibold text-status-locked" title={systemJudgment.highestRiskRepo?.name ?? "—"}>
                  {systemJudgment.highestRiskRepo?.name ?? "—"}
                </p>
              </div>
              <div className="rounded-md border border-border bg-surface-0 px-3 py-2.5">
                <p className="text-xs uppercase tracking-wide text-text-muted">Action</p>
                <p className="mt-1 truncate text-xs leading-5 font-medium text-status-behind">
                  {systemJudgment.systemRecommendation}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-status-dirty" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Safety Breakdown
              </h3>
            </div>
            <div className="space-y-2">
              {Object.entries(systemJudgment.breakdown).filter(([, count]) => count > 0).map(([state, count]) => (
                <div key={state} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">{state.replace(/_/g, " ")}</span>
                  <span className="rounded border border-border bg-surface-2 px-2 py-0.5 font-medium text-text-primary">{count}</span>
                </div>
              ))}
              {Object.values(systemJudgment.breakdown).every((c) => c === 0) && (
                <p className="text-xs text-text-muted">No repos tracked.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users size={16} className="text-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Team Status
            </h3>
          </div>
          {!setupState.setupComplete ? (
            <p className="text-sm text-text-muted">
              Local only — connect sync to see team status.
            </p>
          ) : teamMembers.every((m) => m.activeWork.length === 0) ? (
            <p className="text-sm text-text-muted">
              No one is working right now.
            </p>
          ) : null}

          {setupState.setupComplete && (
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              {teamMembers.map((member) => (
                <div
                  key={member.name}
                  className="rounded-md border border-border bg-surface-0 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-text-primary">
                      {member.name}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 text-xs ${
                        member.activeWork.length > 0
                          ? "text-status-clean"
                          : "text-text-muted"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          member.activeWork.length > 0
                            ? "bg-status-clean"
                            : "bg-text-muted/40"
                        }`}
                      />
                      {member.activeWork.length > 0 ? "Working" : "Idle"}
                    </span>
                  </div>
                  {member.activeWork.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {member.activeWork.map((session) => (
                        <div key={session.id} className="text-xs">
                          <p className="truncate text-text-primary">
                            {session.title}
                          </p>
                          <p className="text-text-muted">
                            {session.repoName} · {durationLabel(session.startedAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-text-muted">
                      Last seen {timeAgo(member.lastSeenAt)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Briefcase size={16} className="text-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Active Work
            </h3>
            <span className="rounded-md border border-border px-2 py-0.5 text-xs text-text-muted">
              {activeSessions.length}
            </span>
          </div>
          {activeSessions.length === 0 ? (
            <p className="text-sm text-text-muted">
              No active work. Click Start Work above to begin.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {activeSessions.map((session) => {
                const isMine =
                  defaultUserName.trim().toLowerCase() ===
                  session.userName.trim().toLowerCase();
                const areaLabel =
                  session.targets[0]?.label ?? session.targets[0]?.value ?? "—";
                return (
                  <div
                    key={session.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface-0 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {session.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-text-muted">
                        {session.userName} · {session.repoName} · {areaLabel}
                      </p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-text-muted">
                        <Clock size={11} />
                        {durationLabel(session.startedAt)}
                      </p>
                    </div>
                    {isMine && (
                      <button
                        className={secondaryBtnClass}
                        onClick={() => onFinishSession(session.id)}
                        title="Finish Work"
                      >
                        Finish
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Repo Health
            </h3>
            <button
              className={`${iconBtnClass} ml-auto`}
              title="Refresh repos"
              onClick={() => void onRefreshAll()}
              disabled={loading || repos.length === 0}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
            </button>
          </div>
          {repos.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">
                Add your Axiom repos to start tracking work.
              </p>
              <button
                className={primaryBtnClass}
                onClick={() => setShowDiscoveryModal(true)}
              >
                <Search size={14} />
                Find Axiom Repos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-md border border-border bg-surface-0 px-3 py-2.5" title="Repos with no uncommitted changes and up to date with remote">
                <p className="text-xs uppercase tracking-wide text-text-muted">All Good</p>
                <p className="mt-1 text-lg font-semibold text-status-clean">{cleanRepos}</p>
              </div>
              <div className="rounded-md border border-border bg-surface-0 px-3 py-2.5" title="Repos with local changes that haven't been committed">
                <p className="text-xs uppercase tracking-wide text-text-muted">Unsaved Changes</p>
                <p className="mt-1 text-lg font-semibold text-status-dirty">{dirtyRepos}</p>
              </div>
              <div className="rounded-md border border-border bg-surface-0 px-3 py-2.5" title="Repos where the remote has newer commits you can pull">
                <p className="text-xs uppercase tracking-wide text-text-muted">Updates Available</p>
                <p className="mt-1 text-lg font-semibold text-status-behind">{behindRepos}</p>
              </div>
              <div className="rounded-md border border-border bg-surface-0 px-3 py-2.5" title="Repos that had an error during the last check">
                <p className="text-xs uppercase tracking-wide text-text-muted">Needs Attention</p>
                <p className="mt-1 text-lg font-semibold text-status-locked">{errorRepos}</p>
              </div>
            </div>
          )}
          {repos.length > 0 && behindRepos > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-status-behind/30 bg-status-behind/10 px-3 py-2">
              <div className="flex items-start gap-2 text-xs text-status-behind">
                <Download size={14} className="mt-0.5 shrink-0" />
                <span>
                  {behindRepos} repo{behindRepos === 1 ? " has" : "s have"} updates available.
                </span>
              </div>
              <button
                className={secondaryBtnClass}
                onClick={() => void onPullAll()}
                title="Pull the latest changes for all repos that are behind"
              >
                <Download size={14} />
                Pull All
              </button>
            </div>
          )}
          {repos.length > 0 && (dirtyRepos > 0 || errorRepos > 0) && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-status-dirty/30 bg-status-dirty/10 px-3 py-2 text-xs text-status-dirty">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {dirtyRepos > 0 && `${dirtyRepos} repo${dirtyRepos === 1 ? "" : "s"} with unsaved changes. `}
                {errorRepos > 0 && `${errorRepos} repo${errorRepos === 1 ? "" : "s"} need attention.`}
              </span>
            </div>
          )}
          {attentionRepos.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              {attentionRepos.map((repo) => (
                <div key={repo.id} className="rounded-md border border-border bg-surface-0 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-text-primary">{repo.name}</p>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
                      {repo.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-text-muted">
                    {repo.hasUncommittedChanges && `${repo.changedFileCount} changed file${repo.changedFileCount === 1 ? "" : "s"}. `}
                    {repo.behind > 0 && `${repo.behind} update${repo.behind === 1 ? "" : "s"} available. `}
                    {repo.errorMessage ?? ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Activity size={16} className="text-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Recent Activity
            </h3>
          </div>
          {topRecentEvents.length === 0 ? (
            <p className="text-sm text-text-muted">
              No recent activity. Start work or sync to see events.
            </p>
          ) : (
            <ul className="space-y-2">
              {topRecentEvents.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-text-primary">
                    {eventLabel(event.type)}
                    <span className="ml-2 text-text-muted">{event.userName}</span>
                  </span>
                  <span className="shrink-0 text-xs text-text-muted">
                    {timeAgo(event.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface-1 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Upload
                size={15}
                className={
                  !setupState.setupComplete
                    ? "text-text-muted"
                    : syncSettings.lastSyncError
                      ? "text-status-locked"
                      : "text-status-clean"
                }
              />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {syncStatusLabel(syncStatus, setupState.setupComplete)}
                </p>
                <p className="text-xs text-text-muted">
                  Synced {timeAgo(syncSettings.lastSyncAt)}
                </p>
              </div>
            </div>
            {setupState.setupComplete && (
              <button
                className={secondaryBtnClass}
                onClick={() => void onSyncNow()}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                Sync Now
              </button>
            )}
          </div>
          {syncSettings.lastSyncError && (
            <p className="mt-2 text-xs text-status-locked">
              {syncSettings.lastSyncError}
            </p>
          )}
        </section>

        {activeSessions.length === 0 && repos.length > 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Timer size={20} className="mx-auto mb-2 text-text-muted" />
            <p className="text-sm text-text-primary">
              Ready to start? Hit Start Work to let the team know what you're doing.
            </p>
          </div>
        )}
      </main>

      <RepoDiscoveryModal
        open={showDiscoveryModal}
        onClose={() => setShowDiscoveryModal(false)}
        onAddRepo={onAddRepo}
      />
      <StartSessionModal
        open={sessionRepo !== null || startModalOpen}
        repos={repos}
        activeSessions={activeSessions}
        initialRepo={sessionRepo}
        defaultUserName={defaultUserName}
        onClose={() => {
          setSessionRepo(null);
          setStartModalOpen(false);
        }}
        onCreate={(input) => {
          onStartSession(input);
          setSessionRepo(null);
          setStartModalOpen(false);
        }}
      />
    </div>
  );
}
