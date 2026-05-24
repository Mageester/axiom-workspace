import type { LiveRepo, SyncSettings, WorkSession } from "../types";
import type { AttentionItem, RegisteredProject } from "../types/workspace";
import { normalizeDisplayName, samePerson } from "./identity";

export function computeAttentionItems(
  repos: LiveRepo[],
  activeSessions: WorkSession[],
  currentUser: string,
  registeredProjects: RegisteredProject[],
  syncSettings?: SyncSettings,
  cloudSyncUnavailable = false,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (cloudSyncUnavailable) {
    items.push({
      id: "cloud-sync-unavailable",
      title: "Cloud sync unavailable",
      description: "Axiom is using local state until the Worker is reachable again.",
      severity: "warning",
      actionLabel: "Open settings",
    });
  }

  if (syncSettings?.lastSyncError) {
    items.push({
      id: "sync-failed",
      title: "Sync failed",
      description: syncSettings.lastSyncError,
      severity: "warning",
      actionLabel: "Open settings",
    });
  }

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

    if (repo.ahead > 0 && repo.behind > 0) {
      items.push({
        id: `conflict-${repo.id}`,
        title: "Review first",
        description: `${repo.name} has local and remote changes. Pull manually before starting new work.`,
        severity: "critical",
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
  const sessionsByUserAndRepo = new Map<string, WorkSession[]>();
  for (const session of activeSessions) {
    const displayName = normalizeDisplayName(session.userName);
    const sessionKey = `${displayName.toLowerCase()}-${session.repoId}`;
    sessionsByUserAndRepo.set(sessionKey, [...(sessionsByUserAndRepo.get(sessionKey) || []), session]);
    if (!samePerson(session.userName, currentUser)) {
      const existing = teammateSessionsByRepo.get(session.repoId) || [];
      existing.push(session);
      teammateSessionsByRepo.set(session.repoId, existing);
    }
  }

  for (const sessions of sessionsByUserAndRepo.values()) {
    if (sessions.length > 1) {
      const displayName = normalizeDisplayName(sessions[0].userName);
      items.push({
        id: `duplicate-session-${displayName}-${sessions[0].repoId}`,
        title: "Duplicate active sessions",
        description: `${displayName} has ${sessions.length} active sessions on ${sessions[0].repoName}.`,
        severity: "warning",
        projectId: sessions[0].repoId,
      });
    }
  }

  const myActiveRepos = new Set(
    activeSessions
      .filter(s => samePerson(s.userName, currentUser))
      .map(s => s.repoId),
  );

  for (const [repoId, sessions] of teammateSessionsByRepo) {
    if (myActiveRepos.has(repoId)) {
      const names = [...new Set(sessions.map(s => normalizeDisplayName(s.userName)))].join(", ");
      items.push({
        id: `teammate-same-${repoId}`,
        title: "Teammate active on same project",
        description: `${names} is also working on this project. Coordinate to avoid conflicts.`,
        severity: "warning",
        projectId: repoId,
      });
    }
  }

  const longSessions = new Map<string, WorkSession[]>();
  for (const session of activeSessions) {
    if (samePerson(session.userName, currentUser)) continue;
    const elapsed = Date.now() - new Date(session.startedAt).getTime();
    const hours = elapsed / (1000 * 60 * 60);
    if (hours > 6) {
    const user = normalizeDisplayName(session.userName);
    const key = `${user.toLowerCase()}-${session.repoId}`;
      longSessions.set(key, [...(longSessions.get(key) || []), session]);
    }
  }

  for (const sessions of longSessions.values()) {
    const user = normalizeDisplayName(sessions[0].userName);
    const longestHours = Math.max(...sessions.map((session) => Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 36e5)));
    items.push({
      id: `long-session-${user}-${sessions[0].repoId}`,
      title: sessions.length > 1 ? `${user} has long-running sessions` : `${user} has a long-running session`,
      description: sessions.length > 1
        ? `${sessions[0].repoName} · ${sessions.length} sessions · longest ${longestHours}h`
        : `${sessions[0].repoName} · ${longestHours}h`,
      severity: "info",
      actionLabel: "Review",
      projectId: sessions[0].repoId,
    });
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

    if (project.lastCheckedAt) {
      const elapsedHours = (Date.now() - new Date(project.lastCheckedAt).getTime()) / 36e5;
      if (elapsedHours > 24) {
        items.push({
          id: `stale-project-${project.id}`,
          title: "Project not synced recently",
          description: `${project.name} has not refreshed today.`,
          severity: "info",
          actionLabel: "Refresh Status",
          projectId: project.id,
        });
      }
    }
  }

  items.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return items;
}
