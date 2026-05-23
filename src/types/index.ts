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
  | "board"
  | "repos"
  | "sessions"
  | "locks"
  | "activity"
  | "settings";

export type SessionOverlapSeverity = "critical" | "high" | "medium";
export type BoardColumnId =
  | "inbox"
  | "ready"
  | "in_progress"
  | "blocked"
  | "review"
  | "done";
export type BoardPriority = "low" | "medium" | "high" | "urgent";
export type BoardAssignee = "you" | "agent" | "both" | "unassigned";
export type WorkRiskLevel = "low" | "medium" | "high" | "critical";

export type RepoFileCategory =
  | "source_code"
  | "config"
  | "deployment"
  | "generated"
  | "local_tooling"
  | "screenshots"
  | "docs"
  | "unknown";

export type RepoSafetyState =
  | "safe"
  | "dirty_low_risk"
  | "dirty_needs_review"
  | "ahead_of_remote"
  | "behind_remote"
  | "conflict_risk"
  | "deployment_risk";

export type RepoRiskLevel = "none" | "low" | "medium" | "high";

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

export interface FileClassification {
  path: string;
  kind: RepoChangeKind;
  category: RepoFileCategory;
}

export interface RepoIntelligence {
  safetyState: RepoSafetyState;
  riskLevel: RepoRiskLevel;
  recommendation: string;
  nextAction: string;
  classifiedFiles: FileClassification[];
  categoryCounts: Record<RepoFileCategory, number>;
  isDirtyIntentional: boolean;
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

export interface BoardChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface WorkCard {
  id: string;
  title: string;
  description?: string;
  column: BoardColumnId;
  priority: BoardPriority;
  assignee: BoardAssignee;
  repoId?: string;
  repoName?: string;
  repoPath?: string;
  linkedSessionId?: string;
  branch?: string;
  paths: string[];
  acceptanceCriteria: BoardChecklistItem[];
  testPlan?: string;
  agentBrief?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CardRiskAssessment {
  level: WorkRiskLevel;
  label: string;
  reasons: string[];
}

export interface SessionOverlap {
  sessionId: string;
  sessionTitle: string;
  repoName: string;
  targetValue: string;
  reason: string;
  severity: SessionOverlapSeverity;
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
  | "board_card_created"
  | "board_card_updated"
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

export interface TrayWidgetState {
  activeSessions: WorkSession[];
  repos: TrayRepoSummary[];
  recentEvents: TrayEventSummary[];
  boardSummary: TrayBoardSummary;
  syncStatus: SyncStatus;
  lastSyncAt?: string;
  currentUser: string;
}

export interface TrayRepoSummary {
  name: string;
  status: RepoStatus;
  branch: string;
  changedFileCount: number;
  behind: number;
  hasLockConflict: boolean;
}

export interface TrayEventSummary {
  id: string;
  type: WorkspaceEventType;
  userName: string;
  description: string;
  createdAt: string;
}

export interface TrayBoardSummary {
  inbox: number;
  ready: number;
  in_progress: number;
  blocked: number;
  review: number;
  done: number;
  assignedToYou: number;
}

export interface TrayNotification {
  id: string;
  type: "session_started" | "session_ended" | "sync_complete" | "lock_conflict";
  title: string;
  message: string;
  userName: string;
  timestamp: string;
}

export interface SyncSnapshot {
  version: 1;
  createdAt: string;
  createdByDeviceId: string;
  sessions: WorkSession[];
  cards?: WorkCard[];
  eventsApplied: string[];
}
