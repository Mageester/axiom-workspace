import { useMemo, useState } from "react";
import type { LiveRepo, NavPage, WorkSession } from "./types";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { useRepos } from "./hooks/useRepos";
import { SessionsPage } from "./pages/SessionsPage";
import { LocksPage } from "./pages/LocksPage";
import { SettingsPage } from "./pages/SettingsPage";
import {
  createSession,
  endSession,
  getActiveSessions,
  getRecentEndedSessions,
  loadSessions,
  saveSessions,
  type CreateSessionInput,
} from "./lib/sessions";
import {
  createWorkspaceEvent,
  loadEvents,
  loadSyncSettings,
  saveEvents,
  saveSyncSettings,
} from "./lib/sync";
import type { SyncSettings, WorkspaceEvent } from "./types";

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
  const [events, setEvents] = useState<WorkspaceEvent[]>(() => loadEvents());
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(() =>
    loadSyncSettings(),
  );
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() =>
    localStorage.getItem("axiom-workspace:last-sync-at"),
  );
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
    const session = createSession({
      ...input,
      userName: input.userName || syncSettings.identity.userName,
    });
    const event = createWorkspaceEvent(
      "session_created",
      { session },
      syncSettings.identity,
    );
    setSessions((prev) => {
      const next = [session, ...prev];
      saveSessions(next);
      return next;
    });
    setEvents((prev) => {
      const next = [...prev, event];
      saveEvents(next);
      return next;
    });
  }

  function finishSession(sessionId: string) {
    setSessions((prev) => {
      const next = endSession(prev, sessionId);
      saveSessions(next);
      const endedSession = next.find((session) => session.id === sessionId);
      if (endedSession?.endedAt) {
        const event = createWorkspaceEvent(
          "session_ended",
          { sessionId, endedAt: endedSession.endedAt },
          syncSettings.identity,
        );
        setEvents((eventPrev) => {
          const eventNext = [...eventPrev, event];
          saveEvents(eventNext);
          return eventNext;
        });
      }
      return next;
    });
  }

  function updateSessions(next: WorkSession[]) {
    setSessions(next);
    saveSessions(next);
  }

  function updateEvents(next: WorkspaceEvent[]) {
    setEvents(next);
    saveEvents(next);
  }

  function updateSyncSettings(next: SyncSettings) {
    setSyncSettings(next);
    saveSyncSettings(next);
  }

  function markSyncCompleted() {
    const now = new Date().toISOString();
    setLastSyncAt(now);
    localStorage.setItem("axiom-workspace:last-sync-at", now);
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
          defaultUserName={syncSettings.identity.userName}
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
    if (activeNav === "settings") {
      return (
        <SettingsPage
          sessions={sessions}
          events={events}
          settings={syncSettings}
          lastSyncAt={lastSyncAt}
          onSettingsChange={updateSyncSettings}
          onSessionsChange={updateSessions}
          onEventsChange={updateEvents}
          onSyncCompleted={markSyncCompleted}
        />
      );
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
