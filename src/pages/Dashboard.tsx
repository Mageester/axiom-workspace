import { Plus, RefreshCw, Play } from "lucide-react";
import { PLACEHOLDER_REPOS } from "../lib/constants";
import { RepoCard } from "../components/RepoCard";
import { StatusBadge } from "../components/StatusBadge";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/StatCard";

const secondaryBtnClass =
  "inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-surface-2 text-text-secondary border border-border hover:bg-surface-3 hover:text-text-primary transition-colors cursor-pointer";

const primaryBtnClass =
  "inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer";

export function Dashboard() {
  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        title="Dashboard"
        description="Workspace overview and repo status"
        actions={
          <div className="flex items-center gap-2">
            <button className={secondaryBtnClass}>
              <RefreshCw size={14} />
              Refresh
            </button>
            <button className={secondaryBtnClass}>
              <Plus size={14} />
              Add Repo
            </button>
            <button className={primaryBtnClass}>
              <Play size={14} />
              Start Session
            </button>
          </div>
        }
      />

      <main className="p-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
              Repositories
            </h3>
            <div className="flex items-center gap-2">
              <StatusBadge status="clean" />
              <StatusBadge status="dirty" />
              <StatusBadge status="behind" />
              <StatusBadge status="locked" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {PLACEHOLDER_REPOS.map((repo) => (
              <RepoCard key={repo.id} repo={repo} />
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Total Repos" value={3} />
          <StatCard label="Active Sessions" value={0} />
          <StatCard label="Locked Files" value={0} />
        </div>
      </main>
    </div>
  );
}
