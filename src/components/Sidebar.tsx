import {
  Activity,
  GitFork,
  Home,
  Settings,
  Loader2,
} from "lucide-react";
import type { ReactNode } from "react";
import type { NavPage, SyncSettings, SyncStatus } from "../types";
import type { SyncModeInfo } from "../lib/sync-mode";
import axiomMark from "/axiom-mark.png";

const NAV_ITEMS: { id: NavPage; label: string; icon: ReactNode }[] = [
  { id: "today", label: "Home", icon: <Home size={15} strokeWidth={2.5} /> },
  { id: "projects", label: "Projects", icon: <GitFork size={15} strokeWidth={2.5} /> },
  { id: "activity", label: "Activity", icon: <Activity size={15} strokeWidth={2.5} /> },
  { id: "settings", label: "Settings", icon: <Settings size={15} strokeWidth={2.5} /> },
];

interface SidebarProps {
  activeItem: NavPage;
  onNavigate: (id: NavPage) => void;
  setupComplete?: boolean;
  activeSessionCount?: number;
  syncStatus?: SyncStatus;
  syncSettings?: SyncSettings;
  syncInfo?: SyncModeInfo;
}

export function Sidebar({
  activeItem,
  onNavigate,
  setupComplete,
  syncStatus,
  syncSettings,
  syncInfo,
}: SidebarProps) {
  const sync = syncInfo ?? {
    label: setupComplete ? "GitHub sync" : "Local mode",
    detail: setupComplete && syncSettings?.lastSyncAt ? "Synced previously" : "Saved on this device",
    dotClass: "bg-status-clean",
    textClass: "text-status-clean",
    isSyncing: Boolean(syncStatus && syncStatus !== "idle" && syncStatus !== "complete" && syncStatus !== "error"),
  };
  return (
    <aside className="flex h-full w-14 shrink-0 flex-col border-r border-border/20 bg-surface-1/40 backdrop-blur-md select-none sm:w-44">
      {/* Brand Header */}
      <div className="px-3 py-4">
        <div className="flex items-center gap-2.5">
          <img src={axiomMark} alt="" className="h-6.5 w-6.5 object-contain" aria-hidden="true" />
          <div className="hidden min-w-0 sm:block">
            <h1 className="truncate text-[11px] font-bold text-text-primary">
              Axiom Workspace
            </h1>
            <p className="truncate text-[8px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              Private
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-surface-2/55 text-text-primary animate-slide-in"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-2/25"
              }`}
            >
              <span className={isActive ? "text-accent" : "text-text-muted opacity-60 group-hover:opacity-100"}>
                {item.icon}
              </span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Compact Connection Status */}
      {activeItem !== "today" && (
        <div className="p-2 border-t border-border/10">
          <div className="flex items-center gap-1.5 px-1 py-1">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${sync.dotClass} ${sync.isSyncing ? "animate-pulse" : ""}`} />
            <div className="hidden min-w-0 sm:block">
              <p className="text-[9px] font-bold text-text-secondary truncate">{sync.label}</p>
              <p className="text-[8px] text-text-muted truncate mt-0.5">
                {sync.isSyncing && <Loader2 size={8} className="inline animate-spin mr-1" />}
                {sync.detail}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
