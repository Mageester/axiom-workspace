import { useState, useMemo } from "react";
import { AlertTriangle, Clock, Plus, RefreshCw, Loader2, Timer } from "lucide-react";
import type {
  LiveRepo,
  RepoStatus,
  SetupState,
  SyncSettings,
  SyncStatus,
  WorkSession,
} from "../types";
import { RepoCard } from "../components/RepoCard";
import { StatusBadge } from "../components/StatusBadge";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";
import { AddRepoModal } from "../components/AddRepoModal";
import { StartSessionModal } from "../components/StartSessionModal";
import { secondaryBtnClass, primaryBtnClass } from "../lib/constants";
import type { CreateSessionInput } from "../lib/sessions";

interface DashboardProps {
  repos: LiveRepo[];
  activeSessions: WorkSession[];
  loading: boolean;
  refreshingPaths: Set<string>;
  onRefreshAll: () => Promise<void>;
  onRefreshRepo: (path: string) => Promise<void>;
  onAddRepo: (path: string) => Promise<LiveRepo>;
  onRemoveRepo: (path: string) => void;
  onStartSession: (input: CreateSessionInput) => void;
  getRepoSessions: (repo: LiveRepo) => WorkSession[];
  defaultUserName: string;
  setupState: SetupState;
  syncSettings: SyncSettings;
  syncStatus: SyncStatus;
  onSyncNow: () => Promise<void>;
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "Not synced yet";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function syncStatusLabel(status: SyncStatus, setupComplete: boolean): string {
  if (!setupComplete) return "Local only";
  switch (status) {
    case "checking": return "Checking...";
    case "writing_local_events": return "Writing events...";
    case "pulling_updates": return "Pulling updates...";
    case "reading_shared_events": return "Reading events...";
    case "merging": return "Merging...";
    case "pushing": return "Pushing...";
    case "complete": return "Connected";
    case "error": return "Needs attention";
    default: return "Connected";
  }
}

export function Dashboard({
  repos,
  activeSessions,
  loading,
  refreshingPaths,
  onRefreshAll,
  onRefreshRepo,
  onAddRepo,
  onRemoveRepo,
  onStartSession,
  getRepoSessions,
  defaultUserName,
  setupState,
  syncSettings,
  syncStatus,
  onSyncNow,
}: DashboardProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [sessionRepo, setSessionRepo] = useState<LiveRepo | null>(null);

  const counts = useMemo(
    () =>
      repos.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        },
        {} as Record<RepoStatus, number>,
      ),
    [repos],
  );
  const cleanRepos = repos.filter((repo) => repo.status === "clean").length;
  const warningRepos = repos.filter(
    (repo) =>
      repo.status === "dirty" ||
      repo.status === "behind" ||
      repo.status === "locked",
  ).length;
  const errorRepos = counts.error ?? 0;
  const syncing =
    syncStatus !== "idle" && syncStatus !== "complete" && syncStatus !== "error";

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        title="Dashboard"
        description="Workspace overview and repo status"
        actions={
          <div className="flex items-center gap-2">
            <button
              className={secondaryBtnClass}
              onClick={onRefreshAll}
              disabled={loading || repos.length === 0}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Refresh
            </button>
            <button
              className={primaryBtnClass}
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={14} />
              Add Repo
            </button>
          </div>
        }
      />

      <main className="p-8">
        <section
          className={`mb-6 rounded-lg border p-5 ${
            setupState.setupComplete
              ? "border-border bg-surface-1"
              : "border-status-dirty/30 bg-status-dirty/10"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                {!setupState.setupComplete && (
                  <AlertTriangle size={16} className="text-status-dirty" />
                )}
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                  Team Sync
                </h3>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-text-muted">
                {setupState.setupComplete
                  ? "Sessions, locks, and notes sync through the Axiom team workspace. Source code stays in normal project repos."
                  : "Axiom is local-only until the team sync workspace is connected."}
              </p>
              {syncSettings.lastSyncError && (
                <p className="mt-2 text-sm text-status-locked">
                  {syncSettings.lastSyncError}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-md border border-border bg-surface-0 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-text-muted">
                  Status
                </p>
                <p className="mt-1 text-sm text-text-primary">
                  {syncStatusLabel(syncStatus, setupState.setupComplete)}
                </p>
              </div>
              <div className="rounded-md border border-border bg-surface-0 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-text-muted">
                  Last sync
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-text-primary">
                  <Clock size={13} />
                  {formatDateTime(syncSettings.lastSyncAt)}
                </p>
              </div>
              {setupState.setupComplete && (
                <button
                  className={primaryBtnClass}
                  onClick={() => void onSyncNow()}
                  disabled={syncing}
                >
                  {syncing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  {syncing ? "Syncing..." : "Sync Now"}
                </button>
              )}
            </div>
          </div>
        </section>

        <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Total Repos" value={repos.length} />
          <StatCard label="Clean Repos" value={cleanRepos} />
          <StatCard label="Warnings / Errors" value={warningRepos + errorRepos} />
          <StatCard label="Active Sessions" value={activeSessions.length} />
        </div>

        {activeSessions.length > 0 && (
          <section className="mb-6 rounded-lg border border-accent/30 bg-accent/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Timer size={16} className="text-accent" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">
                Currently Working
              </h3>
              <span className="rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs text-accent">
                {activeSessions.length} active
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {activeSessions.slice(0, 6).map((session) => (
                <div key={session.id} className="flex items-start gap-3 rounded-md border border-border bg-surface-1 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{session.title}</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {session.userName} in {session.repoName}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 text-xs text-text-muted">
                    <Clock size={11} />
                    {(() => {
                      const minutes = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 60000);
                      if (minutes < 1) return "< 1m";
                      if (minutes < 60) return `${minutes}m`;
                      return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
              Repositories
            </h3>
            {repos.length > 0 && (
              <div className="flex items-center gap-2">
                {(counts.clean ?? 0) > 0 && <StatusBadge status="clean" />}
                {(counts.dirty ?? 0) > 0 && <StatusBadge status="dirty" />}
                {(counts.behind ?? 0) > 0 && <StatusBadge status="behind" />}
                {(counts.error ?? 0) > 0 && <StatusBadge status="error" />}
              </div>
            )}
          </div>

          {loading && repos.length === 0 ? (
            <div className="flex items-center justify-center h-64 rounded-lg border border-dashed border-border">
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 size={16} className="animate-spin" />
                Loading repositories...
              </div>
            </div>
          ) : repos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed border-border">
              <p className="text-sm text-text-muted mb-2">
                No repositories tracked yet.
              </p>
              <p className="text-xs text-text-muted mb-4 max-w-md text-center">
                Add repos like Axiom Site or Pipeline Engine. Axiom reads their status but never writes to them.
              </p>
              <button
                className={primaryBtnClass}
                onClick={() => setShowAddModal(true)}
              >
                <Plus size={14} />
                Add Your First Repo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {repos.map((repo) => (
                <RepoCard
                  key={repo.path}
                  repo={repo}
                  refreshing={refreshingPaths.has(repo.path)}
                  activeSessions={getRepoSessions(repo)}
                  onRefresh={() => onRefreshRepo(repo.path)}
                  onRemove={() => onRemoveRepo(repo.path)}
                  onStartSession={() => setSessionRepo(repo)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <AddRepoModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={onAddRepo}
      />
      <StartSessionModal
        open={sessionRepo !== null}
        repos={repos}
        activeSessions={activeSessions}
        initialRepo={sessionRepo}
        defaultUserName={defaultUserName}
        onClose={() => setSessionRepo(null)}
        onCreate={(input) => {
          onStartSession(input);
          setSessionRepo(null);
        }}
      />
    </div>
  );
}
