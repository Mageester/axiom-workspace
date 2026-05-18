import { useState, useEffect } from "react";
import { X, FolderOpen } from "lucide-react";
import {
  secondaryBtnClass,
  primaryBtnClass,
  iconBtnClass,
} from "../lib/constants";

interface AddRepoModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (path: string) => Promise<unknown>;
}

export function AddRepoModal({ open, onClose, onAdd }: AddRepoModalProps) {
  const [path, setPath] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPath("");
      setError("");
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = path.trim();
    if (!trimmed) {
      setError("Path is required");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await onAdd(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add repo");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="relative bg-surface-1 border border-border rounded-lg w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">
              Add Repository
            </h3>
          </div>
          <button onClick={onClose} className={iconBtnClass}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <label className="block text-xs text-text-secondary mb-2">
            Local repository path
          </label>
          <input
            type="text"
            value={path}
            onChange={(e) => {
              setPath(e.target.value);
              setError("");
            }}
            placeholder="C:\Users\you\projects\my-repo"
            className="w-full px-3 py-2 rounded-md text-sm bg-surface-0 text-text-primary border border-border focus:border-accent focus:outline-none placeholder:text-text-muted/50"
            autoFocus
            disabled={submitting}
          />

          {error && (
            <p className="mt-2 text-xs text-status-locked">{error}</p>
          )}

          <div className="flex justify-end gap-2 mt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className={secondaryBtnClass}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={primaryBtnClass}
            >
              {submitting ? "Adding…" : "Add Repo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
