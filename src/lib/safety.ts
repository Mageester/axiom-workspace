import type { LiveRepo, WorkSession } from "../types";
import type { ProjectSafety, ProjectSafetyLabel, RegisteredProject } from "../types/workspace";
import { normalizeDisplayName, samePerson } from "./identity";

export function assessProjectSafety(
  repo: LiveRepo | null,
  registeredProject: RegisteredProject | null,
  activeSessions: WorkSession[],
  currentUser: string,
): ProjectSafety {
  if (!repo && registeredProject?.installStatus === "not_installed") {
    return { label: "clone_required", displayText: "Clone required", canStart: false };
  }

  if (!repo) {
    return { label: "not_configured", displayText: "Not configured", canStart: false };
  }

  const mySessions = activeSessions.filter(
    s => s.repoId === repo.id && samePerson(s.userName, currentUser),
  );
  if (mySessions.length > 0) {
    return { label: "working_here", displayText: "You are working here", canStart: false };
  }

  const teammateSessions = activeSessions.filter(
    s => s.repoId === repo.id && !samePerson(s.userName, currentUser),
  );
  if (teammateSessions.length > 0) {
    const names = [...new Set(teammateSessions.map(s => normalizeDisplayName(s.userName)))];
    return {
      label: "teammate_active",
      displayText: `${names[0]} active`,
      teammate: names[0],
      canStart: true,
    };
  }

  if (repo.status === "error") {
    return { label: "status_unavailable", displayText: "Status unavailable", canStart: false };
  }

  if (repo.ahead > 0 && repo.behind > 0) {
    return { label: "conflict", displayText: "Needs attention", canStart: false };
  }

  if (repo.behind > 0) {
    return { label: "review_first", displayText: "Review first", canStart: true };
  }

  if (repo.changedFileCount > 0 || repo.hasUncommittedChanges || repo.isDetachedHead || !repo.currentBranch) {
    return { label: "review_first", displayText: "Review first", canStart: true };
  }

  return { label: "safe_to_start", displayText: "Safe to start", canStart: true };
}

export function safetyColor(label: ProjectSafetyLabel): string {
  switch (label) {
    case "safe_to_start": return "text-status-clean";
    case "working_here": return "text-accent";
    case "teammate_active": return "text-status-dirty";
    case "review_first": return "text-status-dirty";
    case "needs_sync": return "text-status-behind";
    case "conflict": return "text-status-locked";
    case "status_unavailable": return "text-status-dirty";
    case "clone_required": return "text-text-muted";
    case "not_configured": return "text-text-muted";
  }
}

export function safetyBgColor(label: ProjectSafetyLabel): string {
  switch (label) {
    case "safe_to_start": return "bg-status-clean/10";
    case "working_here": return "bg-accent/10";
    case "teammate_active": return "bg-status-dirty/10";
    case "review_first": return "bg-status-dirty/10";
    case "needs_sync": return "bg-status-behind/10";
    case "conflict": return "bg-status-locked/10";
    case "status_unavailable": return "bg-status-dirty/10";
    case "clone_required": return "bg-surface-2";
    case "not_configured": return "bg-surface-2";
  }
}
