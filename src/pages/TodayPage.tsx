import { useMemo, useState } from "react";
import {
  Clock,
  Play,
  RefreshCw,
  Users,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import type {
  LiveRepo,
  SetupState,
  SyncSettings,
  SyncStatus,
  WorkSession,
  WorkspaceEvent,
} from "../types";
import { StartSessionModal } from "../components/StartSessionModal";
import { primaryBtnClass, secondaryBtnClass, iconBtnClass } from "../lib/constants";
import type { CreateSessionInput } from "../lib/sessions";
import { getSystemJudgment } from "../lib/intelligence";

interface TodayPageProps {
  repos: LiveRepo[];
  activeSessions: WorkSession[];
  recentEvents: WorkspaceEvent[];
  defaultUserName: string;
  setupState: SetupState;
  syncSettings: SyncSettings;
  syncStatus: SyncStatus;
  loading: boolean;
  onSyncNow: () => Promise<void>;
  onStartSession: (input: CreateSessionInput) => void;
  onFinishSession: (sessionId: string, endNote?: string) => void;
  onNavigate: (page: any) => void;
}

function timeAgo(value?: string): string {
  if (!value) return "never";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function durationLabel(startedAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (minutes < 1) return "< 1m";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function TodayPage({
  repos,
  activeSessions,
  recentEvents,
  defaultUserName,
  setupState,
  syncSettings,
  syncStatus,
  loading,
  onSyncNow,
  onStartSession,
  onFinishSession,
  onNavigate,
}: TodayPageProps) {
  const [startModalOpen, setStartModalOpen] = useState(false);

  const myActiveSession = useMemo(
    () => activeSessions.find(s => s.userName.toLowerCase() === defaultUserName.toLowerCase()),
    [activeSessions, defaultUserName]
  );

  const teammates = useMemo(() => {
    const others = activeSessions.filter(s => s.userName.toLowerCase() !== defaultUserName.toLowerCase());
    // Dedupe by username
    const unique = new Map<string, WorkSession>();
    others.forEach(s => {
      if (!unique.has(s.userName.toLowerCase())) {
        unique.set(s.userName.toLowerCase(), s);
      }
    });
    return Array.from(unique.values());
  }, [activeSessions, defaultUserName]);

  const systemJudgment = useMemo(() => getSystemJudgment(repos), [repos]);
  const syncing = syncStatus !== "idle" && syncStatus !== "complete" && syncStatus !== "error";

  const healthStatus = useMemo(() => {
    if (repos.length === 0) return { label: "No repos tracked", color: "text-text-muted" };
    if (systemJudgment.needsReviewCount > 0) return { label: `${systemJudgment.needsReviewCount} issues found`, color: "text-status-dirty" };
    return { label: "Workspace clear", color: "text-status-clean" };
  }, [repos.length, systemJudgment.needsReviewCount]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-0">
      <main className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full px-8 py-12">
        <div className="w-full space-y-16">
          {/* Main Status Section */}
          <div className="text-center space-y-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-hover opacity-80">
              Axiom Workspace
            </p>
            
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-text-primary">
                {myActiveSession ? (
                  <>You are working on <span className="text-accent-hover">{myActiveSession.repoName}</span></>
                ) : (
                  "You are not working"
                )}
              </h1>
              {myActiveSession && (
                <p className="text-lg text-text-secondary">
                  {myActiveSession.branch || "main"} · {durationLabel(myActiveSession.startedAt)}
                </p>
              )}
            </div>

            <div className="pt-4">
              {myActiveSession ? (
                <button
                  className="h-14 px-10 rounded-full bg-surface-2 border border-border/50 text-text-primary font-medium hover:bg-surface-3 transition-all shadow-sm active:scale-95"
                  onClick={() => onFinishSession(myActiveSession.id)}
                >
                  Finish Work
                </button>
              ) : (
                <button
                  className="h-14 px-10 rounded-full bg-accent text-white font-semibold hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 active:scale-95 flex items-center gap-3 mx-auto"
                  onClick={() => setStartModalOpen(true)}
                  disabled={repos.length === 0}
                >
                  <Play size={18} fill="currentColor" />
                  Start Work
                </button>
              )}
            </div>
          </div>

          {/* Teammates Section */}
          <div className="space-y-6">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted text-center">
              Teammates
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teammates.length > 0 ? (
                teammates.map(session => (
                  <div key={session.id} className="group p-5 rounded-2xl border border-border/50 bg-surface-1/50 flex items-center justify-between transition-all hover:bg-surface-1 hover:border-border">
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">{session.userName} is working on {session.repoName}</p>
                      <p className="text-sm text-text-secondary mt-1 truncate">{session.branch || "main"} · {durationLabel(session.startedAt)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="md:col-span-2 py-8 rounded-2xl border border-dashed border-border/50 flex flex-col items-center justify-center text-text-muted">
                  <Users size={20} className="mb-2 opacity-50" />
                  <p className="text-sm">Riley is not active</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer Status */}
          <div className="pt-8 border-t border-border/30 flex flex-wrap items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className={healthStatus.color} />
                <span className={`text-sm font-medium ${healthStatus.color}`}>{healthStatus.label}</span>
              </div>
              <div className="flex items-center gap-2 text-text-muted">
                <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                <span className="text-sm">Synced {timeAgo(syncSettings.lastSyncAt)}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
               {systemJudgment.needsReviewCount > 0 && (
                 <button 
                  onClick={() => onNavigate("projects")}
                  className="text-sm font-medium text-accent-hover hover:underline flex items-center gap-1"
                 >
                   View Details
                   <ArrowRight size={14} />
                 </button>
               )}
               <button
                className="p-2 rounded-lg hover:bg-surface-2 text-text-muted transition-colors"
                onClick={() => void onSyncNow()}
                disabled={syncing || !setupState.setupComplete}
                title="Sync Now"
               >
                 {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
               </button>
            </div>
          </div>
        </div>
      </main>

      <StartSessionModal
        open={startModalOpen}
        repos={repos}
        activeSessions={activeSessions}
        initialRepo={null}
        defaultUserName={defaultUserName}
        onClose={() => setStartModalOpen(false)}
        onCreate={(input) => {
          onStartSession(input);
          setStartModalOpen(false);
        }}
      />
    </div>
  );
}
