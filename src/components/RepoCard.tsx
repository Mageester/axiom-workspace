import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileText,
  FolderOpen,
  GitBranch,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { revealItemInDir, openPath } from "@tauri-apps/plugin-opener";
import type { LiveRepo, RepoChangeKind, RepoFileCategory, WorkSession } from "../types";
import { StatusBadge } from "./StatusBadge";
import { RepoIntelligenceBadge, RiskLevelBadge } from "./RepoIntelligenceBadge";
import { iconBtnClass, secondaryBtnClass } from "../lib/constants";
import { getRepoDescription, getRepoDisplayName } from "../lib/repos";
import { analyzeRepo, categoryLabel } from "../lib/intelligence";

interface RepoCardProps {
  repo: LiveRepo;
  nickname?: string;
  refreshing: boolean;
  pulling?: boolean;
  activeSessions: WorkSession[];
  onRefresh: () => void;
  onRemove: () => void;
  onStartSession: () => void;
  onPull?: () => void;
  onRename?: (name: string) => void;
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
  nickname,
  refreshing,
  pulling,
  activeSessions,
  onRefresh,
  onRemove,
  onStartSession,
  onPull,
  onRename,
}: RepoCardProps) {
  const hasActiveSessions = activeSessions.length > 0;
  const [detailsOpen, setDetailsOpen] = useState(repo.status === "dirty");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);
  const hasDirtyFiles = repo.status === "dirty" && repo.changedFileCount > 0;
  const displayName = getRepoDisplayName(repo, nickname);
  const description = getRepoDescription(repo);
  const hasDetails =
    hasDirtyFiles ||
    repo.status === "error" ||
    repo.upstreamStatus === "missing" ||
    repo.upstreamStatus === "error" ||
    repo.behind > 0;
  const intelligence = useMemo(() => analyzeRepo(repo), [repo]);
  const groupedFiles = useMemo(() => {
    const groups = new Map<RepoFileCategory, typeof repo.changedFiles>();
    for (const file of intelligence.classifiedFiles) {
      const existing = groups.get(file.category) ?? [];
      existing.push(file);
      groups.set(file.category, existing);
    }
    const order: RepoFileCategory[] = [
      "source_code", "config", "deployment", "generated",
      "local_tooling", "screenshots", "docs", "unknown",
    ];
    return order
      .filter((cat) => (groups.get(cat)?.length ?? 0) > 0)
      .map((cat) => ({ category: cat, files: groups.get(cat)! }));
  }, [intelligence]);
  const detailSummary = useMemo(() => {
    if (hasDirtyFiles) {
      return `${repo.changedFileCount} changed file${
        repo.changedFileCount === 1 ? "" : "s"
      }`;
    }
    if (repo.status === "error") {
      return "Needs attention";
    }
    if (repo.behind > 0) {
      return `${repo.behind} update${repo.behind === 1 ? "" : "s"} available`;
    }
    if (repo.upstreamStatus === "missing") {
      return "No remote branch";
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
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                ref={editRef}
                className="w-full rounded border border-accent bg-surface-0 px-1.5 py-0.5 text-sm font-medium text-text-primary outline-none"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onRename?.(editValue);
                    setEditing(false);
                  }
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <button
                className={iconBtnClass}
                title="Save"
                onClick={() => {
                  onRename?.(editValue);
                  setEditing(false);
                }}
              >
                <Check size={12} />
              </button>
              <button
                className={iconBtnClass}
                title="Cancel"
                onClick={() => setEditing(false)}
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-medium text-text-primary">
                {displayName}
              </h3>
              {onRename && (
                <button
                  className={`${iconBtnClass} shrink-0`}
                  title="Edit display name"
                  onClick={() => {
                    setEditValue(displayName);
                    setEditing(true);
                    setTimeout(() => editRef.current?.select(), 0);
                  }}
                >
                  <Pencil size={10} />
                </button>
              )}
            </div>
          )}
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
          {description && (
            <p className="mt-1 text-xs text-text-secondary">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge status={repo.status} />
          <RepoIntelligenceBadge safetyState={intelligence.safetyState} riskLevel={intelligence.riskLevel} />
          <RiskLevelBadge riskLevel={intelligence.riskLevel} />
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
              if (window.confirm(`Remove ${displayName} from Axiom? This does not delete the repo folder.`)) {
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
                You have unsaved changes
              </p>
              <p className="mt-0.5 text-xs leading-5 text-text-secondary">
                {repo.changedFileCount} file{repo.changedFileCount === 1 ? "" : "s"} changed but not committed yet.
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
            {repo.ahead > 0 && `${repo.ahead} to push`}
            {repo.ahead > 0 && repo.behind > 0 && " · "}
            {repo.behind > 0 && `${repo.behind} to pull`}
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
              {hasDirtyFiles && groupedFiles.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    Changed files ({repo.changedFileCount})
                  </p>
                  {groupedFiles.map(({ category, files }) => (
                    <div key={category}>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-xs font-medium text-text-secondary">
                          {categoryLabel(category)}
                        </span>
                        <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-muted">
                          {files.length}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {files.slice(0, 5).map((file) => (
                          <div
                            key={`${file.kind}-${file.path}`}
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
                        {files.length > 5 && (
                          <p className="text-[11px] text-text-muted">
                            +{files.length - 5} more {categoryLabel(category).toLowerCase()} files
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {repo.hasMoreChangedFiles && (
                    <p className="text-xs text-text-muted">
                      Showing first {repo.changedFiles.length} of{" "}
                      {repo.changedFileCount} changed files.
                    </p>
                  )}
                </div>
              )}

              {repo.behind > 0 && (
                <div className="rounded border border-status-behind/30 bg-status-behind/10 px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs leading-5 text-status-behind">
                      {repo.behind} new commit{repo.behind === 1 ? "" : "s"} available from the remote.
                    </p>
                    {onPull && (
                      <button
                        className={`${secondaryBtnClass} shrink-0`}
                        onClick={onPull}
                        disabled={pulling}
                        title="Download the latest changes from the remote"
                      >
                        {pulling ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Download size={12} />
                        )}
                        Pull Latest
                      </button>
                    )}
                  </div>
                </div>
              )}

              {repo.upstreamStatus === "missing" && (
                <p className="rounded border border-border bg-surface-0 px-2 py-1.5 text-xs leading-5 text-text-muted">
                  No remote branch set up yet. Push this branch first to enable
                  update tracking.
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

      {intelligence.riskLevel !== "none" && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-surface-0 px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-primary">
              {intelligence.nextAction}
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-text-muted">
              {intelligence.recommendation}
            </p>
          </div>
        </div>
      )}

      <button
        className={`${secondaryBtnClass} mt-4 w-full justify-center`}
        onClick={onStartSession}
      >
        <Play size={14} />
        Start Work
      </button>
    </div>
  );
}
