import type { RepoRiskLevel, RepoSafetyState } from "../types";

interface SafetyConfig {
  label: string;
  tooltip: string;
  className: string;
}

const SAFETY_CONFIG: Record<RepoSafetyState, SafetyConfig> = {
  safe: {
    label: "Safe",
    tooltip: "Repo is up to date with no issues.",
    className: "bg-status-clean/15 text-status-clean border-status-clean/30",
  },
  dirty_low_risk: {
    label: "Low Risk",
    tooltip: "Only non-source files like tooling, docs, or generated files changed.",
    className: "bg-status-clean/15 text-status-clean border-status-clean/30",
  },
  dirty_needs_review: {
    label: "Needs Review",
    tooltip: "Source code, config, or deployment files changed — review before committing.",
    className: "bg-status-dirty/15 text-status-dirty border-status-dirty/30",
  },
  ahead_of_remote: {
    label: "Ahead",
    tooltip: "Local is ahead of the remote branch. Push when ready.",
    className: "bg-status-behind/15 text-status-behind border-status-behind/30",
  },
  behind_remote: {
    label: "Behind",
    tooltip: "Remote has newer commits. Pull to stay in sync.",
    className: "bg-status-behind/15 text-status-behind border-status-behind/30",
  },
  conflict_risk: {
    label: "Conflict Risk",
    tooltip: "Repo has errors or sync issues. Needs immediate attention.",
    className: "bg-status-locked/15 text-status-locked border-status-locked/30",
  },
  deployment_risk: {
    label: "Deploy Risk",
    tooltip: "Deployment or pipeline files changed. Verify before pushing.",
    className: "bg-status-locked/15 text-status-locked border-status-locked/30",
  },
};

const RISK_CLASS: Record<RepoRiskLevel, string> = {
  none: "text-text-muted border-border bg-surface-2",
  low: "text-status-clean border-status-clean/30 bg-status-clean/10",
  medium: "text-status-dirty border-status-dirty/30 bg-status-dirty/10",
  high: "text-status-locked border-status-locked/30 bg-status-locked/10",
};

interface RepoIntelligenceBadgeProps {
  safetyState: RepoSafetyState;
  riskLevel: RepoRiskLevel;
}

export function RepoIntelligenceBadge({ safetyState }: RepoIntelligenceBadgeProps) {
  const config = SAFETY_CONFIG[safetyState];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.className}`}
      title={config.tooltip}
    >
      {config.label}
    </span>
  );
}

export function RiskLevelBadge({ riskLevel }: { riskLevel: RepoRiskLevel }) {
  if (riskLevel === "none") return null;
  const labels: Record<RepoRiskLevel, string> = {
    none: "None",
    low: "Low",
    medium: "Medium",
    high: "High",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${RISK_CLASS[riskLevel]}`}
      title={`Risk level: ${labels[riskLevel]}`}
    >
      {labels[riskLevel]} risk
    </span>
  );
}
