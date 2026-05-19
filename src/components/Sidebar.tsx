import {
  Home,
  GitFork,
  Briefcase,
  Activity,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";
import type { NavPage } from "../types";
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
}

export function Sidebar({ activeItem, onNavigate, setupComplete, activeSessionCount = 0 }: SidebarProps) {
  return (
    <aside className="w-56 h-screen bg-surface-1 border-r border-border flex flex-col">
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-black">
            <img
              src={axiomMark}
              alt=""
              className="h-6 w-6 object-contain"
              aria-hidden="true"
            />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-text-primary">
              Axiom Workspace
            </h1>
            <p className="text-xs text-text-muted mt-0.5">Team coordination</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                isActive
                  ? "bg-surface-3 text-text-primary"
                  : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-border space-y-1.5">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${setupComplete ? "bg-status-clean" : "bg-status-dirty"}`} />
          <span className="text-xs text-text-muted">
            {setupComplete ? "Sync connected" : "Local only"}
          </span>
        </div>
        {activeSessionCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-xs text-text-muted">
              {activeSessionCount} active work item{activeSessionCount === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
