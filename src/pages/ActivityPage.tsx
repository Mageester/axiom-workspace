import { Activity, AlertCircle, Clock, GitBranch, RefreshCw, Timer, Upload } from "lucide-react";
import type { RepoDiagnostics, SyncSettings, WorkspaceEvent } from "../types";
import { PageHeader } from "../components/PageHeader";

interface ActivityPageProps {
  events: WorkspaceEvent[];
  syncSettings: SyncSettings;
  repoDiagnostics: RepoDiagnostics;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)}s`;
}

function eventLabel(type: string): string {
  switch (type) {
    case "session_created": return "Session started";
    case "session_ended": return "Session ended";
    case "session_updated": return "Session updated";
    case "note_added": return "Note added";
    case "snapshot_created": return "Snapshot created";
    default: return type;
  }
}

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case "session_created": return <Timer size={14} className="text-status-clean" />;
    case "session_ended": return <Clock size={14} className="text-text-muted" />;
    case "session_updated": return <RefreshCw size={14} className="text-status-behind" />;
    default: return <Activity size={14} className="text-accent" />;
  }
}

function eventDetail(event: WorkspaceEvent): string {
  const payload = event.payload as Record<string, unknown> | null;
  if (!payload) return "";

  if (event.type === "session_created") {
    const session = payload.session as Record<string, unknown> | undefined;
    if (session && typeof session.title === "string" && typeof session.repoName === "string") {
      return `${session.title} in ${session.repoName}`;
    }
  }

  if (event.type === "session_ended") {
    const sessionId = payload.sessionId;
    if (typeof sessionId === "string") return sessionId.slice(0, 8);
  }

  return "";
}

export function ActivityPage({ events, syncSettings, repoDiagnostics }: ActivityPageProps) {
  const recentEvents = [...events]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);

  const lastSyncOk = syncSettings.lastSyncAt && !syncSettings.lastSyncError;
  const lastSyncFailed = Boolean(syncSettings.lastSyncError);

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        title="Activity"
        description="Recent events, syncs, and repo refreshes."
      />

      <main className="space-y-6 p-8">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Upload size={14} className={lastSyncFailed ? "text-status-locked" : lastSyncOk ? "text-status-clean" : "text-text-muted"} />
              <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Last Sync</h3>
            </div>
            {syncSettings.lastSyncAt ? (
              <div className="space-y-1.5">
                <p className="text-sm text-text-primary">{formatDateTime(syncSettings.lastSyncAt)}</p>
                {syncSettings.lastSyncDurationMs != null && (
                  <p className="text-xs text-text-muted">{formatDuration(syncSettings.lastSyncDurationMs)}</p>
                )}
                {syncSettings.lastSyncError && (
                  <p className="text-xs text-status-locked">{syncSettings.lastSyncError}</p>
                )}
                {syncSettings.lastSyncStatus && !syncSettings.lastSyncError && (
                  <p className="text-xs text-status-clean">{syncSettings.lastSyncStatus}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Not synced yet</p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch size={14} className="text-text-muted" />
              <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Last Repo Refresh</h3>
            </div>
            {repoDiagnostics.lastRefreshAt ? (
              <div className="space-y-1.5">
                <p className="text-sm text-text-primary">{repoDiagnostics.lastRefreshRepoPath ?? "Unknown"}</p>
                <p className="text-xs text-text-muted">
                  {formatDuration(repoDiagnostics.lastRefreshDurationMs)}
                  {repoDiagnostics.gitCommandCount != null && ` / ${repoDiagnostics.gitCommandCount} git commands`}
                </p>
                {repoDiagnostics.lastCommandError && (
                  <p className="text-xs text-status-locked">{repoDiagnostics.lastCommandError}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No refreshes yet</p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <div className="flex items-center gap-2 mb-3">
              {(syncSettings.lastSyncError || repoDiagnostics.lastCommandError) ? (
                <AlertCircle size={14} className="text-status-locked" />
              ) : (
                <AlertCircle size={14} className="text-text-muted" />
              )}
              <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Last Error</h3>
            </div>
            <p className="text-sm text-text-primary">
              {syncSettings.lastSyncCommandError || repoDiagnostics.lastCommandError || syncSettings.lastSyncError || "No recent errors"}
            </p>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium uppercase tracking-wider text-text-secondary">
              Event Timeline
            </h3>
            <span className="text-sm text-text-muted">{recentEvents.length} events</span>
          </div>

          {recentEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-sm text-text-muted">
                No events yet. Start a session or run Sync Now to create the first event.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface-1 overflow-hidden">
              {recentEvents.map((event, index) => (
                <div
                  key={event.id}
                  className={`flex items-start gap-4 px-5 py-3.5 ${index < recentEvents.length - 1 ? "border-b border-border" : ""}`}
                >
                  <div className="mt-0.5 shrink-0">
                    <EventIcon type={event.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-text-primary">
                        {eventLabel(event.type)}
                      </p>
                      <span className="shrink-0 text-xs text-text-muted">
                        {formatDateTime(event.createdAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span>{event.userName}</span>
                      {eventDetail(event) && (
                        <>
                          <span className="text-border">|</span>
                          <span className="truncate">{eventDetail(event)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
