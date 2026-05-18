import type { RepoStatus } from "../types";

const STATUS_CONFIG: Record<RepoStatus, { label: string; className: string }> = {
  clean: {
    label: "Clean",
    className: "bg-status-clean/15 text-status-clean border-status-clean/30",
  },
  dirty: {
    label: "Dirty",
    className: "bg-status-dirty/15 text-status-dirty border-status-dirty/30",
  },
  behind: {
    label: "Behind",
    className: "bg-status-behind/15 text-status-behind border-status-behind/30",
  },
  locked: {
    label: "Locked",
    className: "bg-status-locked/15 text-status-locked border-status-locked/30",
  },
  error: {
    label: "Error",
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
    >
      {config.label}
    </span>
  );
}
