export type RepoStatus = "clean" | "dirty" | "behind" | "locked";

export type NavPage =
  | "dashboard"
  | "repos"
  | "sessions"
  | "locks"
  | "activity"
  | "settings";

export interface Repo {
  id: string;
  name: string;
  description: string;
  status: RepoStatus;
  branch: string;
  lastSync: string;
}
