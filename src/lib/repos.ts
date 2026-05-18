import { invoke } from "@tauri-apps/api/core";
import type { LiveRepo } from "../types";

const STORAGE_KEY = "axiom-repo-paths";

function normalizePath(path: string): string {
  return path.replace(/\//g, "\\").replace(/\\$/, "");
}

export function loadRepoPaths(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveRepoPaths(paths: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
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

export async function getRepoStatus(path: string): Promise<LiveRepo> {
  return invoke<LiveRepo>("get_repo_status", { path });
}

export async function getMultipleRepoStatuses(
  paths: string[],
): Promise<LiveRepo[]> {
  return invoke<LiveRepo[]>("get_multiple_repo_statuses", { paths });
}
