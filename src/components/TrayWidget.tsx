import { useCallback, useEffect, useState } from "react";
import type {
  TrayWidgetState,
  TrayNotification,
  WorkSession,
} from "../types";
import {
  formatElapsed,
  timeAgo,
  syncStatusLabel,
} from "../lib/format";
import { normalizeDisplayName, samePerson } from "../lib/identity";
import {
  ArrowUpRight,
  MonitorSmartphone,
  RefreshCw,
  X,
  Zap,
  CheckCircle2,
  Loader2,
  Bell,
} from "lucide-react";

const NOTIFICATION_DURATION_MS = 5000;

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
    sync_complete: <RefreshCw className="w-4 h-4 text-accent" />,
  };

  return (
    <div
      className="animate-slide-in mb-2 flex items-start gap-3 rounded-xl border border-border/60 bg-surface-1/95 px-4 py-3 shadow-2xl backdrop-blur-xl cursor-pointer transition hover:bg-surface-2"
      onClick={onClickMain}
    >
      <div className="mt-0.5">{iconMap[notification.type] || <Bell className="w-4 h-4 text-accent" />}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-text-primary truncate">{notification.title}</div>
        <div className="text-[11px] text-text-secondary mt-0.5 truncate">{notification.message}</div>
      </div>
      <button
        className="mt-0.5 p-1 rounded hover:bg-surface-3 transition"
        onClick={(e) => { e.stopPropagation(); onDismiss(notification.id); }}
      >
        <X className="w-3 h-3 text-text-muted" />
      </button>
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
  onFinishCurrent: () => void;
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
  onFinishCurrent,
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
  const mySession = activeSessions.find((s) => samePerson(s.userName, state.currentUser));
  const teammateGroups = new Map<string, WorkSession[]>();
  activeSessions
    .filter((s) => !samePerson(s.userName, state.currentUser))
    .forEach((session) => {
      const name = normalizeDisplayName(session.userName);
      teammateGroups.set(name, [...(teammateGroups.get(name) || []), session]);
    });
  const teammates = Array.from(teammateGroups.entries());

  return (
    <div className="select-none w-[320px]">
      {/* Notifications */}
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

      {/* Main Widget */}
      <div className="rounded-2xl border border-border/60 bg-surface-0/95 shadow-2xl overflow-hidden backdrop-blur-xl">
        <div
          className="flex items-center justify-between px-4 py-3 cursor-grab active:cursor-grabbing border-b border-border/40"
          onMouseDown={onDragStart}
        >
          <div className="flex items-center gap-2">
            <MonitorSmartphone size={14} className="text-accent" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Axiom</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-1 rounded hover:bg-surface-3 transition" onClick={onClose}>
              <X size={14} className="text-text-muted" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Current Status */}
          <div>
            {mySession ? (
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-accent">Working</p>
                <p className="text-sm font-semibold text-text-primary truncate">{mySession.repoName}</p>
                <p className="text-[11px] text-text-muted">{mySession.branch || "main"} · {formatElapsed(mySession.startedAt)}</p>
                <button
                  className="mt-3 h-8 rounded-lg bg-accent px-3 text-[10px] font-bold text-white hover:bg-accent-hover"
                  onClick={onFinishCurrent}
                >
                  Quick Finish
                </button>
              </div>
            ) : (
              <div className="py-2">
                <p className="text-sm font-medium text-text-secondary">Not working</p>
              </div>
            )}
          </div>

          {/* Teammates */}
          {teammates.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-border/30">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Teammates</p>
              <div className="space-y-3">
                {teammates.map(([name, sessions]) => {
                  const longest = [...sessions].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())[0];
                  return (
                  <div key={`${name}-${longest.repoId}`} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-text-primary truncate">{name}</p>
                      <p className="text-[10px] text-text-muted truncate">
                        {sessions.length > 1 ? `${sessions.length} sessions on ${longest.repoName}` : longest.repoName}
                      </p>
                    </div>
                    <span className="text-[10px] font-medium text-text-muted tabular-nums">
                      {formatElapsed(longest.startedAt)}
                    </span>
                  </div>
                )})}
              </div>
            </div>
          )}

          {teammates.length === 0 && (
            <div className="rounded-xl border border-border/20 bg-surface-2/20 px-3 py-2">
              <p className="text-[10px] font-semibold text-text-muted">Riley inactive</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-surface-1/50 border-t border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              className="p-1.5 rounded-lg hover:bg-surface-3 transition text-text-muted"
              onClick={onSyncNow}
              disabled={isSyncing}
            >
              {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            </button>
            <span className="text-[10px] text-text-muted">
              {state.syncLabel || syncStatusLabel(state.syncStatus)}
              {state.syncDetail ? ` · ${state.syncDetail}` : state.lastSyncAt ? ` · ${timeAgo(state.lastSyncAt)}` : ""}
            </span>
          </div>
          <button 
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-accent-hover hover:underline"
            onClick={onOpenMainWindow}
          >
            Open App
            <ArrowUpRight size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}
