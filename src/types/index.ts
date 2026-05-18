export type RepoStatus = "clean" | "dirty" | "behind" | "locked" | "error";
export type UpstreamStatus = "ok" | "missing" | "error";

export type NavPage =
  | "dashboard"
  | "repos"
  | "sessions"
  | "locks"
  | "activity"
  | "settings";

export interface LiveRepo {
  id: string;
  name: string;
  path: string;
  currentBranch: string;
  isGitRepo: boolean;
  hasUncommittedChanges: boolean;
  hasUpstream: boolean;
  upstreamStatus: UpstreamStatus;
  upstreamErrorMessage?: string | null;
  isDetachedHead: boolean;
  ahead: number;
  behind: number;
  status: RepoStatus;
  lastCheckedAt: string;
  errorMessage: string | null;
}

export type SessionStatus = "active" | "ended";

export interface LockTarget {
  id: string;
  type: "file" | "folder" | "area";
  value: string;
  label?: string;
}

export interface WorkSession {
  id: string;
  repoId: string;
  repoName: string;
  repoPath: string;
  userName: string;
  title: string;
  notes?: string;
  branch?: string;
  targets: LockTarget[];
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
}

export interface SessionOverlap {
  sessionId: string;
  sessionTitle: string;
  repoName: string;
  targetValue: string;
  reason: string;
}

export interface DeviceIdentity {
  deviceId: string;
  deviceName: string;
  userName: string;
}

export interface SyncSettings {
  identity: DeviceIdentity;
  syncRepoPath: string;
  autoSyncEnabled: boolean;
}

export type SyncStatus =
  | "idle"
  | "validating"
  | "exporting"
  | "importing"
  | "writing"
  | "reading"
  | "success"
  | "error";

export type WorkspaceEventType =
  | "session_created"
  | "session_ended"
  | "session_updated"
  | "lock_created"
  | "lock_released"
  | "note_added";

export interface WorkspaceEvent {
  id: string;
  type: WorkspaceEventType;
  deviceId: string;
  userName: string;
  createdAt: string;
  payload: unknown;
  version: 1;
}

export interface SyncSnapshot {
  version: 1;
  exportedAt: string;
  device: DeviceIdentity;
  sessions: WorkSession[];
  events: WorkspaceEvent[];
}
