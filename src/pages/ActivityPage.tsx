import { useMemo, useState } from "react";
import { Activity, AlertCircle, Clock, GitBranch, RefreshCw, Timer, Upload } from "lucide-react";
import type { RepoDiagnostics, SyncSettings, WorkspaceEvent, WorkspaceEventType } from "../types";
import type { HandoffNote } from "../types/workspace";
import { PageHeader } from "../components/PageHeader";
import { humanizeActivityEvent } from "../lib/activity";

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
  handoffNotes: HandoffNote[];
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function eventLabel(type: string): string {
  switch (type) {
    case "session_created": return "Work started";
    case "session_ended": return "Work finished";
    case "session_updated": return "Note edited";
    case "note_added": return "Note added";
    case "snapshot_created": return "Snapshot saved";
    case "sync_completed": return "Workspace synced";
    case "repo_refreshed": return "Repo refreshed";
    default: return type.replace(/_/g, " ");
  }
}

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case "session_created": return <Timer size={12} className="text-status-clean" />;
    case "session_ended": return <Clock size={12} className="text-text-muted" />;
    case "session_updated": return <RefreshCw size={12} className="text-status-behind" />;
    case "sync_completed": return <Upload size={12} className="text-status-clean" />;
    case "repo_refreshed": return <GitBranch size={12} className="text-accent" />;
    default: return <Activity size={12} className="text-accent" />;
  }
}

function isErrorEvent(event: WorkspaceEvent): boolean {
  const payload = event.payload as Record<string, unknown> | null;
  if (!payload) return false;
  return Boolean(payload.error) || Boolean(payload.lastCommandError);
}

export function ActivityPage({ events, syncSettings, repoDiagnostics, handoffNotes }: ActivityPageProps) {
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

    // Suppress consecutive automated sync events that clutter the view
    const deduplicated: WorkspaceEvent[] = [];
    let lastWasSync = false;
    for (const e of filtered) {
      const isSync = e.type === "sync_completed";
      if (isSync && lastWasSync) {
        continue;
      }
      deduplicated.push(e);
      lastWasSync = isSync;
    }

    return deduplicated.slice(0, 50);
  }, [sortedEvents, filter]);

  // Group events by human-friendly date labels
  const groupedEvents = useMemo(() => {
    const groups: { dateLabel: string; items: WorkspaceEvent[] }[] = [];
    filteredEvents.forEach((event) => {
      const date = new Date(event.createdAt);
      let label = "";
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        label = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        label = "Yesterday";
      } else {
        label = date.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        });
      }

      let group = groups.find((g) => g.dateLabel === label);
      if (!group) {
        group = { dateLabel: label, items: [] };
        groups.push(group);
      }
      group.items.push(event);
    });
    return groups;
  }, [filteredEvents]);

  return (
    <div className="flex-1 overflow-auto bg-surface-0">
      <PageHeader
        eyebrow="Timeline"
        title="Activity"
        description="A quiet history of what's been happening in the workspace."
      />

      {/* Narrower Readable content column: max-w-2xl */}
      <main className="max-w-2xl mx-auto p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-1 p-1 bg-surface-1 border border-border/20 rounded-xl w-fit">
          {(Object.keys(FILTER_LABELS) as ActivityFilter[]).map((key) => (
            <button
              key={key}
              className={`rounded-lg px-3.5 py-1 text-xs font-semibold transition-all ${
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

        {groupedEvents.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-border/20 rounded-2xl">
            <p className="text-xs text-text-muted">No activity found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedEvents.map((group) => (
              <div key={group.dateLabel} className="space-y-2.5">
                {/* Clean Uppercase Date Header */}
                <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-muted pl-2 border-l border-accent/60">
                  {group.dateLabel}
                </div>
                
                <div className="space-y-1.5 pl-2">
                  {group.items.map((event) => (
                    <div
                      key={event.id}
                      className="group flex items-center gap-3.5 p-2.5 rounded-xl border border-transparent hover:border-border/15 hover:bg-surface-1/30 transition-all"
                    >
                      <div className="shrink-0 w-7 h-7 rounded-full bg-surface-1/80 flex items-center justify-center border border-border/15">
                        <EventIcon type={event.type} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-text-primary truncate">
                          {humanizeActivityEvent(event)}
                        </p>
                        {event.type === "note_added" && (() => {
                          const handoff = (event.payload as { handoff?: { summary?: string } } | null)?.handoff;
                          return handoff?.summary ? (
                            <p className="mt-0.5 truncate text-[11px] text-text-secondary">Handoff: {handoff.summary}</p>
                          ) : null;
                        })()}
                        {/* Timestamps placed close inline with event info */}
                        <p className="text-[10px] text-text-muted mt-0.5 font-medium">
                          {eventLabel(event.type)} · {formatTime(event.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
