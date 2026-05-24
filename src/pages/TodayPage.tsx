import { useMemo, useState } from "react";
import {
  Clock,
  GitBranch,
  Loader2,
  Play,
  RefreshCw,
  Square,
  Users,
} from "lucide-react";
import type {
  LiveRepo,
  SyncSettings,
  SyncStatus,
  WorkSession,
  WorkspaceEvent,
} from "../types";
import type { AttentionItem, RegisteredProject } from "../types/workspace";
import type { SyncModeInfo } from "../lib/sync-mode";
import { StartSessionModal } from "../components/StartSessionModal";
import { FinishWorkModal } from "../components/FinishWorkModal";
import { NeedsAttention } from "../components/NeedsAttention";
import { computeAttentionItems } from "../lib/attention";
import type { CreateSessionInput } from "../lib/sessions";
import { humanizeActivityEvent } from "../lib/activity";
import { normalizeDisplayName, samePerson } from "../lib/identity";
import { formatChangedFiles } from "../lib/project-status";

interface TodayPageProps {
  repos: LiveRepo[];
  activeSessions: WorkSession[];
  recentEvents: WorkspaceEvent[];
  defaultUserName: string;
  syncSettings: SyncSettings;
  syncInfo: SyncModeInfo;
  syncStatus: SyncStatus;
  loading: boolean;
  registeredProjects: RegisteredProject[];
  cloudSyncUnavailable: boolean;
  onSyncNow: () => Promise<void>;
  onStartSession: (input: CreateSessionInput) => void;
  onFinishSession: (sessionId: string, summary?: string, details?: string) => void;
  onNavigate: (page: any) => void;
}

function timeAgo(value?: string): string {
  if (!value) return "never";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
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
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function TodayPage({
  repos,
  activeSessions,
  recentEvents,
  defaultUserName,
  syncSettings,
  syncInfo,
  syncStatus,
  loading,
  registeredProjects,
  cloudSyncUnavailable,
  onSyncNow,
  onStartSession,
  onFinishSession,
  onNavigate,
}: TodayPageProps) {
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [finishModalOpen, setFinishModalOpen] = useState(false);

  const myActiveSession = useMemo(
    () => activeSessions.find(s => samePerson(s.userName, defaultUserName)),
    [activeSessions, defaultUserName],
  );

  const teammates = useMemo(() => {
    const others = activeSessions.filter(s => !samePerson(s.userName, defaultUserName));
    const groups = new Map<string, WorkSession[]>();
    others.forEach(s => {
      const norm = normalizeDisplayName(s.userName);
      const existing = groups.get(norm) || [];
      existing.push(s);
      groups.set(norm, existing);
    });
    return Array.from(groups.entries()).map(([name, sessions]) => ({ name, sessions }));
  }, [activeSessions, defaultUserName]);

  const attentionItems = useMemo(
    () => computeAttentionItems(repos, activeSessions, defaultUserName, registeredProjects, syncSettings, cloudSyncUnavailable),
    [repos, activeSessions, defaultUserName, registeredProjects, syncSettings, cloudSyncUnavailable],
  );

  const syncing = syncStatus !== "idle" && syncStatus !== "complete" && syncStatus !== "error";
  const hasProjects = repos.length > 0 || registeredProjects.length > 0;

  const recentImportant = useMemo(() => {
    return [...recentEvents]
      .filter(e => e.type === "session_created" || e.type === "session_ended")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3);
  }, [recentEvents]);

  const myRepo = useMemo(() => {
    if (!myActiveSession) return null;
    return repos.find(r => r.id === myActiveSession.repoId) ?? null;
  }, [myActiveSession, repos]);

  return (
    <div className="flex-1 overflow-auto bg-surface-0">
      <div className="max-w-2xl mx-auto p-5 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Today</p>
            <h1 className="text-lg font-bold text-text-primary mt-1 tracking-tight">
              {myActiveSession ? "You are working" : "Ready to start"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${syncing ? "bg-status-behind animate-pulse" : syncStatus === "error" ? "bg-status-locked" : "bg-status-clean"}`} />
              <span className="text-[10px] font-medium text-text-muted">
                {syncing ? "Syncing" : syncInfo.label}
                <span className="text-text-muted/70"> · {syncInfo.detail}</span>
              </span>
            </div>
            <button
              className="p-1.5 rounded-lg hover:bg-surface-2 text-text-muted transition-colors"
              onClick={() => void onSyncNow()}
              disabled={syncing}
            >
              {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
          </div>
        </div>

        {/* Current Work Card */}
        {myActiveSession ? (
          <div className="p-4 rounded-2xl border border-accent/20 bg-accent/5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1.5">Current Work</p>
                <h2 className="text-base font-bold text-text-primary truncate">
                  {myActiveSession.repoName}
                </h2>
                <div className="flex items-center gap-3 mt-1.5 text-text-muted">
                  <span className="flex items-center gap-1 text-[11px] font-medium">
                    <GitBranch size={11} />
                    {myActiveSession.branch || "main"}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-medium">
                    <Clock size={11} />
                    {durationLabel(myActiveSession.startedAt)}
                  </span>
                  {myRepo && myRepo.changedFileCount > 0 && (
                    <span className="text-[11px] font-medium text-status-dirty">
                      {formatChangedFiles(myRepo.changedFileCount)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              className="h-10 px-6 rounded-xl bg-surface-2 border border-border/40 text-xs font-bold text-text-primary hover:bg-surface-3 transition-all active:scale-[0.98] flex items-center gap-2"
              onClick={() => setFinishModalOpen(true)}
            >
              <Square size={12} fill="currentColor" />
              Finish Work
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl border border-border/20 bg-surface-1/40 space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Current Work</p>
              <p className="text-sm text-text-secondary">
                {hasProjects ? "No active session. Pick a project to start working." : "Workspace clear. Add a project when you are ready."}
              </p>
            </div>
            <button
              className="h-10 px-6 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-all shadow-lg shadow-accent/15 active:scale-[0.98] flex items-center gap-2"
              onClick={() => setStartModalOpen(true)}
              disabled={repos.length === 0}
            >
              <Play size={12} fill="currentColor" />
              Start Work
            </button>
          </div>
        )}

        {/* Team Card */}
        <div className="p-3.5 rounded-2xl border border-border/20 bg-surface-1/40 space-y-2.5">
          <div className="flex items-center gap-2">
            <Users size={13} className="text-text-muted" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Team</p>
          </div>
          {teammates.length > 0 ? (
            <div className="space-y-2">
              {teammates.map(t => (
                <div key={t.name} className="flex items-center justify-between p-2.5 rounded-xl bg-surface-2/20 border border-border/15">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-text-primary">{t.name}</p>
                    <p className="text-[11px] text-text-secondary mt-0.5 truncate">
                      {t.sessions.length === 1
                        ? <>Working on <span className="font-semibold text-text-primary">{t.sessions[0].repoName}</span></>
                        : `${t.sessions.length} active sessions on ${t.sessions[0].repoName}`}
                    </p>
                  </div>
                  <span className="text-[10px] text-text-muted tabular-nums shrink-0 ml-3">
                    {durationLabel(t.sessions[0].startedAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted py-2">No teammates active</p>
          )}
        </div>

        {/* Needs Attention */}
        {attentionItems.length > 0 ? (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Needs Attention</p>
            <NeedsAttention
              items={attentionItems}
              onAction={(item) => {
                if (item.projectId) onNavigate("projects");
              }}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-border/15 bg-surface-1/25 px-3 py-2.5">
            <p className="text-xs font-semibold text-text-secondary">Workspace clear</p>
          </div>
        )}

        {/* Recent Activity */}
        {recentImportant.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Recent Activity</p>
              <button
                className="text-[10px] font-bold text-accent hover:text-accent-hover transition-colors"
                onClick={() => onNavigate("activity")}
              >
                View All
              </button>
            </div>
            <div className="space-y-1">
              {recentImportant.map(event => (
                <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-1/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-text-secondary truncate">
                      {humanizeActivityEvent(event)}
                    </p>
                  </div>
                  <span className="text-[10px] text-text-muted shrink-0">{timeAgo(event.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <StartSessionModal
        open={startModalOpen}
        repos={repos}
        activeSessions={activeSessions}
        initialRepo={null}
        defaultUserName={defaultUserName}
        onClose={() => setStartModalOpen(false)}
        onCreate={(input) => { onStartSession(input); setStartModalOpen(false); }}
      />

      {myActiveSession && (
        <FinishWorkModal
          open={finishModalOpen}
          projectName={myActiveSession.repoName}
          branch={myActiveSession.branch}
          startedAt={myActiveSession.startedAt}
          onClose={() => setFinishModalOpen(false)}
          onFinish={(summary, details) => {
            const endNote = [summary, details].filter(Boolean).join("\n\n");
            onFinishSession(myActiveSession.id, summary, details);
            setFinishModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
