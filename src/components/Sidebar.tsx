import {
  Activity,
  Briefcase,
  GitFork,
  Home,
  Settings,
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import type { ReactNode } from "react";
import type { NavPage, SyncSettings, SyncStatus } from "../types";
import axiomMark from "../../app-icon.png";

const NAV_ITEMS: { id: NavPage; label: string; icon: ReactNode }[] = [
  { id: "dashboard", label: "Home", icon: <Home size={18} /> },
  { id: "sessions", label: "Work", icon: <Briefcase size={18} /> },
  { id: "repos", label: "Repos", icon: <GitFork size={18} /> },
  { id: "activity", label: "Activity", icon: <Activity size={18} /> },
  { id: "settings", label: "Settings", icon: <Settings size={18} /> },
];

interface SidebarProps {
  activeItem: NavPage;
  onNavigate: (id: NavPage) => void;
  setupComplete?: boolean;
  activeSessionCount?: number;
  syncStatus?: SyncStatus;
  syncSettings?: SyncSettings;
}

function timeAgo(value?: string): string {
  if (!value) return "Not synced yet";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "Synced just now";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "Synced just now";
  if (min < 60) return `Synced ${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Synced ${hr}h ago`;
  return `Synced ${Math.floor(hr / 24)}d ago`;
}

function syncPresentation(setupComplete?: boolean, syncStatus?: SyncStatus) {
  if (!setupComplete) {
    return {
      label: "Local only",
      detail: "Connect sync when ready",
      icon: <WifiOff size={14} />,
      dot: "bg-status-dirty",
      text: "text-status-dirty",
    };
  }
  if (syncStatus === "error") {
    return {
      label: "Sync needs attention",
      detail: "Open Settings to resolve",
      icon: <AlertTriangle size={14} />,
      dot: "bg-status-locked",
      text: "text-status-locked",
    };
  }
  if (syncStatus && syncStatus !== "idle" && syncStatus !== "complete") {
    return {
      label: "Syncing",
      detail: "Sharing workspace state",
      icon: <Loader2 size={14} className="animate-spin" />,
      dot: "bg-status-behind",
      text: "text-status-behind",
    };
  }
  return {
    label: "Connected",
    detail: "Team sync active",
    icon: <Wifi size={14} />,
    dot: "bg-status-clean",
    text: "text-status-clean",
  };
}

export function Sidebar({
  activeItem,
  onNavigate,
  setupComplete,
  activeSessionCount = 0,
  syncStatus,
  syncSettings,
}: SidebarProps) {
  const sync = syncPresentation(setupComplete, syncStatus);
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border/70 bg-surface-1/75 backdrop-blur-xl">
      <div className="border-b border-border/70 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-black/70 shadow-inner">
            <img src={axiomMark} alt="" className="h-7 w-7 object-contain" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-[0.01em] text-text-primary">
              Axiom Workspace
            </h1>
            <p className="mt-0.5 text-xs text-text-muted">Team coordination</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeItem === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-surface-3/90 text-text-primary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                    : "text-text-secondary hover:bg-surface-2/80 hover:text-text-primary"
                }`}
              >
                <span className={isActive ? "text-accent-hover" : "text-text-muted group-hover:text-text-secondary"}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.id === "sessions" && activeSessionCount > 0 && (
                  <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent-hover">
                    {activeSessionCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-border/70 p-4">
        <div className="rounded-xl border border-border/70 bg-surface-0/65 p-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${sync.dot}`} />
            <span className={`flex items-center gap-1.5 text-xs font-semibold ${sync.text}`}>
              {sync.icon}
              {sync.label}
            </span>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            {setupComplete ? timeAgo(syncSettings?.lastSyncAt) : sync.detail}
          </p>
        </div>
      </div>
    </aside>
  );
}
