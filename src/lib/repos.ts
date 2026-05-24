import { invoke } from "@tauri-apps/api/core";
import type { DiscoveredRepo, LiveRepo, RepoProfile } from "../types";

const STORAGE_KEY = "axiom-repo-paths";
const NICKNAMES_KEY = "axiom-repo-nicknames";
const IGNORED_DISCOVERY_KEY = "axiom-workspace:ignored-discovered-repos";

const repoProfiles: Record<string, RepoProfile> = {
  axiomworkspace: {
    friendlyName: "Axiom Workspace",
    description: "Internal coordination app",
  },
  axiomsite: {
    friendlyName: "Axiom Site",
    description: "Public website and frontend",
  },
  getaxiom: {
    friendlyName: "Axiom Site",
    description: "Public website and frontend",
  },
  axiompipelineengine: {
    friendlyName: "Axiom Pipeline Engine",
    description: "Internal workflow and automation systems",
  },
};

function normalizePath(path: string): string {
  return path.trim().replace(/\//g, "\\").replace(/\\$/, "");
}

function pathKey(path: string): string {
  return normalizePath(path).toLowerCase();
}

function normalizeRepoName(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function getRepoProfile(nameOrPath: string): RepoProfile | null {
  const segments = nameOrPath.split(/[\\/]/).filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? nameOrPath;
  return repoProfiles[normalizeRepoName(lastSegment)] ?? null;
}

export function getRepoDisplayName(repo: Pick<LiveRepo, "name" | "path">, nickname?: string): string {
  return nickname?.trim() || getRepoProfile(repo.name)?.friendlyName || repo.name;
}

export function getRepoDescription(repo: Pick<LiveRepo, "name" | "path">): string | null {
  return getRepoProfile(repo.name)?.description ?? null;
}

export function loadRepoPaths(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((path): path is string => typeof path === "string")
      .map((path) => normalizePath(path))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function saveRepoPaths(paths: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
  } catch {
    // Storage may be unavailable; callers still keep in-memory state.
  }
}

export function addRepoPath(path: string): string[] {
  const paths = loadRepoPaths();
  const normalized = normalizePath(path);
  if (!paths.some((item) => pathKey(item) === pathKey(normalized))) {
    paths.push(normalized);
    saveRepoPaths(paths);
  }
  return paths;
}

export function removeRepoPath(path: string): string[] {
  const normalized = normalizePath(path);
  const paths = loadRepoPaths().filter((p) => pathKey(p) !== pathKey(normalized));
  saveRepoPaths(paths);
  return paths;
}

export function loadRepoNicknames(): Record<string, string> {
  try {
    const stored = localStorage.getItem(NICKNAMES_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveRepoNicknames(nicknames: Record<string, string>): void {
  try {
    localStorage.setItem(NICKNAMES_KEY, JSON.stringify(nicknames));
  } catch {
    // Storage may be unavailable
  }
}

export function setRepoNickname(path: string, nickname: string): Record<string, string> {
  const nicknames = loadRepoNicknames();
  const trimmed = nickname.trim();
  const key = normalizePath(path);
  if (trimmed) {
    nicknames[key] = trimmed;
  } else {
    delete nicknames[key];
  }
  saveRepoNicknames(nicknames);
  return nicknames;
}

export function loadIgnoredDiscoveredRepos(): string[] {
  try {
    const stored = localStorage.getItem(IGNORED_DISCOVERY_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function ignoreDiscoveredRepo(path: string): string[] {
  const ignored = loadIgnoredDiscoveredRepos();
  const key = pathKey(path);
  if (!ignored.some((item) => pathKey(item) === key)) {
    ignored.push(normalizePath(path));
  }
  localStorage.setItem(IGNORED_DISCOVERY_KEY, JSON.stringify(ignored));
  return ignored;
}

export function clearIgnoredDiscoveredRepos(): void {
  localStorage.removeItem(IGNORED_DISCOVERY_KEY);
}

export function filterDiscoverableRepos(
  discovered: DiscoveredRepo[],
  existingPaths = loadRepoPaths(),
  ignoredPaths = loadIgnoredDiscoveredRepos(),
): DiscoveredRepo[] {
  const existing = new Set(existingPaths.map(pathKey));
  const ignored = new Set(ignoredPaths.map(pathKey));
  return discovered.filter((repo) => {
    const key = pathKey(repo.path);
    return !existing.has(key) && !ignored.has(key);
  });
}

export async function getRepoStatus(path: string): Promise<LiveRepo> {
  return invoke<LiveRepo>("get_repo_status", { path });
}

export async function getMultipleRepoStatuses(
  paths: string[],
): Promise<LiveRepo[]> {
  return invoke<LiveRepo[]>("get_multiple_repo_statuses", { paths });
}

export async function discoverLocalRepos(): Promise<DiscoveredRepo[]> {
  return invoke<DiscoveredRepo[]>("discover_local_repos");
}

export interface PullResult {
  ok: boolean;
  message: string;
  commitsPulled: number;
  hadStash: boolean;
  stashConflict: boolean;
  durationMs: number;
}

export async function pullRepo(path: string): Promise<PullResult> {
  return invoke<PullResult>("pull_repo", { path });
}

export interface CloneResult {
  ok: boolean;
  message: string;
  localPath: string;
  durationMs: number;
}

export async function cloneRepo(repoUrl: string, parentDir: string, folderName: string): Promise<CloneResult> {
  return invoke<CloneResult>("clone_repo", { repoUrl, parentDir, folderName });
}
