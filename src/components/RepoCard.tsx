import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  FolderOpen,
  GitBranch,
  Loader2,
  Play,
  RefreshCw,
  Timer,
  Trash2,
} from "lucide-react";
import { revealItemInDir, openPath } from "@tauri-apps/plugin-opener";
import type { LiveRepo, RepoChangeKind, WorkSession } from "../types";
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

const changeKindLabels: Record<RepoChangeKind, string> = {
  added: "Added",
  deleted: "Deleted",
  modified: "Modified",
  renamed: "Renamed",
  untracked: "Untracked",
};

function formatLastChecked(value: string): string {
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric * 1000)
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not checked yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

async function openFolder(path: string) {
  try {
    await revealItemInDir(path);
  } catch {
    try {
      await openPath(path);
    } catch {
      // Silently fail if opener is unavailable
    }
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard API not available in some contexts
  }
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
  const [detailsOpen, setDetailsOpen] = useState(repo.status === "dirty");
  const [copied, setCopied] = useState(false);
  const hasDirtyFiles = repo.status === "dirty" && repo.changedFileCount > 0;
  const hasDetails =
    hasDirtyFiles ||
    repo.status === "error" ||
    repo.upstreamStatus === "missing" ||
    repo.upstreamStatus === "error" ||
    repo.behind > 0;
  const detailSummary = useMemo(() => {
    if (hasDirtyFiles) {
      return `${repo.changedFileCount} changed file${
        repo.changedFileCount === 1 ? "" : "s"
      }`;
    }
    if (repo.status === "error") {
      return "Action needed";
    }
    if (repo.behind > 0) {
      return `${repo.behind} commit${repo.behind === 1 ? "" : "s"} behind`;
    }
    if (repo.upstreamStatus === "missing") {
      return "No upstream branch";
    }
    return "Details";
  }, [hasDirtyFiles, repo]);

  useEffect(() => {
    if (repo.status === "dirty") {
      setDetailsOpen(true);
    }
  }, [repo.lastCheckedAt, repo.status]);

  return (
    <div
      className={`rounded-lg border bg-surface-1 p-5 transition-colors hover:border-border-hover ${
        hasActiveSessions ? "border-status-dirty/50" : "border-border"
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="mr-3 min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-text-primary">
            {repo.name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 min-w-0">
            <p className="truncate text-xs text-text-muted">{repo.path}</p>
            <button
              className={`${iconBtnClass} shrink-0`}
              title={copied ? "Copied!" : "Copy path"}
              onClick={() => {
                void copyToClipboard(repo.path);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Copy size={10} />
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge status={repo.status} />
          <button
            onClick={() => void openFolder(repo.path)}
            className={iconBtnClass}
            title="Open folder"
          >
            <FolderOpen size={12} />
          </button>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className={iconBtnClass}
            title={refreshing ? "Refreshing repo status" : "Refresh repo status"}
          >
            {refreshing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Remove ${repo.name} from Axiom? This does not delete the repo folder.`)) {
                onRemove();
              }
            }}
            className={`${iconBtnClass} hover:!text-status-locked`}
            title="Remove repo from Axiom"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {repo.status === "error" && repo.errorMessage && (
        <div className="mb-3 flex items-start gap-2 rounded border border-status-locked/20 bg-status-locked/10 px-2 py-1.5">
          <AlertCircle
            size={12}
            className="mt-0.5 shrink-0 text-status-locked"
          />
          <p className="text-xs text-status-locked">{repo.errorMessage}</p>
        </div>
      )}

      {hasDirtyFiles && (
        <div className="mb-3 rounded-md border border-status-dirty/30 bg-status-dirty/10 px-3 py-2">
          <div className="flex items-start gap-2">
            <FileText size={13} className="mt-0.5 shrink-0 text-status-dirty" />
            <div>
              <p className="text-sm font-medium text-status-dirty">
                Local changes detected
              </p>
              <p className="mt-0.5 text-xs leading-5 text-text-secondary">
                This repo has local changes that are not committed.
              </p>
            </div>
          </div>
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

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <GitBranch size={12} />
          <span className="font-mono">{repo.currentBranch || "-"}</span>
        </div>
        {repo.isGitRepo && (repo.ahead > 0 || repo.behind > 0) && (
          <span className="text-xs text-text-muted">
            {repo.ahead > 0 && `ahead ${repo.ahead}`}
            {repo.ahead > 0 && repo.behind > 0 && " "}
            {repo.behind > 0 && `behind ${repo.behind}`}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-text-muted">
        <span>Last checked {formatLastChecked(repo.lastCheckedAt)}</span>
        {refreshing && (
          <span className="inline-flex items-center gap-1 text-accent">
            <Loader2 size={11} className="animate-spin" />
            Checking
          </span>
        )}
      </div>

      {hasDetails && (
        <div className="mt-3 border-t border-border pt-3">
          <button
            className="flex w-full items-center justify-between gap-3 text-left text-xs text-text-secondary hover:text-text-primary"
            onClick={() => setDetailsOpen((open) => !open)}
          >
            <span>{detailSummary}</span>
            {detailsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {detailsOpen && (
            <div className="mt-3 space-y-3">
              {hasDirtyFiles && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                    Dirty files
                  </p>
                  <div className="space-y-1.5">
                    {repo.changedFiles.map((file) => (
                      <div
                        key={`${file.kind}-${file.oldPath || ""}-${file.path}`}
                        className="flex items-start gap-2 rounded border border-border bg-surface-0 px-2 py-1.5"
                      >
                        <span className="shrink-0 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-secondary">
                          {changeKindLabels[file.kind]}
                        </span>
                        <span className="min-w-0 break-all font-mono text-xs text-text-secondary">
                          {file.oldPath
                            ? `${file.oldPath} -> ${file.path}`
                            : file.path}
                        </span>
                      </div>
                    ))}
                  </div>
                  {repo.hasMoreChangedFiles && (
                    <p className="mt-2 text-xs text-text-muted">
                      Showing first {repo.changedFiles.length} of{" "}
                      {repo.changedFileCount} changed files.
                    </p>
                  )}
                </div>
              )}

              {repo.behind > 0 && (
                <p className="rounded border border-status-behind/30 bg-status-behind/10 px-2 py-1.5 text-xs leading-5 text-status-behind">
                  This branch is behind its upstream. Axiom only reports this;
                  it will not pull project repos.
                </p>
              )}

              {repo.upstreamStatus === "missing" && (
                <p className="rounded border border-border bg-surface-0 px-2 py-1.5 text-xs leading-5 text-text-muted">
                  No upstream branch is configured for this repo. Local status
                  checks still work.
                </p>
              )}

              {repo.upstreamStatus === "error" && repo.upstreamErrorMessage && (
                <p className="rounded border border-status-locked/30 bg-status-locked/10 px-2 py-1.5 text-xs leading-5 text-status-locked">
                  {repo.upstreamErrorMessage}
                </p>
              )}
            </div>
          )}
        </div>
      )}

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
