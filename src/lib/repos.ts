import { invoke } from "@tauri-apps/api/core";
import type { LiveRepo } from "../types";

const STORAGE_KEY = "axiom-repo-paths";
const NICKNAMES_KEY = "axiom-repo-nicknames";

function normalizePath(path: string): string {
  return path.replace(/\//g, "\\").replace(/\\$/, "");
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
      .map((path) => path.trim())
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
  if (!paths.includes(normalized)) {
    paths.push(normalized);
    saveRepoPaths(paths);
  }
  return paths;
}

export function removeRepoPath(path: string): string[] {
  const normalized = normalizePath(path);
  const paths = loadRepoPaths().filter((p) => p !== normalized);
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
  if (trimmed) {
    nicknames[path] = trimmed;
  } else {
    delete nicknames[path];
  }
  saveRepoNicknames(nicknames);
  return nicknames;
}

export async function getRepoStatus(path: string): Promise<LiveRepo> {
  return invoke<LiveRepo>("get_repo_status", { path });
}

export async function getMultipleRepoStatuses(
  paths: string[],
): Promise<LiveRepo[]> {
  return invoke<LiveRepo[]>("get_multiple_repo_statuses", { paths });
}
