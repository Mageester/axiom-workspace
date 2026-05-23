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

interface ProjectsPageProps {
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

export function ProjectsPage({
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
}: ProjectsPageProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [sessionRepo, setSessionRepo] = useState<LiveRepo | null>(null);

  return (
    <div className="flex-1 overflow-auto bg-surface-0">
      <PageHeader
        eyebrow="Workspace status"
        title="Projects"
        description="A clean overview of your tracked repositories and their current state."
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
              onClick={() => setShowDiscoveryModal(true)}
            >
              <Plus size={14} />
              Add Project
            </button>
          </div>
        }
      />

      <main className="space-y-6 p-8 max-w-7xl mx-auto">
        {loading && repos.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 size={16} className="animate-spin" />
              Loading projects...
            </div>
          </div>
        ) : repos.length === 0 ? (
          <div className="flex h-96 flex-col items-center justify-center rounded-3xl border border-dashed border-border/50 bg-surface-1/30">
            <p className="text-lg font-medium text-text-primary mb-2">No projects yet</p>
            <p className="text-sm text-text-muted mb-8 max-w-sm text-center">
              Add your repositories to start tracking work and coordination with your team.
            </p>
            <button
              className={primaryBtnClass}
              onClick={() => setShowDiscoveryModal(true)}
            >
              <Search size={14} />
              Find Repositories
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
