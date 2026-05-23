import { useMemo, useState } from "react";
import { Activity, AlertCircle, Clock, GitBranch, RefreshCw, Timer, Upload } from "lucide-react";
import type { RepoDiagnostics, SyncSettings, WorkspaceEvent, WorkspaceEventType } from "../types";
import { PageHeader } from "../components/PageHeader";

type ActivityFilter = "all" | "sessions" | "sync" | "repos" | "errors";

const SESSION_TYPES: WorkspaceEventType[] = ["session_created", "session_ended", "session_updated"];
const SYNC_TYPES: WorkspaceEventType[] = ["sync_completed", "snapshot_created", "note_added"];
const REPO_TYPES: WorkspaceEventType[] = ["repo_refreshed"];

const FILTER_LABELS: Record<ActivityFilter, string> = {
  all: "All",
  sessions: "Work",
  sync: "Sync",
  repos: "Repos",
  errors: "Errors",
};

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
    case "session_created": return "Work started";
    case "session_ended": return "Work finished";
    case "session_updated": return "Note edited";
    case "note_added": return "Note added";
    case "snapshot_created": return "Snapshot saved";
    case "sync_completed": return "Sync completed";
    case "repo_refreshed": return "Repo refreshed";
    default: return type;
  }
}

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case "session_created": return <Timer size={14} className="text-status-clean" />;
    case "session_ended": return <Clock size={14} className="text-text-muted" />;
    case "session_updated": return <RefreshCw size={14} className="text-status-behind" />;
    case "sync_completed": return <Upload size={14} className="text-status-clean" />;
    case "repo_refreshed": return <GitBranch size={14} className="text-accent" />;
    default: return <Activity size={14} className="text-accent" />;
  }
}

function isErrorEvent(event: WorkspaceEvent): boolean {
  const payload = event.payload as Record<string, unknown> | null;
  if (!payload) return false;
  return Boolean(payload.error) || Boolean(payload.lastCommandError);
}

function eventDescription(event: WorkspaceEvent): string {
  const payload = event.payload as Record<string, unknown> | null;
  if (!payload) return event.type;

  switch (event.type) {
    case "session_created": {
      const session = payload.session as Record<string, unknown> | undefined;
      return `Started work on ${session?.repoName || "a project"}`;
    }
    case "session_ended": {
      return payload.endNote ? `Finished work — ${payload.endNote}` : "Finished work";
    }
    case "sync_completed":
      return "Workspace synced successfully";
    case "repo_refreshed": {
      const path = payload.repoPath as string | undefined;
      return path === "all" ? "Refreshed all projects" : `Refreshed ${path}`;
    }
    default:
      return event.type.replace(/_/g, " ");
  }
}

export function ActivityPage({ events, syncSettings, repoDiagnostics }: ActivityPageProps) {
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [events],
  );

  const filteredEvents = useMemo(() => {
    let filtered = sortedEvents;
    switch (filter) {
      case "sessions":
        filtered = sortedEvents.filter((e) => SESSION_TYPES.includes(e.type));
        break;
      case "sync":
        filtered = sortedEvents.filter((e) => SYNC_TYPES.includes(e.type));
        break;
      case "repos":
        filtered = sortedEvents.filter((e) => REPO_TYPES.includes(e.type));
        break;
      case "errors":
        filtered = sortedEvents.filter(isErrorEvent);
        break;
    }
    return filtered.slice(0, 50);
  }, [sortedEvents, filter]);

  return (
    <div className="flex-1 overflow-auto bg-surface-0">
      <PageHeader
        eyebrow="Timeline"
        title="Activity"
        description="A quiet history of what's been happening in the workspace."
      />

      <main className="max-w-4xl mx-auto p-8 space-y-8">
        <div className="flex items-center gap-1 p-1 bg-surface-1 border border-border/50 rounded-xl w-fit">
          {(Object.keys(FILTER_LABELS) as ActivityFilter[]).map((key) => (
            <button
              key={key}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
                filter === key
                  ? "bg-surface-3 text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
              onClick={() => setFilter(key)}
            >
              {FILTER_LABELS[key]}
            </button>
          ))}
        </div>

        {filteredEvents.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-text-muted">No activity found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event, index) => (
              <div
                key={event.id}
                className="group flex items-center justify-between gap-6 p-4 rounded-2xl border border-transparent hover:border-border/50 hover:bg-surface-1/50 transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-surface-1 flex items-center justify-center border border-border/50">
                    <EventIcon type={event.type} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {event.userName} {eventDescription(event)}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {eventLabel(event.type)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-text-muted font-medium">
                  {formatDateTime(event.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
