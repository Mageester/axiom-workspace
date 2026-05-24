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
  syncStatusColor,
  sessionDurationStage,
} from "../lib/format";
import {
  ArrowUpRight,
  ChevronDown,
  MonitorSmartphone,
  RefreshCw,
  Users,
  X,
  Zap,
  CheckCircle2,
  Loader2,
  Bell,
  Clock,
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

function normalizeTeammateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.toLowerCase().startsWith("riley")) {
    return "Riley";
  }
  const firstSpace = trimmed.indexOf(" ");
  return firstSpace > 0 ? trimmed.substring(0, firstSpace) : trimmed;
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
  const mySession = activeSessions.find((s) => s.userName === state.currentUser);
  const otherSessions = activeSessions.filter((s) => s.userName !== state.currentUser);

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
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Working</p>
                <p className="text-sm font-semibold text-text-primary truncate">{mySession.repoName}</p>
                <p className="text-[11px] text-text-muted">{mySession.branch || "main"} · {formatElapsed(mySession.startedAt)}</p>
              </div>
            ) : (
              <div className="py-2">
                <p className="text-sm font-medium text-text-secondary">Not working</p>
              </div>
            )}
          </div>

          {/* Teammates */}
          {otherSessions.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-border/30">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Teammates</p>
              <div className="space-y-3">
                {otherSessions.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-text-primary truncate">{normalizeTeammateName(s.userName)}</p>
                      <p className="text-[10px] text-text-muted truncate">{s.repoName}</p>
                    </div>
                    <span className="text-[10px] font-medium text-text-muted tabular-nums">
                      {formatElapsed(s.startedAt)}
                    </span>
                  </div>
                ))}
              </div>
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
              {state.lastSyncAt ? timeAgo(state.lastSyncAt) : "Not synced"}
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
