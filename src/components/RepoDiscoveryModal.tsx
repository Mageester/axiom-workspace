import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Search, Star, X } from "lucide-react";
import type { DiscoveredRepo, LiveRepo } from "../types";
import {
  discoverLocalRepos,
  filterDiscoverableRepos,
  getRepoProfile,
  ignoreDiscoveredRepo,
  loadIgnoredDiscoveredRepos,
  loadRepoPaths,
} from "../lib/repos";
import { iconBtnClass, primaryBtnClass, secondaryBtnClass } from "../lib/constants";

interface RepoDiscoveryModalProps {
  open: boolean;
  onClose: () => void;
  onAddRepo: (path: string) => Promise<LiveRepo>;
}

function isRecommended(repo: DiscoveredRepo): boolean {
  return repo.confidenceScore >= 90 || Boolean(getRepoProfile(repo.name));
}

export function RepoDiscoveryModal({
  open,
  onClose,
  onAddRepo,
}: RepoDiscoveryModalProps) {
  const [loading, setLoading] = useState(false);
  const [repos, setRepos] = useState<DiscoveredRepo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  async function runDiscovery() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const found = filterDiscoverableRepos(
        await discoverLocalRepos(),
        loadRepoPaths(),
        loadIgnoredDiscoveredRepos(),
      );
      setRepos(found);
      setSelected(new Set(found.filter(isRecommended).map((repo) => repo.path)));
      setMessage(
        found.length
          ? `Found ${found.length} candidate repo${found.length === 1 ? "" : "s"}.`
          : "No new repositories found in the standard Axiom folders.",
      );
    } catch {
      setError("Repo discovery could not run right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      void runDiscovery();
    }
  }, [open]);

  const recommended = useMemo(() => repos.filter(isRecommended), [repos]);

  if (!open) {
    return null;
  }

  async function addPaths(paths: string[]) {
    if (paths.length === 0) {
      return;
    }

    setAdding(true);
    setError("");
    let added = 0;
    for (const path of paths) {
      try {
        await onAddRepo(path);
        added += 1;
      } catch {
        // Keep adding the rest; the final message makes partial success clear.
      }
    }

    const latestPaths = loadRepoPaths();
    const ignored = loadIgnoredDiscoveredRepos();
    setRepos((prev) => filterDiscoverableRepos(prev, latestPaths, ignored));
    setSelected(new Set());
    setMessage(`Added ${added} repo${added === 1 ? "" : "s"}.`);
    setAdding(false);
  }

  function toggle(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function ignore(path: string) {
    ignoreDiscoveredRepo(path);
    setRepos((prev) => prev.filter((repo) => repo.path !== path));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-lg border border-border bg-surface-1 shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Discover Repos
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Axiom checks common local folders and only reads Git metadata.
            </p>
          </div>
          <button className={iconBtnClass} onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {(message || error) && (
            <div
              className={`rounded-md border px-3 py-2 text-sm ${
                error
                  ? "border-status-locked/40 bg-status-locked/10 text-status-locked"
                  : "border-border bg-surface-0 text-text-secondary"
              }`}
            >
              {error || message}
            </div>
          )}

          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border">
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 size={16} className="animate-spin" />
                Searching nearby folders...
              </div>
            </div>
          ) : repos.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border">
              <Search size={18} className="mb-2 text-text-muted" />
              <p className="text-sm text-text-muted">No new repos to add.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {repos.map((repo) => {
                const profile = getRepoProfile(repo.name);
                const checked = selected.has(repo.path);
                return (
                  <div
                    key={repo.path}
                    className="grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-md border border-border bg-surface-0 px-3 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(repo.path)}
                      className="mt-1 h-4 w-4 accent-indigo-500"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {profile?.friendlyName ?? repo.name}
                        </p>
                        {isRecommended(repo) && (
                          <span className="inline-flex items-center gap-1 rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs text-accent-hover">
                            <Star size={11} />
                            Recommended
                          </span>
                        )}
                        <span className="rounded border border-border bg-surface-2 px-2 py-0.5 text-xs text-text-muted">
                          {repo.detectedType}
                        </span>
                      </div>
                      {profile?.description && (
                        <p className="mt-1 text-xs text-text-secondary">
                          {profile.description}
                        </p>
                      )}
                      <p className="mt-1 break-all font-mono text-xs text-text-muted">
                        {repo.path}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">{repo.reason}</p>
                    </div>
                    <button
                      className={secondaryBtnClass}
                      onClick={() => ignore(repo.path)}
                    >
                      Ignore
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
          <button className={secondaryBtnClass} onClick={() => void runDiscovery()} disabled={loading || adding}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search Again
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              className={secondaryBtnClass}
              onClick={() => void addPaths(recommended.map((repo) => repo.path))}
              disabled={adding || recommended.length === 0}
            >
              <CheckCircle2 size={14} />
              Add All Recommended
            </button>
            <button
              className={primaryBtnClass}
              onClick={() => void addPaths(Array.from(selected))}
              disabled={adding || selected.size === 0}
            >
              {adding ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Add Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
