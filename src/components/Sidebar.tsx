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
  { id: "today", label: "Today", icon: <Home size={15} strokeWidth={2.5} /> },
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
  activeSessionCount = 0,
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
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border/20 bg-surface-1 select-none">
      {/* Brand Header */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <img src={axiomMark} alt="" className="h-6.5 w-6.5 object-contain" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="truncate text-xs font-bold tracking-[0.12em] text-text-primary uppercase">
              Axiom
            </h1>
          </div>
        </div>
      </div>

      {/* Navigation Spacing Tightened */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-surface-2/70 text-text-primary border-l-[3px] border-accent pl-2.25 rounded-l-none"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-2/25"
              }`}
            >
              <span className={isActive ? "text-accent" : "text-text-muted opacity-60 group-hover:opacity-100"}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Compact Connection Card */}
      <div className="p-3">
        <div className="rounded-xl border border-border/15 bg-surface-2/15 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${sync.dotClass}`} />
            <span className={`text-[9px] font-bold uppercase tracking-widest ${sync.textClass}`}>
              {sync.label}
            </span>
          </div>
          <p className="text-[10px] text-text-muted font-medium truncate">
            {sync.isSyncing ? <Loader2 size={10} className="inline animate-spin" /> : null}
            {sync.detail}
          </p>
        </div>
      </div>
    </aside>
  );
}
