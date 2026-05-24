import { useState } from "react";
import { Download, GitBranch, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import type { LiveRepo, WorkSession } from "../types";
import type { RegisteredProject } from "../types/workspace";
import { RepoCard } from "../components/RepoCard";
import { PageHeader } from "../components/PageHeader";
import { AddProjectModal } from "../components/AddProjectModal";
import { RepoDiscoveryModal } from "../components/RepoDiscoveryModal";
import { StartSessionModal } from "../components/StartSessionModal";
import { primaryBtnClass, secondaryBtnClass } from "../lib/constants";
import type { CreateSessionInput } from "../lib/sessions";

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
  getRepoSessions: (repo: LiveRepo) => WorkSession[];
  defaultUserName: string;
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
  getRepoSessions,
  defaultUserName,
}: ProjectsPageProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [sessionRepo, setSessionRepo] = useState<LiveRepo | null>(null);
  const installedProjectPaths = new Set(repos.map((repo) => repo.path.toLowerCase()));
  const missingProjects = registeredProjects.filter((project) => {
    if (project.installStatus === "not_installed") return true;
    return project.localPath ? !installedProjectPaths.has(project.localPath.toLowerCase()) : Boolean(project.repoUrl);
  });

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
              onClick={() => setShowAddModal(true)}
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
        ) : repos.length === 0 && missingProjects.length === 0 ? (
          <div className="flex h-96 flex-col items-center justify-center rounded-3xl border border-dashed border-border/50 bg-surface-1/30">
            <p className="text-lg font-medium text-text-primary mb-2">No projects yet</p>
            <p className="text-sm text-text-muted mb-8 max-w-sm text-center">
              Add your projects to start tracking work and coordination with your team.
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
          <div className="space-y-4">
            {missingProjects.length > 0 && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {missingProjects.map((project) => (
                  <div key={project.id} className="rounded-xl border border-border/30 bg-surface-1 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-text-primary">{project.name}</h3>
                        <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-text-muted">
                          <GitBranch size={10} />
                          {project.defaultBranch || "main"}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-text-muted">
                        Clone required
                      </span>
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-text-secondary">
                      This project is registered but missing on this device.
                    </p>
                    <div className="mt-3 flex items-center gap-2 border-t border-border/15 pt-3">
                      <button
                        className="h-7 px-3 rounded-lg bg-accent/10 border border-accent/20 text-[10px] font-bold text-accent hover:bg-accent/20 transition-all flex items-center gap-1.5"
                        onClick={() => void onCloneProject(project)}
                      >
                        <Download size={10} />
                        Clone Latest
                      </button>
                      <button
                        className="h-7 px-2.5 rounded-lg text-[10px] font-bold text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-all"
                        onClick={() => navigator.clipboard?.writeText(project.repoUrl)}
                      >
                        Copy Repo URL
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {repos.length > 0 && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {repos.map((repo) => (
                  <RepoCard
                    key={repo.path}
                    repo={repo}
                    nickname={repoNicknames[repo.path]}
                    refreshing={refreshingPaths.has(repo.path)}
                    pulling={pullingPaths.has(repo.path)}
                    activeSessions={getRepoSessions(repo)}
                    currentUser={defaultUserName}
                    onRefresh={() => onRefreshRepo(repo.path)}
                    onRemove={() => onRemoveRepo(repo.path)}
                    onRename={(name) => onRenameRepo(repo.path, name)}
                    onStartSession={() => setSessionRepo(repo)}
                    onFinishSession={onFinishSession}
                    onPull={() => onPullRepo(repo.path)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <AddProjectModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={(name, repoUrl, defaultBranch) => void onAddProject(name, repoUrl, defaultBranch)}
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
