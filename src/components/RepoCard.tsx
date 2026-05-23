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
import type { LiveRepo, WorkSession } from "../types";
import { getRepoDisplayName } from "../lib/repos";
import { analyzeRepo } from "../lib/intelligence";

async function openFolder(path: string) {
  try {
    await revealItemInDir(path);
  } catch {
    try {
      await openPath(path);
    } catch {}
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {}
}

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

function getHumanStatus(repo: LiveRepo): string {
  if (repo.status === "error") return "Needs attention";
  if (repo.hasUncommittedChanges) {
    return `${repo.changedFileCount} file${repo.changedFileCount === 1 ? "" : "s"} changed`;
  }
  if (repo.behind > 0) return "Behind remote";
  if (repo.status === "clean") return "Clean";
  return repo.status;
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);
  const hasDirtyFiles = repo.status === "dirty" && repo.changedFileCount > 0;
  const displayName = getRepoDisplayName(repo, nickname);
  const intelligence = useMemo(() => analyzeRepo(repo), [repo]);
  const humanStatus = getHumanStatus(repo);

  return (
    <div
      className={`group rounded-2xl border bg-surface-1 p-6 transition-all hover:border-border-hover shadow-sm ${
        hasActiveSessions ? "border-accent/30 ring-1 ring-accent/10" : "border-border/60"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                ref={editRef}
                className="w-full rounded-lg border border-accent bg-surface-0 px-3 py-1 text-sm font-medium text-text-primary outline-none"
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
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-semibold text-text-primary tracking-tight">
                {displayName}
              </h3>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-surface-2 rounded"
                onClick={() => {
                  setEditValue(displayName);
                  setEditing(true);
                  setTimeout(() => editRef.current?.focus(), 0);
                }}
              >
                <Pencil size={12} className="text-text-muted" />
              </button>
            </div>
          )}
          <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
            <span className="truncate max-w-[200px]">{repo.path}</span>
            <button
              className="hover:text-text-secondary transition-colors"
              onClick={() => {
                void copyToClipboard(repo.path);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check size={12} className="text-status-clean" /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`text-sm font-medium ${
            repo.status === "clean" ? "text-status-clean" : 
            repo.status === "error" ? "text-status-locked" : "text-status-dirty"
          }`}>
            {humanStatus}
          </span>
          <div className="flex items-center gap-1">
             <button
              onClick={() => void openFolder(repo.path)}
              className="p-1.5 hover:bg-surface-2 rounded-lg text-text-muted transition-colors"
              title="Open folder"
            >
              <FolderOpen size={14} />
            </button>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-1.5 hover:bg-surface-2 rounded-lg text-text-muted transition-colors"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-text-secondary bg-surface-2 px-2 py-1 rounded-md">
            <GitBranch size={12} />
            <span className="font-medium">{repo.currentBranch || "main"}</span>
          </div>
          {hasActiveSessions && (
            <div className="flex -space-x-1">
              {activeSessions.slice(0, 3).map((s, i) => (
                <div key={s.id} className="w-5 h-5 rounded-full bg-accent border-2 border-surface-1 flex items-center justify-center text-[10px] font-bold text-white" title={s.userName}>
                  {s.userName[0]}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {repo.behind > 0 && onPull && (
            <button
              className="h-8 px-3 rounded-lg bg-status-behind/10 text-status-behind text-xs font-medium hover:bg-status-behind/20 transition-colors flex items-center gap-1.5"
              onClick={onPull}
              disabled={pulling}
            >
              {pulling ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Pull
            </button>
          )}
          <button
            className="h-8 px-4 rounded-lg bg-surface-2 text-text-primary text-xs font-semibold hover:bg-surface-3 transition-colors"
            onClick={onStartSession}
          >
            Start Work
          </button>
        </div>
      </div>

      {(hasDirtyFiles || repo.status === "error" || hasActiveSessions) && (
        <div className="mt-4">
          <button
            className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
            onClick={() => setDetailsOpen(!detailsOpen)}
          >
            {detailsOpen ? "Hide details" : "Show details"}
          </button>
          
          {detailsOpen && (
            <div className="mt-3 space-y-3 p-3 rounded-xl bg-surface-0/50 border border-border/30">
               {repo.status === "error" && repo.errorMessage && (
                <div className="flex items-start gap-2 text-xs text-status-locked">
                  <AlertCircle size={14} className="shrink-0" />
                  <p>{repo.errorMessage}</p>
                </div>
              )}

              {hasActiveSessions && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted">Active Work</p>
                  {activeSessions.map(s => (
                    <div key={s.id} className="text-xs text-text-secondary">
                      <span className="font-medium text-text-primary">{s.userName}</span>: {s.title}
                    </div>
                  ))}
                </div>
              )}

              {hasDirtyFiles && (
                <div className="space-y-2">
                   <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted">Changed Files</p>
                   <div className="max-h-32 overflow-y-auto space-y-1">
                      {repo.changedFiles.slice(0, 10).map(f => (
                        <div key={f.path} className="text-[11px] font-mono text-text-secondary flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            f.kind === "added" ? "bg-status-clean" : 
                            f.kind === "deleted" ? "bg-status-locked" : "bg-status-dirty"
                          }`} />
                          <span className="truncate">{f.path}</span>
                        </div>
                      ))}
                      {repo.changedFileCount > 10 && (
                        <p className="text-[10px] text-text-muted">+{repo.changedFileCount - 10} more files</p>
                      )}
                   </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between border-t border-border/20">
                <span className="text-[10px] text-text-muted">Last checked {formatLastChecked(repo.lastCheckedAt)}</span>
                <button
                  onClick={() => {
                    if (window.confirm(`Remove ${displayName} from Axiom?`)) onRemove();
                  }}
                  className="text-[10px] text-status-locked hover:underline"
                >
                  Remove Project
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
