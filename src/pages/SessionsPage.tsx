import { useState } from "react";
import { AlertTriangle, Check, Clock, GitBranch, Lock, Pencil, Timer, TimerOff, X } from "lucide-react";
import type { SessionOverlap, WorkSession } from "../types";
import { PageHeader } from "../components/PageHeader";
import { iconBtnClass, secondaryBtnClass } from "../lib/constants";
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

function TargetList({ session }: { session: WorkSession }) {
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

function ActiveSessionCard({
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
  const [ending, setEnding] = useState(false);
  const [endNote, setEndNote] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(session.notes ?? "");

  return (
    <article className="rounded-lg border border-border bg-surface-1 p-5">
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
        {!ending && (
          <button
            className={secondaryBtnClass}
            onClick={() => setEnding(true)}
          >
            <TimerOff size={14} />
            End
          </button>
        )}
      </div>

      {ending && (
        <div className="mt-4 rounded-md border border-status-dirty/30 bg-status-dirty/10 p-3 space-y-2">
          <p className="text-sm font-medium text-status-dirty">
            End session &ldquo;{session.title}&rdquo;? This releases all soft locks.
          </p>
          <textarea
            className="w-full rounded border border-border bg-surface-0 px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted outline-none resize-none"
            rows={2}
            placeholder="Handoff note (optional) — where you left off, what's next"
            value={endNote}
            onChange={(e) => setEndNote(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button
              className={`${secondaryBtnClass} !bg-status-locked/10 !text-status-locked !border-status-locked/30 hover:!bg-status-locked/20`}
              onClick={() => {
                onEndSession(session.id, endNote);
                setEnding(false);
              }}
            >
              Confirm End
            </button>
            <button
              className={secondaryBtnClass}
              onClick={() => { setEnding(false); setEndNote(""); }}
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
              placeholder="Session notes..."
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
        <TargetList session={session} />
      </div>

      {overlaps.length > 0 && (
        <div className="mt-4 rounded-md border border-status-dirty/30 bg-status-dirty/10 px-3 py-2">
          <div className="flex items-start gap-2 text-sm text-status-dirty">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div className="space-y-1">
              {overlaps.map((overlap, index) => (
                <p key={`${overlap.sessionId}-${index}`}>
                  {overlap.reason}: {overlap.targetValue} overlaps{" "}
                  {overlap.sessionTitle}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function EndedSessionCard({ session }: { session: WorkSession }) {
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
          Ended
        </span>
      </div>

      {session.endNote && (
        <div className="mt-3 rounded border border-accent/20 bg-accent/5 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-accent mb-1">Handoff Note</p>
          <p className="text-sm leading-6 text-text-secondary">{session.endNote}</p>
        </div>
      )}

      <div className="mt-4">
        <TargetList session={session} />
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-text-muted">
        <span>Started {formatDateTime(session.startedAt)}</span>
        {session.endedAt && <span>Ended {formatDateTime(session.endedAt)}</span>}
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
        title="Sessions"
        description="Active local coordination and recent completed work."
      />

      <main className="space-y-8 p-8">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium uppercase tracking-wider text-text-secondary">
              Active Sessions
            </h3>
            <span className="text-sm text-text-muted">
              {activeSessions.length} active
            </span>
          </div>

          {activeSessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-sm text-text-muted">
                No active sessions. Start one from the Dashboard.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {activeSessions.map((session) => (
                <ActiveSessionCard
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

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium uppercase tracking-wider text-text-secondary">
              Recent Ended Sessions
            </h3>
            <span className="text-sm text-text-muted">
              {recentEndedSessions.length} shown
            </span>
          </div>

          {recentEndedSessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-sm text-text-muted">
                Ended sessions will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {recentEndedSessions.map((session) => (
                <EndedSessionCard key={session.id} session={session} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
