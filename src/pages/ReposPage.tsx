import { useState } from "react";
import { Loader2, Plus, RefreshCw, Search } from "lucide-react";
import type { LiveRepo, WorkSession } from "../types";
import { RepoCard } from "../components/RepoCard";
import { PageHeader } from "../components/PageHeader";
import { AddRepoModal } from "../components/AddRepoModal";
import { RepoDiscoveryModal } from "../components/RepoDiscoveryModal";
import { StartSessionModal } from "../components/StartSessionModal";
import { primaryBtnClass, secondaryBtnClass } from "../lib/constants";
import type { CreateSessionInput } from "../lib/sessions";

interface ReposPageProps {
  repos: LiveRepo[];
  repoNicknames: Record<string, string>;
  activeSessions: WorkSession[];
  loading: boolean;
  refreshingPaths: Set<string>;
  pullingPaths: Set<string>;
  onRefreshAll: () => Promise<void>;
  onRefreshRepo: (path: string) => Promise<void>;
  onAddRepo: (path: string) => Promise<LiveRepo>;
  onRemoveRepo: (path: string) => void;
  onRenameRepo: (path: string, name: string) => void;
  onStartSession: (input: CreateSessionInput) => void;
  onPullRepo: (path: string) => Promise<void>;
  getRepoSessions: (repo: LiveRepo) => WorkSession[];
  defaultUserName: string;
}

export function ReposPage({
  repos,
  repoNicknames,
  activeSessions,
  loading,
  refreshingPaths,
  pullingPaths,
  onRefreshAll,
  onRefreshRepo,
  onAddRepo,
  onRemoveRepo,
  onRenameRepo,
  onStartSession,
  onPullRepo,
  getRepoSessions,
  defaultUserName,
}: ReposPageProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [sessionRepo, setSessionRepo] = useState<LiveRepo | null>(null);
  const cleanCount = repos.filter((repo) => repo.status === "clean").length;
  const changedCount = repos.filter((repo) => repo.hasUncommittedChanges).length;
  const updateCount = repos.filter((repo) => repo.behind > 0).length;
  const attentionCount = repos.filter((repo) => repo.status === "error" || repo.upstreamStatus === "error").length;

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        eyebrow="Read-only repo status"
        title="Repositories"
        description="Track project health without syncing source code. Axiom reads status and keeps coordination separate."
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
              Refresh All
            </button>
            <button
              className={secondaryBtnClass}
              onClick={() => setShowDiscoveryModal(true)}
            >
              <Search size={14} />
              Discover Repos
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

      <main className="space-y-6 p-8">
        {repos.length > 0 && (
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="rounded-xl border border-border/80 bg-surface-1/70 px-4 py-3">
              <p className="text-xs text-text-muted">Tracked</p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">{repos.length}</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-surface-1/70 px-4 py-3">
              <p className="text-xs text-text-muted">All good</p>
              <p className="mt-1 text-2xl font-semibold text-status-clean">{cleanCount}</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-surface-1/70 px-4 py-3">
              <p className="text-xs text-text-muted">Local changes</p>
              <p className="mt-1 text-2xl font-semibold text-status-dirty">{changedCount}</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-surface-1/70 px-4 py-3">
              <p className="text-xs text-text-muted">Review</p>
              <p className="mt-1 text-2xl font-semibold text-status-behind">{attentionCount + updateCount}</p>
            </div>
          </section>
        )}

        {loading && repos.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border/80 bg-surface-1/40">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 size={16} className="animate-spin" />
              Loading repositories...
            </div>
          </div>
        ) : repos.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-surface-1/40">
            <p className="text-sm text-text-muted mb-2">No repositories tracked yet.</p>
            <p className="text-xs text-text-muted mb-4 max-w-md text-center">
              Add your project repos so Axiom can track their status. This is read-only — Axiom never runs git write commands on your projects.
            </p>
            <button
              className={primaryBtnClass}
              onClick={() => setShowDiscoveryModal(true)}
            >
              <Search size={14} />
              Discover Repos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {repos.map((repo) => (
              <RepoCard
                key={repo.path}
                repo={repo}
                nickname={repoNicknames[repo.path]}
                refreshing={refreshingPaths.has(repo.path)}
                pulling={pullingPaths.has(repo.path)}
                activeSessions={getRepoSessions(repo)}
                onRefresh={() => onRefreshRepo(repo.path)}
                onRemove={() => onRemoveRepo(repo.path)}
                onRename={(name) => onRenameRepo(repo.path, name)}
                onStartSession={() => setSessionRepo(repo)}
                onPull={() => onPullRepo(repo.path)}
              />
            ))}
          </div>
        )}
      </main>

      <AddRepoModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={onAddRepo}
      />
      <RepoDiscoveryModal
        open={showDiscoveryModal}
        onClose={() => setShowDiscoveryModal(false)}
        onAddRepo={onAddRepo}
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
