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
