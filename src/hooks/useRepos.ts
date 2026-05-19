import { useState, useEffect, useCallback, useRef } from "react";
import type { LiveRepo, RepoDiagnostics } from "../types";
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
  diagnostics: RepoDiagnostics;
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
  const [diagnostics, setDiagnostics] = useState<RepoDiagnostics>({});
  const refreshAllInFlightRef = useRef(false);
  const refreshingPathsRef = useRef<Set<string>>(new Set());

  const recordDiagnostics = useCallback(
    (statuses: LiveRepo[], fallbackPath?: string) => {
      const totalDuration = statuses.reduce(
        (sum, status) => sum + (status.refreshDurationMs ?? 0),
        0,
      );
      const totalCommands = statuses.reduce(
        (sum, status) => sum + (status.gitCommandCount ?? 0),
        0,
      );
      const lastError =
        statuses.find((status) => status.lastCommandError)?.lastCommandError ??
        statuses.find((status) => status.errorMessage)?.errorMessage ??
        null;
      const repoPath =
        statuses.length === 1 ? statuses[0]?.path ?? fallbackPath : "All repos";

      setDiagnostics({
        lastRefreshAt: new Date().toISOString(),
        lastRefreshDurationMs: totalDuration,
        lastRefreshRepoPath: repoPath,
        gitCommandCount: totalCommands,
        lastCommandError: lastError,
      });
    },
    [],
  );

  const refreshAll = useCallback(async () => {
    if (refreshAllInFlightRef.current) {
      return;
    }
    const paths = loadRepoPaths();
    if (paths.length === 0) {
      setRepos([]);
      setLoading(false);
      return;
    }

    refreshAllInFlightRef.current = true;
    setLoading(true);
    try {
      const statuses = await getMultipleRepoStatuses(paths);
      setRepos(statuses);
      recordDiagnostics(statuses);
    } catch {
      // If bulk call fails, keep existing repos
    } finally {
      setLoading(false);
      refreshAllInFlightRef.current = false;
    }
  }, [recordDiagnostics]);

  const refreshRepo = useCallback(async (path: string) => {
    if (refreshingPathsRef.current.has(path)) {
      return;
    }
    refreshingPathsRef.current.add(path);
    setRefreshingPaths((prev) => new Set(prev).add(path));
    try {
      const status = await getRepoStatus(path);
      setRepos((prev) =>
        prev.map((r) => (r.path === path ? status : r)),
      );
      recordDiagnostics([status], path);
    } finally {
      refreshingPathsRef.current.delete(path);
      setRefreshingPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  }, [recordDiagnostics]);

  const addRepo = useCallback(
    async (path: string): Promise<LiveRepo> => {
      const status = await getRepoStatus(path);
      if (status.status === "error" || !status.isGitRepo) {
        throw new Error(status.errorMessage || "Invalid Git repository");
      }

      addRepoPath(path);
      recordDiagnostics([status], path);
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
    [recordDiagnostics],
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
    diagnostics,
    addRepo,
    removeRepo,
    refreshRepo,
    refreshAll,
  };
}
