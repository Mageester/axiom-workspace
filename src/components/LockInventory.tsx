import { useMemo, useState } from "react";
import { Clock, Copy, Lock } from "lucide-react";
import type { WorkSession } from "../types";

interface LockInventoryProps {
  activeSessions: WorkSession[];
  title: string;
  emptyMessage: string;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="rounded p-0.5 text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
      title={copied ? "Copied!" : "Copy target path"}
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      <Copy size={11} />
    </button>
  );
}

export function LockInventory({
  activeSessions,
  title,
  emptyMessage,
}: LockInventoryProps) {
  const groupedSessions = useMemo(() => {
    const byRepo = activeSessions.reduce<Record<string, WorkSession[]>>(
      (acc, session) => {
        acc[session.repoId] = [...(acc[session.repoId] ?? []), session];
        return acc;
      },
      {},
    );
    return Object.values(byRepo);
  }, [activeSessions]);

  const totalTargets = useMemo(
    () => activeSessions.reduce((sum, session) => sum + session.targets.length, 0),
    [activeSessions],
  );

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text-secondary">
          {title}
        </h3>
        <span className="text-sm text-text-muted">{totalTargets} total</span>
      </div>

      {groupedSessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-text-muted">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedSessions.map((sessions) => {
            const repoName = sessions[0]?.repoName ?? "Unknown repo";
            return (
              <section
                key={sessions[0]?.repoId ?? repoName}
                className="overflow-hidden rounded-lg border border-border bg-surface-1"
              >
                <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-4 py-2.5">
                  <h4 className="truncate text-xs font-medium uppercase tracking-wide text-text-secondary">
                    {repoName}
                  </h4>
                  <span className="text-xs text-text-muted">
                    {sessions.reduce((count, session) => count + session.targets.length, 0)} locks
                  </span>
                </div>

                <div className="grid grid-cols-[120px_1fr_1fr_140px_150px] gap-3 border-b border-border bg-surface-0 px-4 py-2 text-xs font-medium uppercase tracking-wide text-text-muted">
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
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-text-primary">
                          {target.label ?? target.value}
                        </span>
                        <CopyButton text={target.value} />
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
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
