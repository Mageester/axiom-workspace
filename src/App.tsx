import { useMemo, useState } from "react";
import type { LiveRepo, NavPage, WorkSession } from "./types";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { useRepos } from "./hooks/useRepos";
import { SessionsPage } from "./pages/SessionsPage";
import { LocksPage } from "./pages/LocksPage";
import {
  createSession,
  endSession,
  getActiveSessions,
  getRecentEndedSessions,
  loadSessions,
  saveSessions,
  type CreateSessionInput,
} from "./lib/sessions";

const PAGE_TITLES: Record<Exclude<NavPage, "dashboard">, string> = {
  repos: "Repos",
  sessions: "Sessions",
  locks: "Locks",
  activity: "Activity",
  settings: "Settings",
};

function App() {
  const [activeNav, setActiveNav] = useState<NavPage>("dashboard");
  const [sessions, setSessions] = useState<WorkSession[]>(() => loadSessions());
  const {
    repos,
    loading,
    refreshingPaths,
    addRepo,
    removeRepo,
    refreshRepo,
    refreshAll,
  } = useRepos();

  const activeSessions = useMemo(
    () => getActiveSessions(sessions),
    [sessions],
  );
  const recentEndedSessions = useMemo(
    () => getRecentEndedSessions(sessions),
    [sessions],
  );

  function startSession(input: CreateSessionInput) {
    const session = createSession(input);
    setSessions((prev) => {
      const next = [session, ...prev];
      saveSessions(next);
      return next;
    });
  }

  function finishSession(sessionId: string) {
    setSessions((prev) => {
      const next = endSession(prev, sessionId);
      saveSessions(next);
      return next;
    });
  }

  function getRepoSessions(repo: LiveRepo): WorkSession[] {
    return activeSessions.filter((session) => session.repoId === repo.id);
  }

  function renderPage() {
    if (activeNav === "dashboard") {
      return (
        <Dashboard
          repos={repos}
          activeSessions={activeSessions}
          loading={loading}
          refreshingPaths={refreshingPaths}
          onRefreshAll={refreshAll}
          onRefreshRepo={refreshRepo}
          onAddRepo={addRepo}
          onRemoveRepo={removeRepo}
          onStartSession={startSession}
          getRepoSessions={getRepoSessions}
        />
      );
    }
    if (activeNav === "sessions") {
      return (
        <SessionsPage
          activeSessions={activeSessions}
          recentEndedSessions={recentEndedSessions}
          onEndSession={finishSession}
        />
      );
    }
    if (activeNav === "locks") {
      return <LocksPage activeSessions={activeSessions} />;
    }
    return (
      <PlaceholderPage
        title={PAGE_TITLES[activeNav]}
        description={`${PAGE_TITLES[activeNav]} management coming soon.`}
      />
    );
  }

  return (
    <div className="flex h-screen bg-surface-0">
      <Sidebar activeItem={activeNav} onNavigate={setActiveNav} />
      {renderPage()}
    </div>
  );
}

export default App;
