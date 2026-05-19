import { useState } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import type { LiveRepo, WorkSession } from "../types";
import { RepoCard } from "../components/RepoCard";
import { PageHeader } from "../components/PageHeader";
import { AddRepoModal } from "../components/AddRepoModal";
import { StartSessionModal } from "../components/StartSessionModal";
import { primaryBtnClass, secondaryBtnClass } from "../lib/constants";
import type { CreateSessionInput } from "../lib/sessions";

interface ReposPageProps {
  repos: LiveRepo[];
  repoNicknames: Record<string, string>;
  activeSessions: WorkSession[];
  loading: boolean;
  refreshingPaths: Set<string>;
  onRefreshAll: () => Promise<void>;
  onRefreshRepo: (path: string) => Promise<void>;
  onAddRepo: (path: string) => Promise<LiveRepo>;
  onRemoveRepo: (path: string) => void;
  onRenameRepo: (path: string, name: string) => void;
  onStartSession: (input: CreateSessionInput) => void;
  getRepoSessions: (repo: LiveRepo) => WorkSession[];
  defaultUserName: string;
}

export function ReposPage({
  repos,
  repoNicknames,
  activeSessions,
  loading,
  refreshingPaths,
  onRefreshAll,
  onRefreshRepo,
  onAddRepo,
  onRemoveRepo,
  onRenameRepo,
  onStartSession,
  getRepoSessions,
  defaultUserName,
}: ReposPageProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [sessionRepo, setSessionRepo] = useState<LiveRepo | null>(null);

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        title="Repositories"
        description="All tracked project repositories. Axiom only reads repo status — it never writes to your project repos."
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
        {loading && repos.length === 0 ? (
          <div className="flex items-center justify-center h-64 rounded-lg border border-dashed border-border">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 size={16} className="animate-spin" />
              Loading repositories...
            </div>
          </div>
        ) : repos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed border-border">
            <p className="text-sm text-text-muted mb-2">No repositories tracked yet.</p>
            <p className="text-xs text-text-muted mb-4 max-w-md text-center">
              Add your project repos so Axiom can track their status. This is read-only — Axiom never runs git write commands on your projects.
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
                nickname={repoNicknames[repo.path]}
                refreshing={refreshingPaths.has(repo.path)}
                activeSessions={getRepoSessions(repo)}
                onRefresh={() => onRefreshRepo(repo.path)}
                onRemove={() => onRemoveRepo(repo.path)}
                onRename={(name) => onRenameRepo(repo.path, name)}
                onStartSession={() => setSessionRepo(repo)}
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
