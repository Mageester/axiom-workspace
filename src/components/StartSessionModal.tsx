import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import type { LiveRepo, LockTarget, SessionOverlap, WorkSession } from "../types";
import {
  createLockTarget,
  detectSessionOverlap,
  type CreateSessionInput,
} from "../lib/sessions";
import { primaryBtnClass, secondaryBtnClass, iconBtnClass } from "../lib/constants";
import { getRepoDisplayName } from "../lib/repos";

interface StartSessionModalProps {
  open: boolean;
  repos: LiveRepo[];
  activeSessions: WorkSession[];
  initialRepo?: LiveRepo | null;
  defaultUserName: string;
  onClose: () => void;
  onCreate: (input: CreateSessionInput) => void;
}

interface FormErrors {
  repoId?: string;
  userName?: string;
  title?: string;
  targetValue?: string;
  targets?: string;
}

const fieldClass =
  "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent";

function formatTargetType(type: LockTarget["type"]): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function StartSessionModal({
  open,
  repos,
  activeSessions,
  initialRepo,
  defaultUserName,
  onClose,
  onCreate,
}: StartSessionModalProps) {
  const [repoId, setRepoId] = useState("");
  const [userName, setUserName] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [branch, setBranch] = useState("");
  const [targetType, setTargetType] = useState<LockTarget["type"]>("area");
  const [targetValue, setTargetValue] = useState("");
  const [targets, setTargets] = useState<LockTarget[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [hasConfirmedOverlap, setHasConfirmedOverlap] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [targetTouched, setTargetTouched] = useState(false);

  function inferTarget(repo: LiveRepo | null, workTitle: string): LockTarget {
    if (!repo || repo.changedFiles.length === 0) {
      return createLockTarget("area", workTitle.trim() || "general work");
    }
    if (repo.changedFileCount === 1 && repo.changedFiles[0]) {
      return createLockTarget("file", repo.changedFiles[0].path);
    }
    const folders = Array.from(
      new Set(
        repo.changedFiles
          .map((file) => file.path.split("/").slice(0, -1).join("/"))
          .filter(Boolean),
      ),
    );
    if (folders.length === 1) {
      return createLockTarget("folder", folders[0]);
    }
    return createLockTarget("area", workTitle.trim() || "general work");
  }

  useEffect(() => {
    if (!open) {
      setRepoId("");
      setUserName("");
      setTitle("");
      setNotes("");
      setBranch("");
      setTargetType("area");
      setTargetValue("");
      setTargets([]);
      setErrors({});
      setHasConfirmedOverlap(false);
      setAdvancedOpen(false);
      setTargetTouched(false);
      return;
    }

    const repo = initialRepo ?? repos[0] ?? null;
    const inferredTarget = inferTarget(repo, "");
    setRepoId(repo?.id ?? "");
    setBranch(repo?.currentBranch ?? "");
    setUserName(defaultUserName);
    setTargetType(inferredTarget.type);
    setTargetValue(inferredTarget.value);
    setTargets([inferredTarget]);
    setAdvancedOpen(false);
    setTargetTouched(false);
  }, [defaultUserName, initialRepo, open, repos]);

  const selectedRepo = repos.find((repo) => repo.id === repoId) ?? null;

  useEffect(() => {
    if (!open || targetTouched || !selectedRepo) {
      return;
    }
    const inferredTarget = inferTarget(selectedRepo, title);
    setTargetType(inferredTarget.type);
    setTargetValue(inferredTarget.value);
    setTargets([inferredTarget]);
  }, [open, selectedRepo, targetTouched, title]);

  const sessionInput = useMemo<CreateSessionInput | null>(() => {
    if (!selectedRepo) {
      return null;
    }

    return {
      repoId: selectedRepo.id,
      repoName: getRepoDisplayName(selectedRepo),
      repoPath: selectedRepo.path,
      userName,
      title,
      notes,
      branch,
      targets,
    };
  }, [branch, notes, selectedRepo, targets, title, userName]);

  const overlaps = useMemo<SessionOverlap[]>(
    () =>
      sessionInput
        ? detectSessionOverlap(sessionInput, activeSessions)
        : [],
    [activeSessions, sessionInput],
  );

  if (!open) {
    return null;
  }

  function validateBase(): FormErrors {
    const nextErrors: FormErrors = {};
    if (!selectedRepo) {
      nextErrors.repoId = "Choose a repository.";
    }
    if (!userName.trim()) {
      nextErrors.userName = "Enter who is working.";
    }
    if (!title.trim()) {
      nextErrors.title = "Name the work session.";
    }
    const effectiveTargets =
      targets.length > 0 ? targets : [createLockTarget(targetType, targetValue)];
    if (effectiveTargets.length === 0 || !effectiveTargets.some((target) => target.value.trim())) {
      nextErrors.targets = "Add at least one lock target.";
    }
    return nextErrors;
  }

  function addTarget() {
    const nextErrors = validateBase();
    delete nextErrors.targets;

    if (!targetValue.trim()) {
      nextErrors.targetValue = "Enter a target value.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setTargets((prev) => [...prev, createLockTarget(targetType, targetValue)]);
    setTargetValue("");
    setHasConfirmedOverlap(false);
  }

  function removeTarget(targetId: string) {
    setTargets((prev) => prev.filter((target) => target.id !== targetId));
    setHasConfirmedOverlap(false);
  }

  function submit() {
    const nextErrors = validateBase();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !sessionInput) {
      return;
    }

    if (overlaps.length > 0 && !hasConfirmedOverlap) {
      setHasConfirmedOverlap(true);
      return;
    }

    onCreate(sessionInput);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-lg border border-border bg-surface-1 shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Start Work
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Axiom prefills repo, branch, user, and a likely target from local changes.
            </p>
          </div>
          <button className={iconBtnClass} onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                Repo
              </span>
              <select
                className={fieldClass}
                value={repoId}
                onChange={(event) => {
                  const repo = repos.find((item) => item.id === event.target.value);
                  setRepoId(event.target.value);
                  setBranch(repo?.currentBranch ?? "");
                  const inferredTarget = inferTarget(repo ?? null, title);
                  setTargetType(inferredTarget.type);
                  setTargetValue(inferredTarget.value);
                  setTargets([inferredTarget]);
                  setTargetTouched(false);
                  setHasConfirmedOverlap(false);
                }}
              >
                {repos.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {getRepoDisplayName(repo)}
                  </option>
                ))}
              </select>
              {errors.repoId && (
                <p className="mt-1 text-xs text-status-locked">{errors.repoId}</p>
              )}
            </label>

          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                What are you working on?
              </span>
              <input
                className={fieldClass}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Sidebar polish"
              />
              {errors.title && (
                <p className="mt-1 text-xs text-status-locked">{errors.title}</p>
              )}
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                Suggested target
              </span>
              <input
                className={fieldClass}
                value={targets[0]?.value ?? targetValue}
                onChange={(event) => {
                  setTargetValue(event.target.value);
                  setTargets([createLockTarget(targetType, event.target.value)]);
                  setTargetTouched(true);
                }}
                placeholder="src/components or dashboard cards"
              />
              <p className="mt-1 text-xs text-text-muted">
                {formatTargetType(targets[0]?.type ?? targetType)}
              </p>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
              Notes
            </span>
            <textarea
              className={`${fieldClass} min-h-20 resize-none`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional coordination notes"
            />
          </label>

          <div className="rounded-lg border border-border bg-surface-0 p-4">
            <button
              className="flex w-full items-center justify-between text-left"
              onClick={() => setAdvancedOpen((open) => !open)}
            >
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Advanced fields
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  Edit user, branch, target type, or add extra targets.
                </p>
              </div>
              {advancedOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {advancedOpen && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                      User
                    </span>
                    <input
                      className={fieldClass}
                      value={userName}
                      onChange={(event) => setUserName(event.target.value)}
                      placeholder="Aidan or Riley"
                    />
                    {errors.userName && (
                      <p className="mt-1 text-xs text-status-locked">
                        {errors.userName}
                      </p>
                    )}
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                      Branch
                    </span>
                    <input
                      className={fieldClass}
                      value={branch}
                      onChange={(event) => setBranch(event.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-[150px_1fr_auto]">
                  <select
                    className={fieldClass}
                    value={targetType}
                    onChange={(event) => {
                    setTargetType(event.target.value as LockTarget["type"]);
                    setTargetTouched(true);
                    }}
                  >
                    <option value="area">Area</option>
                    <option value="folder">Folder</option>
                    <option value="file">File</option>
                  </select>
                  <div>
                    <input
                      className={fieldClass}
                      value={targetValue}
                      onChange={(event) => {
                        setTargetValue(event.target.value);
                        setTargetTouched(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addTarget();
                        }
                      }}
                      placeholder="src/components or dashboard cards"
                    />
                    {errors.targetValue && (
                      <p className="mt-1 text-xs text-status-locked">
                        {errors.targetValue}
                      </p>
                    )}
                  </div>
                  <button className={secondaryBtnClass} onClick={addTarget}>
                    <Plus size={14} />
                    Add
                  </button>
                </div>

                {errors.targets && (
                  <p className="mt-2 text-xs text-status-locked">
                    {errors.targets}
                  </p>
                )}

                {targets.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {targets.map((target) => (
                      <div
                        key={target.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-1 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                            {formatTargetType(target.type)}
                          </p>
                          <p className="truncate text-sm text-text-primary">
                            {target.value}
                          </p>
                        </div>
                        <button
                          className={iconBtnClass}
                          onClick={() => removeTarget(target.id)}
                          title="Remove target"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {overlaps.length > 0 && (
            <div className="rounded-lg border border-status-dirty/40 bg-status-dirty/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0 text-status-dirty"
                />
                <div>
                  <p className="text-sm font-medium text-status-dirty">
                    Overlap warning
                  </p>
                  <div className="mt-2 space-y-1">
                    {overlaps.map((overlap, index) => (
                      <p
                        key={`${overlap.sessionId}-${overlap.targetValue}-${index}`}
                        className="text-sm text-text-secondary"
                      >
                        {overlap.reason}: {overlap.targetValue} in{" "}
                        {overlap.sessionTitle}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button className={secondaryBtnClass} onClick={onClose}>
            Cancel
          </button>
          <button className={primaryBtnClass} onClick={submit}>
            {overlaps.length > 0 && !hasConfirmedOverlap
              ? "Review Warning"
              : overlaps.length > 0
                ? "Start Anyway"
              : "Start Work"}
          </button>
        </div>
      </div>
    </div>
  );
}
