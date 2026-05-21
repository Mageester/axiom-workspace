import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  GitBranch,
  Lock,
  Pencil,
  Timer,
  TimerOff,
  X,
} from "lucide-react";
import type { SessionOverlap, WorkSession } from "../types";
import { PageHeader } from "../components/PageHeader";
import { LockInventory } from "../components/LockInventory";
import { fieldClass, iconBtnClass, labelClass, primaryBtnClass, secondaryBtnClass } from "../lib/constants";
import { detectSessionOverlap, type CreateSessionInput } from "../lib/sessions";

function formatDuration(startedAt: string, endedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return "< 1m";
}

interface SessionsPageProps {
  activeSessions: WorkSession[];
  recentEndedSessions: WorkSession[];
  onEndSession: (sessionId: string, endNote?: string) => void;
  onUpdateNotes: (sessionId: string, notes: string) => void;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function overlapSeverityLabel(severity: SessionOverlap["severity"]): string {
  switch (severity) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    default:
      return "Medium";
  }
}

function overlapSeverityClass(severity: SessionOverlap["severity"]): string {
  switch (severity) {
    case "critical":
      return "border-status-locked/30 bg-status-locked/15 text-status-locked";
    case "high":
      return "border-status-dirty/30 bg-status-dirty/15 text-status-dirty";
    default:
      return "border-status-behind/30 bg-status-behind/15 text-status-behind";
  }
}

function getSessionOverlaps(
  session: WorkSession,
  activeSessions: WorkSession[],
): SessionOverlap[] {
  const input: CreateSessionInput = {
    repoId: session.repoId,
    repoName: session.repoName,
    repoPath: session.repoPath,
    userName: session.userName,
    title: session.title,
    notes: session.notes,
    branch: session.branch,
    targets: session.targets,
  };

  return detectSessionOverlap(
    input,
    activeSessions.filter((active) => active.id !== session.id),
  );
}

function AreaList({ session }: { session: WorkSession }) {
  return (
    <div className="flex flex-wrap gap-2">
      {session.targets.map((target) => (
        <span
          key={target.id}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-text-secondary"
        >
          <Lock size={11} />
          <span className="uppercase text-text-muted">{target.type}</span>
          <span className="max-w-56 truncate text-text-primary">
            {target.label ?? target.value}
          </span>
        </span>
      ))}
    </div>
  );
}

function ActiveWorkCard({
  session,
  overlaps,
  onEndSession,
  onUpdateNotes,
}: {
  session: WorkSession;
  overlaps: SessionOverlap[];
  onEndSession: (sessionId: string, endNote?: string) => void;
  onUpdateNotes: (sessionId: string, notes: string) => void;
}) {
  const [finishing, setFinishing] = useState(false);
  const [changedNote, setChangedNote] = useState("");
  const [handoffNote, setHandoffNote] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(session.notes ?? "");

  function confirmFinish() {
    const parts: string[] = [];
    if (changedNote.trim()) parts.push(`Changed: ${changedNote.trim()}`);
    if (handoffNote.trim()) parts.push(`Handoff: ${handoffNote.trim()}`);
    onEndSession(session.id, parts.join("\n") || undefined);
    setFinishing(false);
    setChangedNote("");
    setHandoffNote("");
  }

  return (
    <article className="rounded-xl border border-border/80 bg-surface-1/80 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {session.repoName}
          </p>
          <h3 className="mt-1 truncate text-base font-semibold text-text-primary">
            {session.title}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">{session.userName}</p>
        </div>
        {!finishing && (
          <button
            className={secondaryBtnClass}
            onClick={() => setFinishing(true)}
          >
            <TimerOff size={14} />
            Finish Work
          </button>
        )}
      </div>

      {finishing && (
        <div className="mt-4 space-y-3 rounded-xl border border-accent/30 bg-accent/10 p-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Finish &ldquo;{session.title}&rdquo;
            </p>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Releases claimed areas and queues a sync so the team sees that this work is done.
            </p>
          </div>
          <label className="block">
            <span className={labelClass}>
              What changed?
            </span>
            <textarea
              className={`${fieldClass} mt-1 min-h-16 resize-none`}
              rows={2}
              placeholder="Optional — summary of what you did"
              value={changedNote}
              onChange={(e) => setChangedNote(e.target.value)}
            />
          </label>
          <label className="block">
            <span className={labelClass}>
              Handoff note
            </span>
            <textarea
              className={`${fieldClass} mt-1 min-h-16 resize-none`}
              rows={2}
              placeholder="Optional — anything Aidan or Riley should know next"
              value={handoffNote}
              onChange={(e) => setHandoffNote(e.target.value)}
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              className={primaryBtnClass}
              onClick={confirmFinish}
            >
              Finish Work
            </button>
            <button
              className={secondaryBtnClass}
              onClick={() => {
                setFinishing(false);
                setChangedNote("");
                setHandoffNote("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4">
        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              className="w-full rounded border border-border bg-surface-0 px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted outline-none resize-none"
              rows={3}
              placeholder="Notes..."
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
            />
            <div className="flex items-center gap-1">
              <button
                className={iconBtnClass}
                title="Save notes"
                onClick={() => {
                  onUpdateNotes(session.id, notesValue);
                  setEditingNotes(false);
                }}
              >
                <Check size={14} />
              </button>
              <button
                className={iconBtnClass}
                title="Cancel"
                onClick={() => { setNotesValue(session.notes ?? ""); setEditingNotes(false); }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            {session.notes ? (
              <p className="text-sm leading-6 text-text-secondary flex-1">
                {session.notes}
              </p>
            ) : (
              <p className="text-sm text-text-muted italic flex-1">No notes</p>
            )}
            <button
              className={`${iconBtnClass} shrink-0`}
              title="Edit notes"
              onClick={() => { setNotesValue(session.notes ?? ""); setEditingNotes(true); }}
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-text-muted">
        {session.branch && (
          <span className="inline-flex items-center gap-1.5">
            <GitBranch size={12} />
            {session.branch}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Clock size={12} />
          Started {formatDateTime(session.startedAt)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-accent">
          <Timer size={12} />
          {formatDuration(session.startedAt)}
        </span>
      </div>

      <div className="mt-4">
        <AreaList session={session} />
      </div>

      {overlaps.length > 0 && (
        <div className="mt-4 rounded-md border border-status-dirty/30 bg-status-dirty/10 px-3 py-2">
          <div className="flex items-start gap-2 text-sm text-status-dirty">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div className="space-y-1">
              {overlaps.map((overlap, index) => (
                <div
                  key={`${overlap.sessionId}-${index}`}
                  className="flex flex-wrap items-start gap-2 text-sm text-text-secondary"
                >
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${overlapSeverityClass(overlap.severity)}`}
                  >
                    {overlapSeverityLabel(overlap.severity)}
                  </span>
                  <span>
                    {overlap.reason}: {overlap.targetValue} overlaps {overlap.sessionTitle}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function FinishedWorkCard({ session }: { session: WorkSession }) {
  return (
    <article className="rounded-lg border border-border bg-surface-1/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {session.repoName}
          </p>
          <h3 className="mt-1 truncate text-sm font-semibold text-text-primary">
            {session.title}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">{session.userName}</p>
        </div>
        <span className="rounded-md border border-border px-2 py-1 text-xs text-text-muted">
          Finished
        </span>
      </div>

      {session.endNote && (
        <div className="mt-3 rounded border border-accent/20 bg-accent/5 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-accent mb-1">Handoff</p>
          <p className="whitespace-pre-line text-sm leading-6 text-text-secondary">{session.endNote}</p>
        </div>
      )}

      <div className="mt-4">
        <AreaList session={session} />
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-text-muted">
        <span>Started {formatDateTime(session.startedAt)}</span>
        {session.endedAt && <span>Finished {formatDateTime(session.endedAt)}</span>}
        <span>{formatDuration(session.startedAt, session.endedAt)}</span>
      </div>
    </article>
  );
}

export function SessionsPage({
  activeSessions,
  recentEndedSessions,
  onEndSession,
  onUpdateNotes,
}: SessionsPageProps) {
  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        title="Work"
        description="Active work, claimed areas, and recent finished work."
      />

      <main className="space-y-8 p-8">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium uppercase tracking-wider text-text-secondary">
              Active Work
            </h3>
            <span className="text-sm text-text-muted">
              {activeSessions.length} active
            </span>
          </div>

          {activeSessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-sm text-text-muted">
                No active work. Start work from Home.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {activeSessions.map((session) => (
                <ActiveWorkCard
                  key={session.id}
                  session={session}
                  overlaps={getSessionOverlaps(session, activeSessions)}
                  onEndSession={onEndSession}
                  onUpdateNotes={onUpdateNotes}
                />
              ))}
            </div>
          )}
        </section>

        <LockInventory
          activeSessions={activeSessions}
          title="Claimed areas"
          emptyMessage="No files claimed yet. They show up here while work is active."
        />

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium uppercase tracking-wider text-text-secondary">
              Recent Finished Work
            </h3>
            <span className="text-sm text-text-muted">
              {recentEndedSessions.length} shown
            </span>
          </div>

          {recentEndedSessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-sm text-text-muted">
                Finished work shows up here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {recentEndedSessions.map((session) => (
                <FinishedWorkCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
