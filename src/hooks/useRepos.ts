import { useState, useEffect, useCallback } from "react";
import type { LiveRepo } from "../types";
import {
  loadRepoPaths,
  addRepoPath,
  removeRepoPath,
  getRepoStatus,
  getMultipleRepoStatuses,
} from "../lib/repos";

interface UseReposReturn {
  repos: LiveRepo[];
  loading: boolean;
  refreshingPaths: Set<string>;
  addRepo: (path: string) => Promise<LiveRepo>;
  removeRepo: (path: string) => void;
  refreshRepo: (path: string) => Promise<void>;
  refreshAll: () => Promise<void>;
}

export function useRepos(): UseReposReturn {
  const [repos, setRepos] = useState<LiveRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingPaths, setRefreshingPaths] = useState<Set<string>>(
    new Set(),
  );

  const refreshAll = useCallback(async () => {
    const paths = loadRepoPaths();
    if (paths.length === 0) {
      setRepos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const statuses = await getMultipleRepoStatuses(paths);
      setRepos(statuses);
    } catch {
      // If bulk call fails, keep existing repos
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshRepo = useCallback(async (path: string) => {
    setRefreshingPaths((prev) => new Set(prev).add(path));
    try {
      const status = await getRepoStatus(path);
      setRepos((prev) =>
        prev.map((r) => (r.path === path ? status : r)),
      );
    } finally {
      setRefreshingPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  }, []);

  const addRepo = useCallback(
    async (path: string): Promise<LiveRepo> => {
      const status = await getRepoStatus(path);
      if (status.status === "error" || !status.isGitRepo) {
        throw new Error(status.errorMessage || "Invalid Git repository");
      }

      addRepoPath(path);
      setRepos((prev) => {
        const existing = prev.findIndex((r) => r.path === status.path);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = status;
          return updated;
        }
        return [...prev, status];
      });
      return status;
    },
    [],
  );

  const removeRepo = useCallback((path: string) => {
    removeRepoPath(path);
    setRepos((prev) => prev.filter((r) => r.path !== path));
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return {
    repos,
    loading,
    refreshingPaths,
    addRepo,
    removeRepo,
    refreshRepo,
    refreshAll,
  };
}
