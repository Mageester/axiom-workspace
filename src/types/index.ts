export type RepoStatus = "clean" | "dirty" | "behind" | "locked" | "error";
export type UpstreamStatus = "ok" | "missing" | "error";
export type RepoChangeKind =
  | "added"
  | "deleted"
  | "modified"
  | "renamed"
  | "untracked";

export type NavPage =
  | "dashboard"
  | "repos"
  | "sessions"
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
  changedFileCount: number;
  changedFiles: RepoChangedFile[];
  hasMoreChangedFiles: boolean;
  status: RepoStatus;
  lastCheckedAt: string;
  errorMessage: string | null;
  refreshDurationMs?: number;
  gitCommandCount?: number;
  lastCommandError?: string | null;
}

export interface DiscoveredRepo {
  name: string;
  path: string;
  detectedType: string;
  confidenceScore: number;
  reason: string;
}

export interface RepoProfile {
  friendlyName: string;
  description: string;
}

export interface RepoDiagnostics {
  lastRefreshAt?: string;
  lastRefreshDurationMs?: number;
  lastRefreshRepoPath?: string;
  gitCommandCount?: number;
  lastCommandError?: string | null;
}

export interface RepoChangedFile {
  path: string;
  oldPath?: string | null;
  kind: RepoChangeKind;
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
  endNote?: string;
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
  createdAt: string;
}

export type SetupStatus =
  | "complete"
  | "missing"
  | "needs_action"
  | "error"
  | "checking";

export interface SetupChecklistItem {
  key:
    | "git"
    | "github"
    | "syncWorkspace"
    | "syncFolder"
    | "identity";
  label: string;
  status: SetupStatus;
  message: string;
}

export interface SetupState {
  setupComplete: boolean;
  identity: DeviceIdentity;
  syncRepoUrl: string;
  syncLocalPath: string;
  lastSetupCheckAt: string | null;
  lastError?: string;
}

export interface SyncSettings {
  syncRepoUrl: string;
  syncLocalPath: string;
  autoSyncEnabled: boolean;
  syncIntervalSeconds: number;
  autoRefreshReposEnabled: boolean;
  repoRefreshIntervalSeconds: number;
  repoDiscoveryPaths: string[];
  dismissedSuggestions: string[];
  lastSyncAt?: string;
  lastSyncStatus?: string;
  lastSyncError?: string;
  lastSyncDurationMs?: number;
  lastSyncGitCommandCount?: number;
  lastSyncCommandError?: string | null;
}

export type SyncStatus =
  | "idle"
  | "checking"
  | "writing_local_events"
  | "pulling_updates"
  | "reading_shared_events"
  | "merging"
  | "pushing"
  | "complete"
  | "error";

export type WorkspaceEventType =
  | "session_created"
  | "session_ended"
  | "session_updated"
  | "note_added"
  | "snapshot_created"
  | "sync_completed"
  | "repo_refreshed";

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
  createdAt: string;
  createdByDeviceId: string;
  sessions: WorkSession[];
  eventsApplied: string[];
}
