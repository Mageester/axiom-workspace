import { GitBranch } from "lucide-react";
import type { Repo } from "../types";
import { StatusBadge } from "./StatusBadge";

interface RepoCardProps {
  repo: Repo;
}

export function RepoCard({ repo }: RepoCardProps) {
  return (
    <div className="bg-surface-1 border border-border rounded-lg p-5 hover:border-border-hover transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">{repo.name}</h3>
          <p className="text-xs text-text-muted mt-1">{repo.description}</p>
        </div>
        <StatusBadge status={repo.status} />
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <GitBranch size={12} />
          <span className="font-mono">{repo.branch}</span>
        </div>
        <span className="text-xs text-text-muted">{repo.lastSync}</span>
      </div>
    </div>
  );
}
