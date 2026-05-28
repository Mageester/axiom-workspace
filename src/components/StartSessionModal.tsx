import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import type { LiveRepo, LockTarget, SessionOverlap, WorkSession } from "../types";
import {
  createLockTarget,
  detectSessionOverlap,
  type CreateSessionInput,
} from "../lib/sessions";
import { fieldClass, iconBtnClass, labelClass, primaryBtnClass, secondaryBtnClass } from "../lib/constants";
import { getRepoDisplayName } from "../lib/repos";

interface StartSessionModalProps {
  open: boolean;
  repos: LiveRepo[];
  activeSessions: WorkSession[];
  initialRepo?: LiveRepo | null;
  initialTitle?: string;
  initialNotes?: string;
  initialTargets?: LockTarget[];
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

function formatTargetType(type: LockTarget["type"]): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function overlapSeverityLabel(severity: SessionOverlap["severity"]): string {
  switch (severity) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    default:
      return "Medium";
  }
}

function overlapSeverityClass(severity: SessionOverlap["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-status-locked/30 bg-status-locked/15 text-status-locked";
    case "high":
      return "border-status-dirty/30 bg-status-dirty/15 text-status-dirty";
    default:
      return "border-status-behind/30 bg-status-behind/15 text-status-behind";
  }
}

export function StartSessionModal({
  open,
  repos,
  activeSessions,
  initialRepo,
  initialTitle,
  initialNotes,
  initialTargets,
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
    const inferredTarget = inferTarget(repo, initialTitle ?? "");
    setRepoId(repo?.id ?? "");
    setBranch(repo?.currentBranch ?? "");
    setUserName(defaultUserName);
    setTitle(initialTitle ?? "");
    setNotes(initialNotes ?? "");
    setTargetType(inferredTarget.type);
    setTargetValue(initialTargets?.[0]?.value ?? inferredTarget.value);
    setTargets(initialTargets && initialTargets.length > 0 ? initialTargets : [inferredTarget]);
    setAdvancedOpen(false);
    setTargetTouched(Boolean(initialTargets?.length));
  }, [defaultUserName, initialNotes, initialRepo, initialTargets, initialTitle, open, repos]);

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
      nextErrors.targets = "Add at least one file or area you're working on.";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-border/90 bg-surface-1 shadow-[0_28px_100px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between border-b border-border/80 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-hover">
              Claim work
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-text-primary">
              Start Work
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Tell Aidan and Riley what repo area you are about to touch.
            </p>
          </div>
          <button className={iconBtnClass} onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className={labelClass}>
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
              <span className={labelClass}>
                What are you working on?
              </span>
              <input
                className={fieldClass}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Homepage hero, Pipeline auth, Contact form"
              />
              {errors.title && (
                <p className="mt-1 text-xs text-status-locked">{errors.title}</p>
              )}
            </label>

            <label className="block">
              <span className={labelClass}>
                Area or file
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
                Claim type: {formatTargetType(targets[0]?.type ?? targetType)}
              </p>
            </label>
          </div>

          <label className="block">
            <span className={labelClass}>
              Optional note
            </span>
            <textarea
              className={`${fieldClass} min-h-20 resize-none`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Anything the team should know?"
            />
          </label>

          <div className="rounded-xl border border-border/80 bg-surface-0/70 p-4">
            <button
              className="flex w-full items-center justify-between text-left"
              onClick={() => setAdvancedOpen((open) => !open)}
            >
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Advanced
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                    Change user, branch, claim type, or add more claimed areas.
                </p>
              </div>
              {advancedOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {advancedOpen && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>
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
                    <span className={labelClass}>
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
                      const nextType = event.target.value as LockTarget["type"];
                      setTargetType(nextType);
                      setTargets([createLockTarget(nextType, targetValue)]);
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
            <div className="rounded-xl border border-status-dirty/40 bg-status-dirty/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0 text-status-dirty"
                />
                <div>
                  <p className="text-sm font-medium text-status-dirty">
                    This overlaps active work
                  </p>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    Review this before starting. Axiom will not block you, but the team should know if two people touch the same area.
                  </p>
                  <div className="mt-2 space-y-1">
                    {overlaps.map((overlap, index) => (
                      <div
                        key={`${overlap.sessionId}-${overlap.targetValue}-${index}`}
                        className="flex flex-wrap items-start gap-2 text-sm text-text-secondary"
                      >
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${overlapSeverityClass(overlap.severity)}`}
                        >
                          {overlapSeverityLabel(overlap.severity)}
                        </span>
                        <span>
                          {overlap.reason}: {overlap.targetValue} in{" "}
                          {overlap.sessionTitle}
                        </span>
                      </div>
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
