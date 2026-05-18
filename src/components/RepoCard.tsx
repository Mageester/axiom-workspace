import { GitBranch, RefreshCw, X, AlertCircle, Loader2 } from "lucide-react";
import type { LiveRepo } from "../types";
import { StatusBadge } from "./StatusBadge";
import { iconBtnClass } from "../lib/constants";

interface RepoCardProps {
  repo: LiveRepo;
  refreshing: boolean;
  onRefresh: () => void;
  onRemove: () => void;
}

export function RepoCard({
  repo,
  refreshing,
  onRefresh,
  onRemove,
}: RepoCardProps) {
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-5 hover:border-border-hover transition-colors">
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
    </div>
  );
}
