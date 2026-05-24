export type AttentionSeverity = "info" | "warning" | "critical";

export interface AttentionItem {
  id: string;
  title: string;
  description: string;
  severity: AttentionSeverity;
  action?: string;
  actionLabel?: string;
  projectId?: string;
  dismissable?: boolean;
}

export type ProjectInstallStatus = "installed" | "not_installed" | "unknown";

export interface RegisteredProject {
  id: string;
  name: string;
  slug: string;
  repoUrl: string;
  defaultBranch: string;
  localPath?: string;
  installStatus: ProjectInstallStatus;
  lastCheckedAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HandoffNote {
  id: string;
  projectId?: string;
  sessionId?: string;
  authorUserName: string;
  summary?: string;
  details?: string;
  createdAt: string;
}

export type ProjectSafetyLabel =
  | "safe_to_start"
  | "review_first"
  | "working_here"
  | "teammate_active"
  | "needs_sync"
  | "clone_required"
  | "conflict"
  | "status_unavailable"
  | "not_configured";

export interface ProjectSafety {
  label: ProjectSafetyLabel;
  displayText: string;
  teammate?: string;
  canStart: boolean;
}

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  category: "work" | "project" | "navigation" | "system";
  action: () => void;
  keywords?: string[];
}

export interface FinishWorkInput {
  sessionId: string;
  summary?: string;
  details?: string;
}

export interface WorkspaceState {
  projects: RegisteredProject[];
  isOnline: boolean;
  lastSyncAt?: string;
}
