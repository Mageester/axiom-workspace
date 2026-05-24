import type { LiveRepo, WorkSession } from "../types";
import type { ProjectSafety, ProjectSafetyLabel, RegisteredProject } from "../types/workspace";

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
    s => s.repoId === repo.id && s.userName.toLowerCase() === currentUser.toLowerCase(),
  );
  if (mySessions.length > 0) {
    return { label: "working_here", displayText: "Working here", canStart: false };
  }

  const teammateSessions = activeSessions.filter(
    s => s.repoId === repo.id && s.userName.toLowerCase() !== currentUser.toLowerCase(),
  );
  if (teammateSessions.length > 0) {
    const names = [...new Set(teammateSessions.map(s => s.userName))];
    const firstName = names[0].split(" ")[0];
    return {
      label: "teammate_active",
      displayText: "Review first",
      teammate: firstName,
      canStart: true,
    };
  }

  if (repo.behind > 0) {
    return { label: "needs_sync", displayText: "Needs sync", canStart: true };
  }

  if (repo.status === "error") {
    return { label: "review_first", displayText: "Review first", canStart: false };
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
    case "clone_required": return "bg-surface-2";
    case "not_configured": return "bg-surface-2";
  }
}
