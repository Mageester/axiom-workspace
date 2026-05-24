import { useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FolderOpen,
  GitBranch,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  RefreshCw,
  Square,
  Terminal,
  Trash2,
} from "lucide-react";
import { revealItemInDir, openPath } from "@tauri-apps/plugin-opener";
import type { LiveRepo, WorkSession } from "../types";
import type { ProjectSafety } from "../types/workspace";
import { getRepoDisplayName } from "../lib/repos";
import { assessProjectSafety, safetyColor, safetyBgColor } from "../lib/safety";

async function openFolder(path: string) {
  try { await revealItemInDir(path); } catch { try { await openPath(path); } catch {} }
}

async function copyToClipboard(text: string) {
  try { await navigator.clipboard.writeText(text); } catch {}
}

interface RepoCardProps {
  repo: LiveRepo;
  nickname?: string;
  refreshing: boolean;
  pulling?: boolean;
  activeSessions: WorkSession[];
  currentUser: string;
  onRefresh: () => void;
  onRemove: () => void;
  onStartSession: () => void;
  onFinishSession?: (sessionId: string) => void;
  onPull?: () => void;
  onRename?: (name: string) => void;
  onOpenInCode?: () => void;
}

export function RepoCard({
  repo,
  nickname,
  refreshing,
  pulling,
  activeSessions,
  currentUser,
  onRefresh,
  onRemove,
  onStartSession,
  onFinishSession,
  onPull,
  onRename,
  onOpenInCode,
}: RepoCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);
  const displayName = getRepoDisplayName(repo, nickname);

  const safety: ProjectSafety = useMemo(
    () => assessProjectSafety(repo, null, activeSessions, currentUser),
    [repo, activeSessions, currentUser],
  );

  const mySession = useMemo(
    () => activeSessions.find(s => s.userName.toLowerCase() === currentUser.toLowerCase() && s.repoId === repo.id),
    [activeSessions, currentUser, repo.id],
  );

  const teammateNames = useMemo(() => {
    const names = activeSessions
      .filter(s => s.userName.toLowerCase() !== currentUser.toLowerCase() && s.repoId === repo.id)
      .map(s => s.userName.split(" ")[0]);
    return [...new Set(names)];
  }, [activeSessions, currentUser, repo.id]);

  return (
    <div className={`group rounded-xl border bg-surface-1 p-4 transition-all hover:border-border-hover shadow-sm ${
      mySession ? "border-accent/25 ring-1 ring-accent/5" : "border-border/30"
    }`}>
      {/* Top row: name + safety */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={editRef}
              className="w-full rounded-lg border border-accent bg-surface-0 px-2 py-0.5 text-xs font-semibold text-text-primary outline-none"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { onRename?.(editValue); setEditing(false); }
                if (e.key === "Escape") setEditing(false);
              }}
              onBlur={() => setEditing(false)}
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-bold text-text-primary tracking-tight">{displayName}</h3>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-surface-2 rounded"
                onClick={() => { setEditValue(displayName); setEditing(true); setTimeout(() => editRef.current?.focus(), 0); }}
                title="Rename"
              >
                <Pencil size={11} className="text-text-muted" />
              </button>
            </div>
          )}

          <div className="mt-1 flex items-center gap-2 text-text-muted">
            <span className="flex items-center gap-1 text-[11px] font-medium">
              <GitBranch size={10} className="opacity-75" />
              {repo.currentBranch || "main"}
            </span>
            {repo.changedFileCount > 0 && (
              <span className="text-[10px] font-medium text-status-dirty">
                {repo.changedFileCount} changed
              </span>
            )}
            {teammateNames.length > 0 && (
              <span className="text-[10px] font-semibold text-status-dirty">
                {teammateNames.join(", ")} active
              </span>
            )}
          </div>
        </div>

        {/* Safety pill */}
        <span className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${safetyBgColor(safety.label)} ${safetyColor(safety.label)}`}>
          {safety.displayText}
        </span>
      </div>

      {/* Actions row */}
      <div className="mt-3 pt-3 border-t border-border/15 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mySession ? (
            <button
              className="h-7 px-3 rounded-lg bg-surface-2 border border-border/40 text-[10px] font-bold text-text-primary hover:bg-surface-3 transition-all flex items-center gap-1.5 active:scale-[0.98]"
              onClick={() => onFinishSession?.(mySession.id)}
            >
              <Square size={10} fill="currentColor" />
              Finish Work
            </button>
          ) : (
            <button
              className="h-7 px-3 rounded-lg bg-accent/10 border border-accent/20 text-[10px] font-bold text-accent hover:bg-accent/20 transition-all flex items-center gap-1.5 active:scale-[0.98]"
              onClick={onStartSession}
            >
              <Play size={10} fill="currentColor" />
              Start Work
            </button>
          )}

          <button
            className="h-7 px-2.5 rounded-lg text-[10px] font-bold text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-all"
            onClick={() => void openFolder(repo.path)}
          >
            Open
          </button>

          <button
            className="h-7 px-2.5 rounded-lg text-[10px] font-bold text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-all"
            onClick={() => setDetailsOpen(!detailsOpen)}
          >
            {detailsOpen ? "Hide" : "Details"}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {repo.behind > 0 && onPull && (
            <button
              className="h-7 px-2 rounded-lg text-status-behind text-[10px] font-bold hover:bg-status-behind/10 transition flex items-center gap-1"
              onClick={onPull}
              disabled={pulling}
            >
              {pulling ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
              Pull
            </button>
          )}
          <button
            className="h-7 w-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-2 transition"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Details panel */}
      {detailsOpen && (
        <div className="mt-3 space-y-3 p-3 rounded-xl bg-surface-0/60 border border-border/20 text-xs animate-slide-in">
          {/* Quick actions */}
          <div className="flex flex-wrap gap-1.5">
            <button
              className="h-6 px-2 rounded text-[10px] font-semibold text-text-muted hover:text-text-primary hover:bg-surface-2 transition flex items-center gap-1"
              onClick={() => void openFolder(repo.path)}
            >
              <FolderOpen size={10} />
              Open Folder
            </button>
            <button
              className="h-6 px-2 rounded text-[10px] font-semibold text-text-muted hover:text-text-primary hover:bg-surface-2 transition flex items-center gap-1"
              onClick={() => {
                void copyToClipboard(repo.path);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check size={10} className="text-status-clean" /> : <Copy size={10} />}
              Copy Path
            </button>
          </div>

          {/* Active sessions */}
          {activeSessions.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-border/10">
              <p className="text-[9px] uppercase tracking-wider font-bold text-text-muted">Active Sessions</p>
              {activeSessions.map(s => (
                <div key={s.id} className="text-[11px] text-text-secondary bg-surface-2/30 p-2 rounded border border-border/10">
                  <span className="font-semibold text-text-primary">{s.userName}</span>: {s.title}
                  {s.branch && <span className="text-[10px] text-text-muted ml-1">({s.branch})</span>}
                </div>
              ))}
            </div>
          )}

          {/* Changed files */}
          {repo.changedFileCount > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-border/10">
              <p className="text-[9px] uppercase tracking-wider font-bold text-text-muted">
                Changed Files ({repo.changedFileCount})
              </p>
              <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[10px] bg-surface-1/40 p-2 rounded border border-border/10">
                {repo.changedFiles.slice(0, 5).map(f => (
                  <div key={f.path} className="text-text-secondary flex items-center gap-1.5">
                    <span className={`w-1 h-1 rounded-full ${
                      f.kind === "added" ? "bg-status-clean" :
                      f.kind === "deleted" ? "bg-status-locked" : "bg-status-dirty"
                    }`} />
                    <span className="truncate">{f.path}</span>
                  </div>
                ))}
                {repo.changedFileCount > 5 && (
                  <p className="text-[9px] text-text-muted italic">+{repo.changedFileCount - 5} more</p>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {repo.status === "error" && repo.errorMessage && (
            <div className="p-2 rounded-lg bg-status-locked/5 border border-status-locked/15 text-status-locked text-[11px]">
              {repo.errorMessage}
            </div>
          )}

          {/* Remove */}
          <div className="pt-2 border-t border-border/10 flex justify-end">
            <button
              onClick={() => { if (window.confirm(`Remove ${displayName} from Axiom?`)) onRemove(); }}
              className="text-[10px] text-status-locked/80 hover:text-status-locked hover:underline font-semibold"
            >
              Remove Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
