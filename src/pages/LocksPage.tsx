import { useMemo } from "react";
import { Lock, Users } from "lucide-react";
import type { WorkSession } from "../types";
import { PageHeader } from "../components/PageHeader";
import { LockInventory } from "../components/LockInventory";

interface LocksPageProps {
  activeSessions: WorkSession[];
}

export function LocksPage({ activeSessions }: LocksPageProps) {
  const metrics = useMemo(() => {
    const repoIds = new Set<string>();
    let lockCount = 0;
    for (const session of activeSessions) {
      repoIds.add(session.repoId);
      lockCount += session.targets.length;
    }
    return {
      repoCount: repoIds.size,
      sessionCount: activeSessions.length,
      lockCount,
    };
  }, [activeSessions]);

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        title="Locks"
        description="Read-only view of active local soft locks by repository."
      />

      <main className="space-y-6 p-8">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <div className="mb-2 flex items-center gap-2 text-text-muted">
              <Users size={14} />
              <span className="text-xs uppercase tracking-wide">Active sessions</span>
            </div>
            <p className="text-2xl font-semibold text-text-primary">
              {metrics.sessionCount}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <div className="mb-2 flex items-center gap-2 text-text-muted">
              <Lock size={14} />
              <span className="text-xs uppercase tracking-wide">Claimed targets</span>
            </div>
            <p className="text-2xl font-semibold text-text-primary">
              {metrics.lockCount}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-5">
            <div className="mb-2 flex items-center gap-2 text-text-muted">
              <Lock size={14} />
              <span className="text-xs uppercase tracking-wide">Repositories</span>
            </div>
            <p className="text-2xl font-semibold text-text-primary">
              {metrics.repoCount}
            </p>
          </div>
        </section>

        <LockInventory
          activeSessions={activeSessions}
          title="Active locks"
          emptyMessage="No active locks. Session targets will appear here while work is active."
        />
      </main>
    </div>
  );
}
