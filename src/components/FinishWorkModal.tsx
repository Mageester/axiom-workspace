import { useState } from "react";
import { CheckCircle2, Clock, X } from "lucide-react";

interface FinishWorkModalProps {
  open: boolean;
  projectName: string;
  branch?: string;
  startedAt: string;
  onClose: () => void;
  onFinish: (summary?: string, details?: string) => void;
}

function durationLabel(startedAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (minutes < 1) return "< 1 minute";
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

export function FinishWorkModal({
  open,
  projectName,
  branch,
  startedAt,
  onClose,
  onFinish,
}: FinishWorkModalProps) {
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");

  if (!open) return null;

  function handleFinish() {
    onFinish(
      summary.trim() || undefined,
      details.trim() || undefined,
    );
    setSummary("");
    setDetails("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border/40 bg-surface-1 shadow-2xl overflow-hidden animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
          <h2 className="text-sm font-bold text-text-primary">Finish Work</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-2 transition">
            <X size={16} className="text-text-muted" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-2/30 border border-border/15">
            <CheckCircle2 size={18} className="text-status-clean shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-text-primary truncate">{projectName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {branch && <span className="text-[10px] text-text-muted">{branch}</span>}
                <span className="text-[10px] text-text-muted flex items-center gap-1">
                  <Clock size={9} />
                  {durationLabel(startedAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                What changed? <span className="text-text-muted/60 normal-case tracking-normal font-medium">optional</span>
              </label>
              <input
                className="w-full h-9 px-3 rounded-lg bg-surface-0 border border-border/40 focus:border-accent/40 text-xs text-text-primary outline-none transition-all placeholder:text-text-muted"
                placeholder="Updated homepage copy and fixed spacing"
                value={summary}
                onChange={e => setSummary(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleFinish(); }}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Anything the team should know? <span className="text-text-muted/60 normal-case tracking-normal font-medium">optional</span>
              </label>
              <textarea
                className="w-full h-16 px-3 py-2 rounded-lg bg-surface-0 border border-border/40 focus:border-accent/40 text-xs text-text-primary outline-none transition-all resize-none placeholder:text-text-muted"
                placeholder="Deployed to staging, looks good on mobile"
                value={details}
                onChange={e => setDetails(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              className="flex-1 h-10 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-all shadow-lg shadow-accent/15 active:scale-[0.98]"
              onClick={handleFinish}
            >
              Finish Work
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
