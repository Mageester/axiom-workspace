import { useCallback, useEffect, useState } from "react";
import type {
  TrayWidgetState,
  TrayNotification,
  TrayBoardSummary,
  WorkSession,
} from "../types";
import {
  formatElapsed,
  timeAgo,
  syncStatusLabel,
  syncStatusColor,
  statusColorClass,
  sessionDurationStage,
} from "../lib/format";
import {
  Activity,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Columns3,
  FolderGit2,
  GitBranch,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  Users,
  X,
  Zap,
  AlertTriangle,
  CheckCircle2,
  FileText,
  LayoutGrid,
  Minimize2,
  Bell,
} from "lucide-react";

const NOTIFICATION_DURATION_MS = 5000;

function eventIcon(type: string) {
  switch (type) {
    case "session_created":
    case "session_ended":
      return <Users className="w-3 h-3" />;
    case "board_card_created":
    case "board_card_updated":
      return <LayoutGrid className="w-3 h-3" />;
    case "sync_completed":
      return <RefreshCw className="w-3 h-3" />;
    case "repo_refreshed":
      return <FolderGit2 className="w-3 h-3" />;
    default:
      return <Activity className="w-3 h-3" />;
  }
}

interface NotificationToastProps {
  notification: TrayNotification;
  onDismiss: (id: string) => void;
  onClickMain: () => void;
}

function NotificationToast({ notification, onDismiss, onClickMain }: NotificationToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notification.id), NOTIFICATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  const iconMap: Record<string, React.ReactNode> = {
    session_started: <Zap className="w-4 h-4 text-status-clean" />,
    session_ended: <CheckCircle2 className="w-4 h-4 text-text-muted" />,
    lock_conflict: <AlertTriangle className="w-4 h-4 text-status-locked" />,
    sync_complete: <RefreshCw className="w-4 h-4 text-accent" />,
  };

  return (
    <div
      className="animate-slide-in mb-2 flex items-start gap-3 rounded-lg border border-border/80 bg-surface-1/95 px-3.5 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl cursor-pointer transition hover:bg-surface-2/90"
      onClick={onClickMain}
    >
      <div className="mt-0.5">{iconMap[notification.type] || <Bell className="w-4 h-4 text-accent" />}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-text-primary truncate">{notification.title}</div>
        <div className="text-[11px] text-text-secondary mt-0.5 truncate">{notification.message}</div>
      </div>
      <button
        className="mt-0.5 p-0.5 rounded text-text-muted hover:text-text-primary transition"
        onClick={(e) => { e.stopPropagation(); onDismiss(notification.id); }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, icon, count, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border/50">
      <button
        className="flex w-full items-center gap-2 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted hover:text-text-secondary transition"
        onClick={() => setOpen(!open)}
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {count !== undefined && (
          <span className="rounded-full bg-surface-3/80 px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">{count}</span>
        )}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && <div className="px-3.5 pb-2.5">{children}</div>}
    </div>
  );
}

function BoardBar({ summary }: { summary: TrayBoardSummary }) {
  const columns = [
    { key: "inbox", label: "In", color: "bg-text-muted" },
    { key: "ready", label: "Rdy", color: "bg-status-behind" },
    { key: "in_progress", label: "WIP", color: "bg-accent" },
    { key: "blocked", label: "Blk", color: "bg-status-locked" },
    { key: "review", label: "Rev", color: "bg-status-dirty" },
    { key: "done", label: "Done", color: "bg-status-clean" },
  ] as const;

  const total = columns.reduce((sum, c) => sum + (summary[c.key] || 0), 0);

  return (
    <div>
      <div className="flex gap-1 mb-1.5">
        {columns.map((col) => {
          const count = summary[col.key] || 0;
          const width = total > 0 ? Math.max((count / total) * 100, count > 0 ? 8 : 0) : 0;
          return (
            <div
              key={col.key}
              className={`${col.color} rounded-sm h-1.5 transition-all`}
              style={{ width: `${width}%` }}
              title={`${col.label}: ${count}`}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] text-text-muted">
        <div className="flex gap-2">
          {columns.map((col) => (
            <span key={col.key} title={col.label}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${col.color} mr-0.5`} />
              {summary[col.key] || 0}
            </span>
          ))}
        </div>
        {summary.assignedToYou > 0 && (
          <span className="text-accent font-medium">{summary.assignedToYou} yours</span>
        )}
      </div>
    </div>
  );
}

export interface TrayWidgetProps {
  state: TrayWidgetState;
  notifications: TrayNotification[];
  expanded: boolean;
  isSyncing: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  onSyncNow: () => void;
  onOpenMainWindow: () => void;
  onDismissNotification: (id: string) => void;
}

export function TrayWidget({
  state,
  notifications,
  expanded,
  isSyncing,
  onToggleExpand,
  onClose,
  onSyncNow,
  onOpenMainWindow,
  onDismissNotification,
}: TrayWidgetProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const onDragStart = useCallback(async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startDragging();
  }, []);

  void tick;

  const activeSessions = state.activeSessions.filter((s) => s.status === "active");
  const otherSessions = activeSessions.filter((s) => s.userName !== state.currentUser);
  const mySessions = activeSessions.filter((s) => s.userName === state.currentUser);

  return (
    <div className="select-none">
      {/* Notification toasts stack above widget */}
      <div className="mb-2">
        {notifications.map((n) => (
          <NotificationToast
            key={n.id}
            notification={n}
            onDismiss={onDismissNotification}
            onClickMain={onOpenMainWindow}
          />
        ))}
      </div>

      {/* Widget card */}
      <div className="w-[356px] rounded-2xl border border-border/60 bg-surface-0/95 shadow-[0_24px_80px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Drag header — uses Tauri's native window drag */}
        <div
          className="flex items-center gap-2 px-3.5 py-2.5 cursor-grab active:cursor-grabbing bg-gradient-to-r from-surface-1/60 to-surface-0/40"
          onMouseDown={onDragStart}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MonitorSmartphone className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-text-primary tracking-wide">Axiom</span>
            <span className={`text-[10px] font-medium ${syncStatusColor(state.syncStatus)}`}>
              {syncStatusLabel(state.syncStatus)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3/60 transition"
              onClick={onToggleExpand}
              title={expanded ? "Compact" : "Expand"}
            >
              {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              className="p-1 rounded-md text-text-muted hover:text-status-locked hover:bg-surface-3/60 transition"
              onClick={onClose}
              title="Hide widget"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Compact view — always visible */}
        <div className="px-3.5 py-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs text-text-secondary">
                  <span className="font-semibold text-text-primary">{activeSessions.length}</span> active
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <FolderGit2 className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-xs text-text-secondary">
                  <span className="font-semibold text-text-primary">{state.repos.length}</span> repos
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                className="p-1 rounded-md text-text-muted hover:text-accent hover:bg-surface-3/60 transition disabled:opacity-40"
                onClick={onSyncNow}
                disabled={isSyncing}
                title="Sync now"
              >
                {isSyncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                className="p-1 rounded-md text-text-muted hover:text-accent hover:bg-surface-3/60 transition"
                onClick={onOpenMainWindow}
                title="Open main window"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Mini session avatars */}
          {activeSessions.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {activeSessions.slice(0, 8).map((s) => {
                const stage = sessionDurationStage(s.startedAt);
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-1 rounded-full border border-border/60 bg-surface-2/60 px-2 py-0.5 text-[10px] ${
                      s.userName === state.currentUser ? "border-accent/40" : ""
                    }`}
                    title={`${s.userName} → ${s.repoName} (${s.branch || "no branch"}) — ${formatElapsed(s.startedAt)}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${stage.bg}`} />
                    <span className="font-medium text-text-primary truncate max-w-[60px]">{s.userName}</span>
                  </div>
                );
              })}
              {activeSessions.length > 8 && (
                <span className="text-[10px] text-text-muted">+{activeSessions.length - 8}</span>
              )}
            </div>
          )}
        </div>

        {/* Expanded sections */}
        {expanded && (
          <div className="max-h-[420px] overflow-y-auto">
            {/* Team Sessions */}
            <CollapsibleSection
              title="Team Sessions"
              icon={<Users className="w-3 h-3" />}
              count={activeSessions.length}
            >
              {activeSessions.length === 0 ? (
                <div className="text-center py-3">
                  <Users className="w-5 h-5 text-text-muted mx-auto mb-1" />
                  <div className="text-[11px] text-text-muted">No active sessions</div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {mySessions.map((s) => (
                    <SessionRow key={s.id} session={s} isCurrentUser />
                  ))}
                  {otherSessions.map((s) => (
                    <SessionRow key={s.id} session={s} isCurrentUser={false} />
                  ))}
                </div>
              )}
            </CollapsibleSection>

            {/* Repositories */}
            <CollapsibleSection
              title="Repositories"
              icon={<FolderGit2 className="w-3 h-3" />}
              count={state.repos.length}
              defaultOpen={false}
            >
              {state.repos.length === 0 ? (
                <div className="text-[11px] text-text-muted text-center py-2">No tracked repositories</div>
              ) : (
                <div className="space-y-1">
                  {state.repos.map((repo) => (
                    <div key={repo.name} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-surface-2/40 transition">
                      <span className={`w-2 h-2 rounded-full ${statusColorClass(repo.status)}`} />
                      <span className="text-[11px] font-medium text-text-primary truncate flex-1">{repo.name}</span>
                      <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                        {repo.branch && (
                          <span className="flex items-center gap-0.5">
                            <GitBranch className="w-2.5 h-2.5" />
                            <span className="truncate max-w-[60px]">{repo.branch}</span>
                          </span>
                        )}
                        {repo.changedFileCount > 0 && (
                          <span className="text-status-dirty font-medium flex items-center gap-0.5">
                            <FileText className="w-2.5 h-2.5" />
                            {repo.changedFileCount}
                          </span>
                        )}
                        {repo.behind > 0 && (
                          <span className="text-status-behind font-medium">↓{repo.behind}</span>
                        )}
                        {repo.hasLockConflict && (
                          <AlertTriangle className="w-3 h-3 text-status-locked" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>

            {/* Board Summary */}
            <CollapsibleSection
              title="Board"
              icon={<Columns3 className="w-3 h-3" />}
              defaultOpen={false}
            >
              <BoardBar summary={state.boardSummary} />
            </CollapsibleSection>

            {/* Recent Events */}
            <CollapsibleSection
              title="Activity"
              icon={<Activity className="w-3 h-3" />}
              count={state.recentEvents.length}
              defaultOpen={false}
            >
              {state.recentEvents.length === 0 ? (
                <div className="text-[11px] text-text-muted text-center py-2">No recent events</div>
              ) : (
                <div className="space-y-0.5">
                  {state.recentEvents.slice(0, 20).map((event) => (
                    <div key={event.id} className="flex items-start gap-2 py-1 px-1.5 rounded-md hover:bg-surface-2/30 transition">
                      <div className="mt-0.5 text-text-muted">{eventIcon(event.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-text-secondary truncate">{event.description}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-text-muted font-medium">{event.userName}</span>
                          <span className="text-[10px] text-text-muted">{timeAgo(event.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-3.5 py-1.5 border-t border-border/40 bg-surface-1/30">
          <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
            <Clock className="w-3 h-3" />
            {state.lastSyncAt ? `Synced ${timeAgo(state.lastSyncAt)}` : "Not synced yet"}
          </div>
          <button
            className="text-[10px] text-text-muted hover:text-accent transition"
            onClick={onOpenMainWindow}
          >
            Open Axiom
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionRow({ session, isCurrentUser }: { session: WorkSession; isCurrentUser: boolean }) {
  const stage = sessionDurationStage(session.startedAt);
  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg transition ${isCurrentUser ? "bg-accent/8 border border-accent/20" : "hover:bg-surface-2/40"}`}>
      <span className={`w-2 h-2 rounded-full ${stage.bg}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-text-primary truncate">
            {session.userName}
            {isCurrentUser && <span className="text-accent ml-1 text-[10px] font-normal">(you)</span>}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-text-muted mt-0.5">
          <span className="font-medium text-text-secondary truncate max-w-[100px]">{session.repoName}</span>
          {session.branch && (
            <span className="flex items-center gap-0.5 truncate max-w-[80px]">
              <GitBranch className="w-2.5 h-2.5" />
              {session.branch}
            </span>
          )}
        </div>
      </div>
      <span className={`text-[10px] font-medium ${stage.text}`}>
        {formatElapsed(session.startedAt)}
      </span>
    </div>
  );
}
