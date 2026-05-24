import { useState } from "react";
import { GitBranch, Plus, X } from "lucide-react";

interface AddProjectModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, repoUrl: string, defaultBranch: string) => void;
}

function extractNameFromUrl(url: string): string {
  const match = url.match(/\/([^/]+?)(?:\.git)?$/);
  return match?.[1] || "";
}

function formatDisplayName(name: string): string {
  return name
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function AddProjectModal({ open, onClose, onAdd }: AddProjectModalProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("main");
  const [nameManual, setNameManual] = useState(false);

  if (!open) return null;

  function handleUrlChange(url: string) {
    setRepoUrl(url);
    if (!nameManual) {
      const extracted = extractNameFromUrl(url);
      setName(formatDisplayName(extracted));
    }
  }

  function handleSubmit() {
    if (!repoUrl.trim() || !name.trim()) return;
    onAdd(name.trim(), repoUrl.trim(), branch.trim() || "main");
    setRepoUrl("");
    setName("");
    setBranch("main");
    setNameManual(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border/40 bg-surface-1 shadow-2xl overflow-hidden animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
          <h2 className="text-sm font-bold text-text-primary">Add Project</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-2 transition">
            <X size={16} className="text-text-muted" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">GitHub URL</label>
            <input
              className="w-full h-9 px-3 rounded-lg bg-surface-0 border border-border/40 focus:border-accent/40 text-xs text-text-primary outline-none transition-all placeholder:text-text-muted font-mono"
              placeholder="https://github.com/org/repo"
              value={repoUrl}
              onChange={e => handleUrlChange(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Display Name</label>
              <input
                className="w-full h-9 px-3 rounded-lg bg-surface-0 border border-border/40 focus:border-accent/40 text-xs text-text-primary outline-none transition-all placeholder:text-text-muted"
                placeholder="Axiom Site"
                value={name}
                onChange={e => { setName(e.target.value); setNameManual(true); }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Default Branch</label>
              <div className="relative">
                <GitBranch size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  className="w-full h-9 pl-7 pr-3 rounded-lg bg-surface-0 border border-border/40 focus:border-accent/40 text-xs text-text-primary outline-none transition-all placeholder:text-text-muted"
                  placeholder="main"
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              className="flex-1 h-10 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-all shadow-lg shadow-accent/15 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={handleSubmit}
              disabled={!repoUrl.trim() || !name.trim()}
            >
              <Plus size={14} />
              Add Project
            </button>
            <button
              className="h-10 px-4 rounded-xl bg-surface-2 border border-border/40 text-xs font-semibold text-text-secondary hover:bg-surface-3 transition-all"
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
