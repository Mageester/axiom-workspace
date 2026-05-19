import { useEffect, useMemo, useState } from "react";
import type {
  DeviceIdentity,
  LiveRepo,
  NavPage,
  SetupChecklistItem,
  SetupState,
  SyncSettings,
  SyncStatus,
  WorkSession,
  WorkspaceEvent,
} from "./types";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { useRepos } from "./hooks/useRepos";
import { SessionsPage } from "./pages/SessionsPage";
import { LocksPage } from "./pages/LocksPage";
import { SettingsPage } from "./pages/SettingsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
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
  applyWorkspaceEvents,
  buildSnapshotFromSessions,
  checkGitInstalled,
  createDefaultSyncSettings,
  createWorkspaceEvent,
  dedupeEvents,
  DEFAULT_SYNC_REPO_URL,
  getDefaultSyncPath,
  loadEvents,
  loadSetupState,
  loadSyncSettings,
  resetSetupState,
  saveDeviceIdentity,
  saveEvents,
  saveSetupState,
  saveSyncSettings,
  setupSyncRepo,
  syncNow,
  validateGithubAccess,
  validateSyncRepo,
  validateSyncWriteAccess,
} from "./lib/sync";

const PAGE_TITLES: Record<Exclude<NavPage, "dashboard">, string> = {
  repos: "Repos",
  sessions: "Sessions",
  locks: "Locks",
  activity: "Activity",
  settings: "Settings",
};

function createChecklist(state: SetupState): SetupChecklistItem[] {
  const identityReady =
    state.identity.userName.trim().length > 0 &&
    state.identity.deviceName.trim().length > 0;
  return [
    {
      key: "git",
      label: "Git installed",
      status: state.setupComplete ? "complete" : "checking",
      message: state.setupComplete
        ? "Git is ready for free team sync."
        : "Git is needed for free team sync. Axiom Workspace uses GitHub to share sessions and locks without a paid database.",
    },
    {
      key: "github",
      label: "GitHub upload access ready",
      status: state.setupComplete ? "complete" : "needs_action",
      message:
        "Axiom verifies read access first, then confirms it can upload sync changes.",
    },
    {
      key: "syncWorkspace",
      label: "Axiom sync workspace connected",
      status: state.setupComplete ? "complete" : "needs_action",
      message: state.syncRepoUrl || DEFAULT_SYNC_REPO_URL,
    },
    {
      key: "syncFolder",
      label: "Local sync folder ready",
      status: state.syncLocalPath ? "complete" : "checking",
      message: state.syncLocalPath || "Axiom will use the app data folder.",
    },
    {
      key: "identity",
      label: "User identity saved",
      status: identityReady ? "complete" : "needs_action",
      message: identityReady
        ? `${state.identity.userName} on ${state.identity.deviceName}`
        : "Enter your name and a friendly device name.",
    },
  ];
}

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return typeof error === "string" && error ? error : fallback;
}

function App() {
  const [activeNav, setActiveNav] = useState<NavPage>("dashboard");
  const [sessions, setSessions] = useState<WorkSession[]>(() => loadSessions());
  const [events, setEvents] = useState<WorkspaceEvent[]>(() => loadEvents());
  const [setupState, setSetupState] = useState<SetupState>(() =>
    loadSetupState(),
  );
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(() =>
    loadSyncSettings(),
  );
  const [checklist, setChecklist] = useState<SetupChecklistItem[]>(() =>
    createChecklist(loadSetupState()),
  );
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupMessage, setSetupMessage] = useState("");
  const [setupError, setSetupError] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
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

  useEffect(() => {
    setChecklist(createChecklist(setupState));
  }, [setupState]);

  useEffect(() => {
    if (!setupState.setupComplete) {
      void runSetupCheck(false);
    }
    // Run once on startup; setupState changes are handled by direct updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateChecklistItem(
    key: SetupChecklistItem["key"],
    patch: Partial<SetupChecklistItem>,
  ) {
    setChecklist((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function persistSetupState(next: SetupState) {
    setSetupState(next);
    saveSetupState(next);
  }

  function persistSyncSettings(next: SyncSettings) {
    setSyncSettings(next);
    saveSyncSettings(next);
  }

  function persistIdentity(identity: DeviceIdentity) {
    const nextSetupState = { ...setupState, identity };
    saveDeviceIdentity(identity);
    persistSetupState(nextSetupState);
    updateChecklistItem("identity", {
      status:
        identity.userName.trim() && identity.deviceName.trim()
          ? "complete"
          : "needs_action",
      message:
        identity.userName.trim() && identity.deviceName.trim()
          ? `${identity.userName} on ${identity.deviceName}`
          : "Enter your name and a friendly device name.",
    });
  }

  async function runSetupCheck(validateGithub: boolean) {
    setSetupError("");
    updateChecklistItem("git", { status: "checking", message: "Checking Git." });
    updateChecklistItem("syncFolder", {
      status: "checking",
      message: "Finding the Axiom app data sync folder.",
    });

    try {
      const [git, defaultPath] = await Promise.all([
        checkGitInstalled(),
        getDefaultSyncPath(),
      ]);
      updateChecklistItem("git", {
        status: git.installed ? "complete" : "missing",
        message: git.installed
          ? git.message
          : "Git is needed for free team sync. You may need to restart Axiom Workspace so Git is available.",
      });
      updateChecklistItem("syncFolder", {
        status: setupState.syncLocalPath ? "complete" : "needs_action",
        message: setupState.syncLocalPath || defaultPath,
      });

      if (validateGithub && git.installed) {
        updateChecklistItem("github", {
          status: "checking",
          message: "Checking read access to the Axiom team sync workspace.",
        });
        const access = await validateGithubAccess(
          setupState.syncRepoUrl || DEFAULT_SYNC_REPO_URL,
        );
        updateChecklistItem("github", {
          status: access.ok ? "needs_action" : "error",
          message: access.message,
        });
      }
    } catch (error) {
      setSetupError(formatError(error, "Axiom could not check setup."));
      updateChecklistItem("git", {
        status: "error",
        message: "Axiom could not check Git. Try Re-check Git.",
      });
    }
  }

  async function handleConnectWorkspace() {
    const identity = setupState.identity;
    if (!identity.userName.trim() || !identity.deviceName.trim()) {
      setSetupError("Enter your name and device name, then connect.");
      updateChecklistItem("identity", {
        status: "needs_action",
        message: "Enter your name and a friendly device name.",
      });
      return;
    }

    setSetupBusy(true);
    setSetupMessage("");
    setSetupError("");
    try {
      updateChecklistItem("git", { status: "checking", message: "Checking Git." });
      const git = await checkGitInstalled();
      if (!git.installed) {
        updateChecklistItem("git", {
          status: "missing",
          message:
            "Git is needed for free team sync. Install Git, then restart Axiom Workspace if Re-check does not find it.",
        });
        setSetupError(
          "Install Git, then click Re-check. You may need to restart Axiom Workspace so Git is available.",
        );
        return;
      }
      updateChecklistItem("git", { status: "complete", message: git.message });

      updateChecklistItem("github", {
        status: "checking",
        message: "Checking read access to the Axiom team sync workspace.",
      });
      const access = await validateGithubAccess(
        setupState.syncRepoUrl || DEFAULT_SYNC_REPO_URL,
      );
      if (!access.ok) {
        updateChecklistItem("github", {
          status: "error",
          message: access.message,
        });
        setSetupError(access.message);
        return;
      }
      updateChecklistItem("github", {
        status: "checking",
        message: access.message,
      });

      updateChecklistItem("syncWorkspace", {
        status: "checking",
        message: "Connecting the local Axiom sync workspace.",
      });
      const setup = await setupSyncRepo(setupState.syncRepoUrl);
      if (!setup.ok) {
        updateChecklistItem("syncWorkspace", {
          status: "error",
          message: setup.message,
        });
        setSetupError(setup.message);
        return;
      }

      const validation = await validateSyncRepo(
        setup.syncLocalPath,
        setupState.syncRepoUrl,
      );
      if (!validation.ok) {
        throw new Error(validation.message);
      }

      updateChecklistItem("github", {
        status: "checking",
        message: "Verifying GitHub upload access.",
      });
      const writeAccess = await validateSyncWriteAccess(
        setup.syncLocalPath,
        identity.deviceId,
        setupState.syncRepoUrl,
      );
      if (!writeAccess.ok) {
        updateChecklistItem("github", {
          status: "error",
          message: writeAccess.message,
        });
        setSetupError(writeAccess.message);
        return;
      }

      const nextSetupState: SetupState = {
        ...setupState,
        setupComplete: true,
        syncRepoUrl: setupState.syncRepoUrl || DEFAULT_SYNC_REPO_URL,
        syncLocalPath: setup.syncLocalPath,
        lastSetupCheckAt: new Date().toISOString(),
        lastError: undefined,
      };
      persistSetupState(nextSetupState);
      persistSyncSettings({
        ...createDefaultSyncSettings(nextSetupState),
        ...syncSettings,
        syncRepoUrl: nextSetupState.syncRepoUrl,
        syncLocalPath: nextSetupState.syncLocalPath,
        autoSyncEnabled: false,
      });
      setSetupMessage(setup.message);
      updateChecklistItem("github", {
        status: "complete",
        message: writeAccess.message,
      });
      updateChecklistItem("syncWorkspace", {
        status: "complete",
        message: setup.message,
      });
      updateChecklistItem("syncFolder", {
        status: "complete",
        message: setup.syncLocalPath,
      });
      updateChecklistItem("identity", {
        status: "complete",
        message: `${identity.userName} on ${identity.deviceName}`,
      });
    } catch (error) {
      const message = formatError(
        error,
        "Axiom could not connect the team sync workspace.",
      );
      persistSetupState({
        ...setupState,
        setupComplete: false,
        lastSetupCheckAt: new Date().toISOString(),
        lastError: message,
      });
      setSetupError(message);
      updateChecklistItem("syncWorkspace", { status: "error", message });
    } finally {
      setSetupBusy(false);
    }
  }

  function startSession(input: CreateSessionInput) {
    const session = createSession({
      ...input,
      userName: input.userName || setupState.identity.userName,
    });
    const event = createWorkspaceEvent(
      "session_created",
      { session },
      setupState.identity,
    );
    setSessions((prev) => {
      const next = [session, ...prev];
      saveSessions(next);
      return next;
    });
    setEvents((prev) => {
      const next = dedupeEvents([...prev, event]);
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
          setupState.identity,
        );
        setEvents((eventPrev) => {
          const eventNext = dedupeEvents([...eventPrev, event]);
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
    const clean = dedupeEvents(next);
    setEvents(clean);
    saveEvents(clean);
  }

  async function handleSyncNow() {
    if (!setupState.setupComplete || !syncSettings.syncLocalPath.trim()) {
      const message =
        "Axiom is local-only until the team sync workspace is connected.";
      setSyncStatus("error");
      persistSyncSettings({
        ...syncSettings,
        lastSyncStatus: "Error",
        lastSyncError: message,
      });
      return;
    }

    setSyncStatus("checking");
    persistSyncSettings({
      ...syncSettings,
      lastSyncStatus: "Checking",
      lastSyncError: undefined,
    });

    try {
      const validation = await validateSyncRepo(
        syncSettings.syncLocalPath,
        syncSettings.syncRepoUrl,
      );
      if (!validation.ok) {
        throw new Error(validation.message);
      }

      setSyncStatus("writing_local_events");
      const snapshot = buildSnapshotFromSessions(
        sessions,
        events,
        setupState.identity,
      );
      const result = await syncNow(
        syncSettings.syncLocalPath,
        syncSettings.syncRepoUrl,
        events,
        snapshot,
      );

      setSyncStatus("merging");
      const mergedEvents = dedupeEvents([...events, ...result.events]);
      const mergedSessions = applyWorkspaceEvents(sessions, mergedEvents);
      updateEvents(mergedEvents);
      updateSessions(mergedSessions);

      const nextSettings: SyncSettings = {
        ...syncSettings,
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: result.message,
        lastSyncError: undefined,
      };
      persistSyncSettings(nextSettings);
      setSyncStatus("complete");
    } catch (error) {
      const message = formatError(
        error,
        "Sync could not upload changes. Check internet and GitHub login.",
      );
      persistSyncSettings({
        ...syncSettings,
        lastSyncStatus: "Error",
        lastSyncError: message,
      });
      setSyncStatus("error");
    }
  }

  function handleResetSetup() {
    const reset = resetSetupState();
    setSetupState(reset);
    setSyncSettings(createDefaultSyncSettings(reset));
    setChecklist(createChecklist(reset));
    setActiveNav("dashboard");
    setSetupMessage("");
    setSetupError("");
    setSyncStatus("idle");
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
          defaultUserName={setupState.identity.userName}
          setupState={setupState}
          syncSettings={syncSettings}
          syncStatus={syncStatus}
          onSyncNow={handleSyncNow}
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
          setupState={setupState}
          checklist={checklist}
          settings={syncSettings}
          syncStatus={syncStatus}
          eventCount={events.length}
          onIdentityChange={persistIdentity}
          onSetupChange={persistSetupState}
          onSettingsChange={persistSyncSettings}
          onValidateSetup={() => runSetupCheck(true)}
          onSyncNow={handleSyncNow}
          onResetSetup={handleResetSetup}
        />
      );
    }
    return (
      <PlaceholderPage
        title={PAGE_TITLES[activeNav]}
        description={`${PAGE_TITLES[activeNav]} will show shared coordination activity as sync grows.`}
      />
    );
  }

  if (!setupState.setupComplete) {
    return (
      <OnboardingPage
        identity={setupState.identity}
        checklist={checklist}
        busy={setupBusy}
        message={setupMessage}
        error={setupError}
        onIdentityChange={persistIdentity}
        onConnect={handleConnectWorkspace}
        onRecheck={() => runSetupCheck(true)}
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
