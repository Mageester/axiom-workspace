import type { RepoStatus } from "../types";

const STATUS_CONFIG: Record<RepoStatus, { label: string; tooltip: string; className: string }> = {
  clean: {
    label: "All Good",
    tooltip: "This repo is up to date with no uncommitted changes.",
    className: "bg-status-clean/15 text-status-clean border-status-clean/30",
  },
  dirty: {
    label: "Unsaved Changes",
    tooltip: "You have local changes that haven't been committed yet.",
    className: "bg-status-dirty/15 text-status-dirty border-status-dirty/30",
  },
  behind: {
    label: "Updates Available",
    tooltip: "The remote has newer commits. Pull to get the latest.",
    className: "bg-status-behind/15 text-status-behind border-status-behind/30",
  },
  locked: {
    label: "Claimed",
    tooltip: "Someone on the team has claimed files in this repo.",
    className: "bg-status-locked/15 text-status-locked border-status-locked/30",
  },
  error: {
    label: "Needs Attention",
    tooltip: "Something went wrong checking this repo. See details below.",
    className: "bg-status-locked/15 text-status-locked border-status-locked/30",
  },
};

interface StatusBadgeProps {
  status: RepoStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.className}`}
      title={config.tooltip}
    >
      {config.label}
    </span>
  );
}
