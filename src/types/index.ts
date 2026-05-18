export type RepoStatus = "clean" | "dirty" | "behind" | "locked" | "error";

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
  ahead: number;
  behind: number;
  status: RepoStatus;
  lastCheckedAt: string;
  errorMessage: string | null;
}
