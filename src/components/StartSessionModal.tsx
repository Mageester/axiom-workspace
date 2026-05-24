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
    if (!open) return;
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
  }, [open, initialRepo, repos, defaultUserName, initialTitle, initialNotes, initialTargets]);

  const selectedRepo = useMemo(() => repos.find(r => r.id === repoId) ?? null, [repos, repoId]);

  useEffect(() => {
    if (!open || targetTouched || !selectedRepo) return;
    const inferredTarget = inferTarget(selectedRepo, title);
    setTargetType(inferredTarget.type);
    setTargetValue(inferredTarget.value);
    setTargets([inferredTarget]);
  }, [open, selectedRepo, targetTouched, title]);

  const sessionInput = useMemo<CreateSessionInput | null>(() => {
    if (!selectedRepo) return null;
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
  }, [selectedRepo, userName, title, notes, branch, targets]);

  const overlaps = useMemo(() => sessionInput ? detectSessionOverlap(sessionInput, activeSessions) : [], [activeSessions, sessionInput]);

  if (!open) return null;

  function submit() {
    const nextErrors: FormErrors = {};
    if (!selectedRepo) nextErrors.repoId = "Choose a repository.";
    if (!title.trim()) nextErrors.title = "Name the work session.";
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !sessionInput) return;
    if (overlaps.length > 0 && !hasConfirmedOverlap) {
      setHasConfirmedOverlap(true);
      return;
    }
    onCreate(sessionInput);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md">
      <div className="w-full max-w-xl rounded-3xl border border-border/50 bg-surface-1 shadow-2xl overflow-hidden">
        <div className="px-8 py-6 border-b border-border/30 flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary">Start Work</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-2 rounded-full transition-colors text-text-muted">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Project</label>
              <select
                className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-border/50 focus:border-accent/50 outline-none transition-all"
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
              >
                {repos.map(r => (
                  <option key={r.id} value={r.id}>{getRepoDisplayName(r)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Work Title</label>
              <input
                className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-border/50 focus:border-accent/50 outline-none transition-all"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What are you doing? e.g. 'Fix login bug'"
              />
              {errors.title && <p className="text-xs text-status-locked mt-1">{errors.title}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-text-muted">Target Area</label>
              <input
                className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-border/50 focus:border-accent/50 outline-none transition-all font-mono text-sm"
                value={targets[0]?.value || ""}
                onChange={(e) => {
                   setTargetTouched(true);
                   setTargets([createLockTarget(targetType, e.target.value)]);
                }}
                placeholder="e.g. src/components"
              />
            </div>
          </div>

          {overlaps.length > 0 && (
            <div className="p-4 rounded-2xl bg-status-dirty/10 border border-status-dirty/20 flex gap-3">
              <AlertTriangle className="text-status-dirty shrink-0" size={18} />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-status-dirty">Potential Overlap</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Teammates are already active in similar areas. Review before starting.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-4">
            <button
              className="flex-1 h-14 rounded-2xl bg-accent text-white font-bold hover:bg-accent-hover transition-all active:scale-[0.98] shadow-lg shadow-accent/20"
              onClick={submit}
            >
              {overlaps.length > 0 && !hasConfirmedOverlap ? "Review overlap" : "Start Work"}
            </button>
            <button
              className="h-14 px-6 rounded-2xl bg-surface-2 text-text-primary font-bold hover:bg-surface-3 transition-all"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
