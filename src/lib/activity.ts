import type { WorkspaceEvent } from "../types";
import { normalizeDisplayName } from "./identity";

function projectFromPayload(payload: Record<string, unknown> | null): string | undefined {
  if (!payload) return undefined;
  const session = payload.session as { repoName?: string } | undefined;
  const handoff = payload.handoff as { projectName?: string } | undefined;
  return session?.repoName
    || handoff?.projectName
    || (payload.repoName as string | undefined)
    || (payload.projectName as string | undefined);
}

export function humanizeActivityEvent(event: WorkspaceEvent, includeUser = true): string {
  const payload = event.payload as Record<string, unknown> | null;
  const user = normalizeDisplayName(event.userName);
  const prefix = includeUser ? `${user} ` : "";
  const project = projectFromPayload(payload);

  switch (event.type) {
    case "session_created":
      return `${prefix}started work${project ? ` on ${project}` : ""}`;
    case "session_ended":
      return `${prefix}finished work${project ? ` on ${project}` : ""}`;
    case "note_added":
      return `${prefix}left a handoff${project ? ` on ${project}` : ""}`;
    case "sync_completed":
      return user === "Aidan" || user === "Riley"
        ? `${prefix}synced Workspace`
        : "Workspace synced";
    case "repo_refreshed":
      return project ? `${project} refreshed` : "Projects refreshed";
    case "snapshot_created":
      return "Workspace snapshot saved";
    default:
      return event.type.replace(/_/g, " ");
  }
}
