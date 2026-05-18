import {
  LayoutDashboard,
  GitFork,
  Timer,
  Lock,
  Activity,
  Settings,
} from "lucide-react";
import type { ReactNode } from "react";
import type { NavPage } from "../types";

const NAV_ITEMS: { id: NavPage; label: string; icon: ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { id: "repos", label: "Repos", icon: <GitFork size={18} /> },
  { id: "sessions", label: "Sessions", icon: <Timer size={18} /> },
  { id: "locks", label: "Locks", icon: <Lock size={18} /> },
  { id: "activity", label: "Activity", icon: <Activity size={18} /> },
  { id: "settings", label: "Settings", icon: <Settings size={18} /> },
];

interface SidebarProps {
  activeItem: NavPage;
  onNavigate: (id: NavPage) => void;
}

export function Sidebar({ activeItem, onNavigate }: SidebarProps) {
  return (
    <aside className="w-56 h-screen bg-surface-1 border-r border-border flex flex-col">
      <div className="px-5 py-5 border-b border-border">
        <h1 className="text-sm font-semibold tracking-wide text-text-primary uppercase">
          Axiom
        </h1>
        <p className="text-xs text-text-muted mt-0.5">Workspace</p>
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

      <div className="px-5 py-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-status-clean" />
          <span className="text-xs text-text-muted">All systems nominal</span>
        </div>
      </div>
    </aside>
  );
}
