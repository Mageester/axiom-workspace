import { Clock, Lock } from "lucide-react";
import type { WorkSession } from "../types";
import { PageHeader } from "../components/PageHeader";

interface LocksPageProps {
  activeSessions: WorkSession[];
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function LocksPage({ activeSessions }: LocksPageProps) {
  const sessionsByRepo = activeSessions.reduce<Record<string, WorkSession[]>>(
    (acc, session) => {
      acc[session.repoId] = [...(acc[session.repoId] ?? []), session];
      return acc;
    },
    {},
  );

  const groupedSessions = Object.values(sessionsByRepo);

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        title="Locks"
        description="Read-only view of active local soft locks by repository."
      />

      <main className="p-8">
        {groupedSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-sm text-text-muted">
              No active locks. Session targets will appear here while work is active.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedSessions.map((sessions) => {
              const repoName = sessions[0]?.repoName ?? "Unknown repo";
              return (
                <section key={sessions[0]?.repoId ?? repoName}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-text-secondary">
                      {repoName}
                    </h3>
                    <span className="text-sm text-text-muted">
                      {sessions.reduce(
                        (count, session) => count + session.targets.length,
                        0,
                      )}{" "}
                      locks
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-border bg-surface-1">
                    <div className="grid grid-cols-[120px_1fr_1fr_140px_150px] gap-3 border-b border-border bg-surface-2 px-4 py-3 text-xs font-medium uppercase tracking-wide text-text-muted">
                      <span>Type</span>
                      <span>Target</span>
                      <span>Session</span>
                      <span>User</span>
                      <span>Started</span>
                    </div>
                    {sessions.flatMap((session) =>
                      session.targets.map((target) => (
                        <div
                          key={`${session.id}-${target.id}`}
                          className="grid grid-cols-[120px_1fr_1fr_140px_150px] gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
                        >
                          <span className="inline-flex items-center gap-2 text-text-secondary">
                            <Lock size={13} />
                            {target.type}
                          </span>
                          <span className="truncate text-text-primary">
                            {target.label ?? target.value}
                          </span>
                          <span className="truncate text-text-secondary">
                            {session.title}
                          </span>
                          <span className="truncate text-text-secondary">
                            {session.userName}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-text-muted">
                            <Clock size={12} />
                            {formatDateTime(session.startedAt)}
                          </span>
                        </div>
                      )),
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
