import { useState, useMemo } from "react";
import { Plus, RefreshCw, Loader2 } from "lucide-react";
import type { LiveRepo, RepoStatus, WorkSession } from "../types";
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
        <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Total Repos" value={repos.length} />
          <StatCard label="Clean Repos" value={cleanRepos} />
          <StatCard label="Warnings / Errors" value={warningRepos + errorRepos} />
          <StatCard label="Active Sessions" value={activeSessions.length} />
        </div>

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
                Loading repositories…
              </div>
            </div>
          ) : repos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed border-border">
              <p className="text-sm text-text-muted mb-3">
                No repositories added yet
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
