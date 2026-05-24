import type { LiveRepo } from "../types";

export function formatChangedFiles(count: number): string {
  if (count <= 0) return "Clean";
  return `${count} file${count === 1 ? "" : "s"} changed`;
}

export function projectStatusText(repo: LiveRepo | null): string {
  if (!repo) return "Clone required";
  if (repo.status === "error") return "Status unavailable";
  if (repo.ahead > 0 && repo.behind > 0) return "Conflict";
  if (repo.behind > 0) return "Behind remote";
  if (repo.changedFileCount > 0) return formatChangedFiles(repo.changedFileCount);
  return "Clean";
}
