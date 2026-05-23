import { openUrl, revealItemInDir, openPath } from "@tauri-apps/plugin-opener";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import axiomMark from "/axiom-mark.png";
import type { DeviceIdentity, SetupChecklistItem, SetupStatus } from "../types";
import { GIT_FOR_WINDOWS_URL } from "../lib/sync";

interface OnboardingPageProps {
  identity: DeviceIdentity;
  checklist: SetupChecklistItem[];
  busy: boolean;
  message: string;
  error: string;
  onIdentityChange: (identity: DeviceIdentity) => void;
  onConnect: () => Promise<void>;
  onRecheck: () => Promise<void>;
}

const statusCopy: Record<SetupStatus, string> = {
  complete: "Done",
  missing: "Not found",
  needs_action: "Action needed",
  error: "Problem",
  checking: "Checking...",
};

function StatusIcon({ status }: { status: SetupStatus }) {
  if (status === "complete") {
    return <CheckCircle2 size={16} className="text-status-clean" />;
  }
  if (status === "checking") {
    return <Loader2 size={16} className="animate-spin text-accent" />;
  }
  return <AlertCircle size={16} className="text-status-dirty" />;
}

function statusClass(status: SetupStatus): string {
  if (status === "complete") return "bg-status-clean/10 text-status-clean border-status-clean/20";
  if (status === "checking") return "bg-accent/10 text-accent border-accent/20";
  if (status === "error") return "bg-status-locked/10 text-status-locked border-status-locked/20";
  return "bg-surface-2 text-text-muted border-border/40";
}

export function OnboardingPage({
  identity,
  checklist,
  busy,
  message,
  error,
  onIdentityChange,
  onConnect,
  onRecheck,
}: OnboardingPageProps) {
  const gitMissing = checklist.some(
    (item) => item.key === "git" && item.status === "missing",
  );

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-6">
      <main className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <img src={axiomMark} alt="Axiom" className="h-12 w-12 object-contain" />
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-text-primary tracking-tight">
              Axiom <span className="text-accent">Workspace</span>
            </h1>
            <p className="text-lg text-text-secondary leading-relaxed max-w-md">
              A premium coordination layer for elite engineering teams. Secure, local-first, and effortless.
            </p>
          </div>
          
          <div className="p-6 rounded-2xl border border-border/40 bg-surface-1/50 flex gap-4">
             <ShieldCheck className="text-status-clean shrink-0" size={24} />
             <div className="space-y-1">
                <p className="text-sm font-semibold text-text-primary">Source Code Privacy</p>
                <p className="text-xs text-text-muted leading-relaxed">
                  Only coordination metadata is shared. Your actual source code never leaves your machine.
                </p>
             </div>
          </div>
        </div>

        <div className="p-8 rounded-3xl border border-border/50 bg-surface-1 shadow-2xl space-y-8">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-text-primary">Connect Workspace</h2>
            <p className="text-sm text-text-muted">Set up your identity to start coordinating with the team.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Your Name</label>
               <input
                 className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-border/50 focus:border-accent/50 outline-none transition-all"
                 value={identity.userName}
                 onChange={(e) => onIdentityChange({ ...identity, userName: e.target.value })}
                 placeholder="Riley"
               />
             </div>
             <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Device Name</label>
               <input
                 className="w-full h-12 px-4 rounded-xl bg-surface-2 border border-border/50 focus:border-accent/50 outline-none transition-all"
                 value={identity.deviceName}
                 onChange={(e) => onIdentityChange({ ...identity, deviceName: e.target.value })}
                 placeholder="Riley Laptop"
               />
             </div>
          </div>

          <div className="space-y-3">
             {checklist.map(item => (
                <div key={item.key} className="flex items-center justify-between p-4 rounded-2xl bg-surface-2/50 border border-border/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusIcon status={item.status} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{item.label}</p>
                      <p className="text-[11px] text-text-muted truncate">{item.message}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg border ${statusClass(item.status)}`}>
                    {statusCopy[item.status]}
                  </span>
                </div>
             ))}
          </div>

          <div className="space-y-4 pt-4">
             <button
               className="w-full h-14 rounded-2xl bg-accent text-white font-bold hover:bg-accent-hover transition-all active:scale-[0.98] shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
               onClick={() => void onConnect()}
               disabled={busy}
             >
               {busy ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
               Connect to Team Workspace
             </button>
             
             <div className="flex items-center gap-2">
               <button
                 className="flex-1 h-12 rounded-xl bg-surface-2 text-text-primary text-xs font-bold hover:bg-surface-3 transition-all"
                 onClick={() => void onRecheck()}
                 disabled={busy}
               >
                 Re-check Prerequisites
               </button>
               {gitMissing && (
                 <button
                   className="flex-1 h-12 rounded-xl bg-surface-3 text-accent text-xs font-bold hover:bg-surface-4 transition-all"
                   onClick={() => void openUrl(GIT_FOR_WINDOWS_URL)}
                 >
                   Install Git
                 </button>
               )}
             </div>
          </div>

          {(message || error) && (
            <div className={`p-4 rounded-2xl text-xs font-medium border ${error ? "bg-status-locked/10 border-status-locked/20 text-status-locked" : "bg-status-clean/10 border-status-clean/20 text-status-clean"}`}>
               {message || error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
