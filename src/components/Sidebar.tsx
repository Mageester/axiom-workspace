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
import axiomMark from "/axiom-mark.png";

const NAV_ITEMS: { id: NavPage; label: string; icon: ReactNode }[] = [
  { id: "today", label: "Today", icon: <Home size={18} strokeWidth={2.5} /> },
  { id: "projects", label: "Projects", icon: <GitFork size={18} strokeWidth={2.5} /> },
  { id: "activity", label: "Activity", icon: <Activity size={18} strokeWidth={2.5} /> },
  { id: "settings", label: "Settings", icon: <Settings size={18} strokeWidth={2.5} /> },
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
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border/40 bg-surface-1">
      <div className="px-6 py-8">
        <div className="flex items-center gap-3">
          <img src={axiomMark} alt="" className="h-8 w-8 object-contain" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold tracking-tight text-text-primary uppercase tracking-[0.1em]">
              Axiom
            </h1>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                isActive
                  ? "bg-surface-2 text-text-primary"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-2/40"
              }`}
            >
              <span className={isActive ? "text-accent" : "text-text-muted opacity-50 group-hover:opacity-100"}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-6">
        <div className="rounded-2xl border border-border/40 bg-surface-2/30 p-4">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${sync.dot}`} />
            <span className={`text-[10px] font-bold uppercase tracking-widest ${sync.text}`}>
              {sync.label}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-text-muted font-medium">
            {setupComplete ? timeAgo(syncSettings?.lastSyncAt) : sync.detail}
          </p>
        </div>
      </div>
    </aside>
  );
}
