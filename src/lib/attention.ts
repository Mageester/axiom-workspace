import type { LiveRepo, WorkSession } from "../types";
import type { AttentionItem, RegisteredProject } from "../types/workspace";

export function computeAttentionItems(
  repos: LiveRepo[],
  activeSessions: WorkSession[],
  currentUser: string,
  registeredProjects: RegisteredProject[],
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const repo of repos) {
    if (repo.behind > 0) {
      items.push({
        id: `behind-${repo.id}`,
        title: "Behind remote",
        description: `${repo.name} is ${repo.behind} commit${repo.behind > 1 ? "s" : ""} behind. Pull to stay current.`,
        severity: "warning",
        actionLabel: "View project",
        projectId: repo.id,
      });
    }

    if (repo.changedFileCount > 10) {
      items.push({
        id: `many-changes-${repo.id}`,
        title: "Many changed files",
        description: `${repo.name} has ${repo.changedFileCount} changed files. Review before continuing.`,
        severity: "info",
        projectId: repo.id,
      });
    }

    if (repo.status === "error") {
      items.push({
        id: `error-${repo.id}`,
        title: "Project needs attention",
        description: `${repo.name} has an error: ${repo.errorMessage || "unknown issue"}.`,
        severity: "critical",
        projectId: repo.id,
      });
    }
  }

  const teammateSessionsByRepo = new Map<string, WorkSession[]>();
  for (const session of activeSessions) {
    if (session.userName.toLowerCase() !== currentUser.toLowerCase()) {
      const existing = teammateSessionsByRepo.get(session.repoId) || [];
      existing.push(session);
      teammateSessionsByRepo.set(session.repoId, existing);
    }
  }

  const myActiveRepos = new Set(
    activeSessions
      .filter(s => s.userName.toLowerCase() === currentUser.toLowerCase())
      .map(s => s.repoId),
  );

  for (const [repoId, sessions] of teammateSessionsByRepo) {
    if (myActiveRepos.has(repoId)) {
      const names = [...new Set(sessions.map(s => s.userName))].join(", ");
      items.push({
        id: `teammate-same-${repoId}`,
        title: "Teammate active on same project",
        description: `${names} is also working on this project. Coordinate to avoid conflicts.`,
        severity: "warning",
        projectId: repoId,
      });
    }
  }

  for (const session of activeSessions) {
    if (session.userName.toLowerCase() === currentUser.toLowerCase()) continue;
    const elapsed = Date.now() - new Date(session.startedAt).getTime();
    const hours = elapsed / (1000 * 60 * 60);
    if (hours > 6) {
      items.push({
        id: `long-session-${session.id}`,
        title: "Long-running session",
        description: `${session.userName} has been working on ${session.repoName} for ${Math.floor(hours)}h.`,
        severity: "info",
      });
    }
  }

  for (const project of registeredProjects) {
    if (project.installStatus === "not_installed") {
      items.push({
        id: `uncloned-${project.id}`,
        title: "Clone required",
        description: `${project.name} is registered but not installed locally.`,
        severity: "info",
        actionLabel: "Clone Latest",
        projectId: project.id,
      });
    }
  }

  items.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return items;
}
