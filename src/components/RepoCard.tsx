import {
  AlertCircle,
  GitBranch,
  Loader2,
  Play,
  RefreshCw,
  Timer,
  X,
} from "lucide-react";
import type { LiveRepo, WorkSession } from "../types";
import { StatusBadge } from "./StatusBadge";
import { iconBtnClass, secondaryBtnClass } from "../lib/constants";

interface RepoCardProps {
  repo: LiveRepo;
  refreshing: boolean;
  activeSessions: WorkSession[];
  onRefresh: () => void;
  onRemove: () => void;
  onStartSession: () => void;
}

export function RepoCard({
  repo,
  refreshing,
  activeSessions,
  onRefresh,
  onRemove,
  onStartSession,
}: RepoCardProps) {
  const hasActiveSessions = activeSessions.length > 0;

  return (
    <div
      className={`rounded-lg border bg-surface-1 p-5 transition-colors hover:border-border-hover ${
        hasActiveSessions ? "border-status-dirty/50" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1 mr-3">
          <h3 className="text-sm font-medium text-text-primary truncate">
            {repo.name}
          </h3>
          <p className="text-xs text-text-muted mt-1 truncate">{repo.path}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <StatusBadge status={repo.status} />
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={iconBtnClass}
            title="Refresh"
          >
            {refreshing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
          </button>
          <button
            onClick={onRemove}
            className={`${iconBtnClass} hover:!text-status-locked`}
            title="Remove"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {repo.status === "error" && repo.errorMessage && (
        <div className="flex items-start gap-2 mb-3 px-2 py-1.5 rounded bg-status-locked/10 border border-status-locked/20">
          <AlertCircle size={12} className="text-status-locked shrink-0 mt-0.5" />
          <p className="text-xs text-status-locked">{repo.errorMessage}</p>
        </div>
      )}

      {hasActiveSessions && (
        <div className="mb-3 rounded-md border border-status-dirty/30 bg-status-dirty/10 px-3 py-2">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-status-dirty">
            <Timer size={12} />
            {activeSessions.length} active session
            {activeSessions.length === 1 ? "" : "s"}
          </div>
          <div className="space-y-1">
            {activeSessions.slice(0, 3).map((session) => (
              <p key={session.id} className="truncate text-xs text-text-secondary">
                {session.userName}: {session.title}
              </p>
            ))}
            {activeSessions.length > 3 && (
              <p className="text-xs text-text-muted">
                +{activeSessions.length - 3} more
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <GitBranch size={12} />
          <span className="font-mono">
            {repo.currentBranch || "—"}
          </span>
        </div>
        {repo.isGitRepo && (repo.ahead > 0 || repo.behind > 0) && (
          <span className="text-xs text-text-muted">
            {repo.ahead > 0 && `↑${repo.ahead}`}
            {repo.ahead > 0 && repo.behind > 0 && " "}
            {repo.behind > 0 && `↓${repo.behind}`}
          </span>
        )}
      </div>

      <button
        className={`${secondaryBtnClass} mt-4 w-full justify-center`}
        onClick={onStartSession}
      >
        <Play size={14} />
        Start Session
      </button>
    </div>
  );
}
