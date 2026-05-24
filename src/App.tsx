import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DeviceIdentity,
  NavPage,
  SetupChecklistItem,
  SetupState,
  SyncSettings,
  SyncStatus,
  TrayBoardSummary,
  TrayEventSummary,
  TrayRepoSummary,
  TrayWidgetState,
  WorkCard,
  WorkSession,
  WorkspaceEvent,
} from "./types";
import { Sidebar } from "./components/Sidebar";
import { RepoDiscoveryModal } from "./components/RepoDiscoveryModal";
import { TodayPage } from "./pages/TodayPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ActivityPage } from "./pages/ActivityPage";
import { SettingsPage } from "./pages/SettingsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { useRepos } from "./hooks/useRepos";
import {
  createSession,
  endSession,
  getActiveSessions,
  loadSessions,
  saveSessions,
  type CreateSessionInput,
} from "./lib/sessions";
import {
  applyBoardEvents,
  loadCards,
  saveCards,
} from "./lib/board";
import { loadRepoNicknames, setRepoNickname } from "./lib/repos";
import {
  applyWorkspaceEvents,
  buildSnapshotFromSessions,
  checkForUpdate,
  checkGitInstalled,
  clearAxiomLocalStorage,
  createDefaultSyncSettings,
  createWorkspaceEvent,
  dedupeEvents,
  DEFAULT_SYNC_REPO_URL,
  getDefaultSyncPath,
  getSystemIdentity,
  loadEvents,
  loadSetupState,
  loadSyncSettings,
  resetSetupState,
  resetSyncState,
  saveDeviceIdentity,
  saveEvents,
  saveSetupState,
  saveSyncSettings,
  setupSyncRepo,
  syncNow,
  validateGithubAccess,
  validateSyncWriteAccess,
  type UpdateCheckResult,
} from "./lib/sync";
import { discoverLocalRepos, filterDiscoverableRepos, getRepoProfile, loadRepoPaths, pullRepo as invokePullRepo } from "./lib/repos";

import { initTray, updateTrayTooltip, destroyTray, destroyWidgetWindow, openMainWindow, createWidgetWindow, broadcastWidgetState, broadcastNotification } from "./lib/tray";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

const APP_VERSION = "1.3.1";
const FOCUSED_SYNC_MS = 30 * 1000;
const BLURRED_SYNC_MS = 180 * 1000;

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
        : "Git is needed for free team sync.",
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
  if (error instanceof Error && error.message) return error.message;
  return typeof error === "string" && error ? error : fallback;
}

function formatEventDescription(event: WorkspaceEvent): string {
  const payload = event.payload as Record<string, unknown>;
  switch (event.type) {
    case "session_created": {
      const s = payload.session as { repoName?: string } | undefined;
      return `Started work on ${s?.repoName || "unknown repo"}`;
    }
    case "session_ended": {
      const note = payload.endNote as string | undefined;
      return note ? `Finished work — ${note}` : "Finished work";
    }
    case "sync_completed":
      return "Workspace synced successfully";
    case "repo_refreshed": {
      const path = payload.repoPath as string | undefined;
      return path === "all" ? "Refreshed all projects" : `Refreshed ${path || "project"}`;
    }
    default:
      return event.type.replace(/_/g, " ");
  }
}

function App() {
  const [activeNav, setActiveNav] = useState<NavPage>("today");
  const [sessions, setSessions] = useState<WorkSession[]>(() => loadSessions());
  const [cards, setCards] = useState<WorkCard[]>(() => loadCards());
  const [events, setEvents] = useState<WorkspaceEvent[]>(() => loadEvents());
  const [setupState, setSetupState] = useState<SetupState>(() => loadSetupState());
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(() => loadSyncSettings());
  const [checklist, setChecklist] = useState<SetupChecklistItem[]>(() => createChecklist(loadSetupState()));
  const [repoNicknames, setRepoNicknames] = useState<Record<string, string>>(() => loadRepoNicknames());
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupChecking, setSetupChecking] = useState(false);
  const [setupMessage, setSetupMessage] = useState("");
  const [setupError, setSetupError] = useState("");
  const [gitVersion, setGitVersion] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [pullingPaths, setPullingPaths] = useState<Set<string>>(new Set());
  
  const trayInitializedRef = useRef(false);
  const prevSessionIdsRef = useRef<Set<string>>(new Set());
  const syncInFlightRef = useRef(false);
  const autoSyncTimerRef = useRef<number | null>(null);
  const syncRetryTimerRef = useRef<number | null>(null);
  const syncRetryCountRef = useRef(0);
  const sessionsRef = useRef(sessions);
  const eventsRef = useRef(events);
  const setupStateRef = useRef(setupState);
  const syncSettingsRef = useRef(syncSettings);
  const setupInFlightRef = useRef(false);
  const setupCheckInFlightRef = useRef(false);
  const autoConnectAttemptedRef = useRef(false);
  const autoAddReposAttemptedRef = useRef(false);
  const identityAutoFilledRef = useRef(false);

  const {
    repos,
    loading,
    refreshingPaths,
    diagnostics: repoDiagnostics,
    addRepo,
    removeRepo,
    refreshRepo,
    refreshAll,
  } = useRepos({
    autoRefreshEnabled: syncSettings.autoRefreshReposEnabled,
    minimumRefreshIntervalSeconds: syncSettings.repoRefreshIntervalSeconds,
  });

  const activeSessions = useMemo(() => getActiveSessions(sessions), [sessions]);

  // Tray widget state
  const trayRepoSummaries = useMemo((): TrayRepoSummary[] =>
    repos.map((r) => ({
      name: r.name,
      status: r.status,
      branch: r.currentBranch,
      changedFileCount: r.changedFileCount,
      behind: r.behind,
      hasLockConflict: activeSessions.some(
        (s) => s.repoId === r.id && s.userName !== setupState.identity.userName,
      ),
    })),
  [repos, activeSessions, setupState.identity.userName]);

  const trayBoardSummary = useMemo((): TrayBoardSummary => {
    const columnCounts: Record<string, number> = { inbox: 0, ready: 0, in_progress: 0, blocked: 0, review: 0, done: 0 };
    let assignedToYou = 0;
    for (const card of cards) {
      columnCounts[card.column] = (columnCounts[card.column] || 0) + 1;
      if (card.assignee === "you" || card.createdBy === setupState.identity.userName) assignedToYou++;
    }
    return { ...columnCounts, assignedToYou } as TrayBoardSummary;
  }, [cards, setupState.identity.userName]);

  const trayRecentEvents = useMemo((): TrayEventSummary[] =>
    events
      .slice(-30)
      .reverse()
      .map((e) => ({
        id: e.id,
        type: e.type,
        userName: e.userName,
        description: formatEventDescription(e),
        createdAt: e.createdAt,
      })),
  [events]);

  const trayWidgetState = useMemo((): TrayWidgetState => ({
    activeSessions,
    repos: trayRepoSummaries,
    recentEvents: trayRecentEvents,
    boardSummary: trayBoardSummary,
    syncStatus,
    lastSyncAt: syncSettings.lastSyncAt,
    currentUser: setupState.identity.userName,
  }), [activeSessions, trayRepoSummaries, trayRecentEvents, trayBoardSummary, syncStatus, syncSettings.lastSyncAt, setupState.identity.userName]);

  // Broadcast widget state
  useEffect(() => {
    void broadcastWidgetState(trayWidgetState);
  }, [trayWidgetState]);

  // Notifications
  const notificationsInitializedRef = useRef(false);
  useEffect(() => {
    const currentIds = new Set(activeSessions.map((s) => s.id));
    const prevIds = prevSessionIdsRef.current;
    if (!notificationsInitializedRef.current) {
      notificationsInitializedRef.current = true;
      prevSessionIdsRef.current = currentIds;
      return;
    }
    for (const s of activeSessions) {
      if (!prevIds.has(s.id) && s.userName !== setupState.identity.userName) {
        void broadcastNotification({
          id: `notif-${s.id}-started`,
          type: "session_started",
          title: `${s.userName} started working`,
          message: `${s.repoName}${s.branch ? ` (${s.branch})` : ""}`,
          userName: s.userName,
          timestamp: new Date().toISOString(),
        });
      }
    }
    for (const id of prevIds) {
      if (!currentIds.has(id)) {
        const ended = sessions.find((s) => s.id === id);
        if (ended && ended.userName !== setupState.identity.userName) {
          void broadcastNotification({
            id: `notif-${id}-ended`,
            type: "session_ended",
            title: `${ended.userName} finished working`,
            message: `${ended.repoName}${ended.endNote ? ` — ${ended.endNote}` : ""}`,
            userName: ended.userName,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    prevSessionIdsRef.current = currentIds;
  }, [activeSessions, sessions, setupState.identity.userName]);

  // Initialize tray
  useEffect(() => {
    if (!setupState.setupComplete || trayInitializedRef.current) return;
    trayInitializedRef.current = true;
    const trayPromise = initTray({
      onSyncNow: () => void handleSyncNow(false),
      onQuit: async () => {
        await destroyWidgetWindow();
        await destroyTray();
        const win = getCurrentWindow();
        await win.destroy();
      },
    });
    void createWidgetWindow();
    const unlisteners: (() => void)[] = [];
    void (async () => {
      const u1 = await listen("widget:sync-request", () => { void handleSyncNow(false); });
      unlisteners.push(u1);
      const u2 = await listen("widget:open-main", () => { void openMainWindow(); });
      unlisteners.push(u2);
    })();
    let unlistenClose: (() => void) | undefined;
    void (async () => {
      const win = getCurrentWindow();
      unlistenClose = await win.onCloseRequested(async (event) => {
        event.preventDefault();
        await win.hide();
      });
    })();
    return () => {
      void trayPromise.then(() => destroyTray());
      void destroyWidgetWindow();
      unlisteners.forEach((u) => u());
      unlistenClose?.();
      trayInitializedRef.current = false;
    };
  }, [setupState.setupComplete]);

  // Update tray tooltip
  useEffect(() => {
    if (!trayInitializedRef.current) return;
    const count = activeSessions.length;
    const tooltip = count > 0 ? `Axiom — ${count} active session${count !== 1 ? "s" : ""}` : "Axiom Workspace";
    void updateTrayTooltip(tooltip);
  }, [activeSessions.length]);

  useEffect(() => {
    sessionsRef.current = sessions;
    eventsRef.current = events;
    setupStateRef.current = setupState;
    syncSettingsRef.current = syncSettings;
    setChecklist(createChecklist(setupState));
  }, [sessions, events, setupState, syncSettings]);

  useEffect(() => {
    void runSetupCheck(false);
    return () => {
      if (autoSyncTimerRef.current !== null) window.clearTimeout(autoSyncTimerRef.current);
      if (syncRetryTimerRef.current !== null) window.clearTimeout(syncRetryTimerRef.current);
    };
  }, []);

  // Auto-fill identity
  useEffect(() => {
    if (identityAutoFilledRef.current) return;
    identityAutoFilledRef.current = true;
    const current = setupStateRef.current.identity;
    if (current.userName.trim() && current.deviceName.trim() && current.deviceName !== "Axiom Device") return;
    void (async () => {
      try {
        const detected = await getSystemIdentity();
        const next: DeviceIdentity = {
          ...current,
          userName: !current.userName.trim() && detected.userName ? detected.userName : current.userName,
          deviceName: (!current.deviceName.trim() || current.deviceName === "Axiom Device") && detected.hostName ? detected.hostName : current.deviceName,
        };
        if (next.userName !== current.userName || next.deviceName !== current.deviceName) persistIdentity(next);
      } catch {}
    })();
  }, []);

  // Auto-connect
  useEffect(() => {
    if (setupState.setupComplete || autoConnectAttemptedRef.current || setupInFlightRef.current || setupBusy || setupChecking) return;
    if (!setupState.identity.userName.trim() || !setupState.identity.deviceName.trim()) return;
    const gitItem = checklist.find((item) => item.key === "git");
    if (!gitItem || gitItem.status !== "complete") return;
    autoConnectAttemptedRef.current = true;
    void handleConnectWorkspace();
  }, [setupState.setupComplete, setupState.identity.userName, setupState.identity.deviceName, checklist, setupBusy, setupChecking]);

  // Auto-discover repos
  useEffect(() => {
    if (!setupState.setupComplete || autoAddReposAttemptedRef.current || loadRepoPaths().length > 0) {
       autoAddReposAttemptedRef.current = true;
       return;
    }
    autoAddReposAttemptedRef.current = true;
    void (async () => {
      try {
        const discovered = await discoverLocalRepos();
        const filtered = filterDiscoverableRepos(discovered);
        const recommended = filtered.filter(repo => repo.confidenceScore >= 90 || Boolean(getRepoProfile(repo.name)));
        for (const repo of recommended) {
          try { await addRepo(repo.path); } catch {}
        }
      } catch {}
    })();
  }, [setupState.setupComplete, addRepo]);

  // Periodic update check
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const result = await checkForUpdate(APP_VERSION);
      if (!cancelled && result && result.available) setUpdateInfo(result);
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 6 * 60 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  // Auto-sync timers
  useEffect(() => {
    if (!setupState.setupComplete || !syncSettings.autoSyncEnabled) return;
    const timer = window.setInterval(() => {
      if (syncInFlightRef.current) return;
      const focused = typeof document !== "undefined" ? document.hasFocus() : true;
      const threshold = focused ? FOCUSED_SYNC_MS : BLURRED_SYNC_MS;
      const last = syncSettingsRef.current.lastSyncAt;
      const lastMs = last ? new Date(last).getTime() : 0;
      if (!Number.isFinite(lastMs) || Date.now() - lastMs >= threshold) void handleSyncNow(true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [setupState.setupComplete, syncSettings.autoSyncEnabled]);

  function persistSetupState(next: SetupState) { setSetupState(next); saveSetupState(next); }
  function persistSyncSettings(next: SyncSettings) { setSyncSettings(next); saveSyncSettings(next); }
  function persistIdentity(identity: DeviceIdentity) {
    const nextSetupState = { ...setupState, identity };
    saveDeviceIdentity(identity);
    persistSetupState(nextSetupState);
  }

  async function runSetupCheck(validateGithub: boolean) {
    if (setupCheckInFlightRef.current || setupInFlightRef.current) return;
    setupCheckInFlightRef.current = true;
    setSetupChecking(true);
    setSetupError("");
    try {
      const [git, defaultPath] = await Promise.all([checkGitInstalled(), getDefaultSyncPath()]);
      setGitVersion(git.version || git.message || "");
      if (validateGithub && git.installed) {
        await validateGithubAccess(setupState.syncRepoUrl || DEFAULT_SYNC_REPO_URL);
      }
    } catch (error) {
      setSetupError(formatError(error, "Axiom could not check setup."));
    } finally {
      setupCheckInFlightRef.current = false;
      setSetupChecking(false);
    }
  }

  async function handleConnectWorkspace() {
    if (setupInFlightRef.current) return;
    const identity = setupState.identity;
    if (!identity.userName.trim() || !identity.deviceName.trim()) {
      setSetupError("Enter your name and device name, then connect.");
      return;
    }
    setupInFlightRef.current = true;
    setSetupBusy(true);
    setSetupError("");
    try {
      const git = await checkGitInstalled();
      if (!git.installed) {
        setSetupError("Install Git, then click Re-check.");
        return;
      }
      const access = await validateGithubAccess(setupState.syncRepoUrl || DEFAULT_SYNC_REPO_URL);
      if (!access.ok) { setSetupError(access.message); return; }
      const setup = await setupSyncRepo(setupState.syncRepoUrl);
      if (!setup.ok) { setSetupError(setup.message); return; }
      const writeAccess = await validateSyncWriteAccess(setup.syncLocalPath, identity.deviceId, setupState.syncRepoUrl);
      if (!writeAccess.ok) { setSetupError(writeAccess.message); return; }

      const nextSetupState: SetupState = {
        ...setupState,
        setupComplete: true,
        syncRepoUrl: setupState.syncRepoUrl || DEFAULT_SYNC_REPO_URL,
        syncLocalPath: setup.syncLocalPath,
        lastSetupCheckAt: new Date().toISOString(),
      };
      persistSetupState(nextSetupState);
      persistSyncSettings({
        ...createDefaultSyncSettings(nextSetupState),
        ...syncSettings,
        syncRepoUrl: nextSetupState.syncRepoUrl,
        syncLocalPath: nextSetupState.syncLocalPath,
        autoSyncEnabled: true,
      });
      setActiveNav("today");
      setShowDiscoveryModal(true);
    } catch (error) {
      setSetupError(formatError(error, "Axiom could not connect."));
    } finally {
      setupInFlightRef.current = false;
      setSetupBusy(false);
    }
  }

  function startSession(input: CreateSessionInput) {
    const session = createSession({ ...input, userName: input.userName || setupState.identity.userName });
    const event = createWorkspaceEvent("session_created", { session }, setupState.identity);
    setSessions(prev => { const next = [session, ...prev]; saveSessions(next); return next; });
    setEvents(prev => { const next = dedupeEvents([...prev, event]); saveEvents(next); return next; });
    scheduleAutoSync();
    return session;
  }

  function finishSession(sessionId: string, endNote?: string) {
    setSessions(prev => {
      const next = endSession(prev, sessionId, endNote);
      saveSessions(next);
      const endedSession = next.find(s => s.id === sessionId);
      if (endedSession?.endedAt) {
        const event = createWorkspaceEvent("session_ended", { sessionId, endedAt: endedSession.endedAt, endNote: endedSession.endNote }, setupState.identity);
        setEvents(eventPrev => { const eventNext = dedupeEvents([...eventPrev, event]); saveEvents(eventNext); return eventNext; });
        scheduleAutoSync();
      }
      return next;
    });
  }

  function scheduleAutoSync() {
    if (!setupStateRef.current.setupComplete || !syncSettingsRef.current.autoSyncEnabled || !syncSettingsRef.current.syncLocalPath.trim()) return;
    if (autoSyncTimerRef.current !== null) window.clearTimeout(autoSyncTimerRef.current);
    autoSyncTimerRef.current = window.setTimeout(() => {
      autoSyncTimerRef.current = null;
      if (!syncInFlightRef.current) void handleSyncNow(true);
    }, 5000);
  }

  async function handleSyncNow(isAutomatic = false) {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    try {
      const currentSetupState = setupStateRef.current;
      const currentSyncSettings = syncSettingsRef.current;
      const currentSessions = sessionsRef.current;
      const currentEvents = eventsRef.current;
      if (!currentSetupState.setupComplete || !currentSyncSettings.syncLocalPath.trim()) {
        setSyncStatus("error");
        return;
      }
      setSyncStatus("checking");
      const snapshot = buildSnapshotFromSessions(currentSessions, currentEvents, currentSetupState.identity, cards);
      const result = await syncNow(currentSyncSettings.syncLocalPath, currentSyncSettings.syncRepoUrl, currentEvents, snapshot);
      const mergedEvents = dedupeEvents([...currentEvents, ...result.events]);
      const mergedSessions = applyWorkspaceEvents(currentSessions, mergedEvents);
      const mergedCards = applyBoardEvents(cards, mergedEvents);
      setEvents(mergedEvents); saveEvents(mergedEvents);
      setSessions(mergedSessions); saveSessions(mergedSessions);
      setCards(mergedCards); saveCards(mergedCards);
      persistSyncSettings({ ...currentSyncSettings, lastSyncAt: new Date().toISOString(), lastSyncStatus: result.message, lastSyncError: undefined });
      setSyncStatus("complete");
      syncRetryCountRef.current = 0;
    } catch (error) {
      setSyncStatus("error");
    } finally {
      syncInFlightRef.current = false;
    }
  }

  async function handlePullRepo(path: string) {
    setPullingPaths(prev => new Set(prev).add(path));
    try { await invokePullRepo(path); await refreshRepo(path); } catch { await refreshRepo(path); } finally {
      setPullingPaths(prev => { const next = new Set(prev); next.delete(path); return next; });
    }
  }

  function handleFullLocalReset() {
    clearAxiomLocalStorage();
    window.location.reload();
  }

  function renderPage() {
    switch (activeNav) {
      case "today":
        return <TodayPage repos={repos} activeSessions={activeSessions} recentEvents={events} defaultUserName={setupState.identity.userName} setupState={setupState} syncSettings={syncSettings} syncStatus={syncStatus} loading={loading} onSyncNow={handleSyncNow} onStartSession={startSession} onFinishSession={finishSession} onNavigate={setActiveNav} />;
      case "projects":
        return <ProjectsPage repos={repos} repoNicknames={repoNicknames} activeSessions={activeSessions} loading={loading} refreshingPaths={refreshingPaths} pullingPaths={pullingPaths} onRefreshAll={refreshAll} onRefreshRepo={refreshRepo} onAddRepo={addRepo} onRemoveRepo={removeRepo} onRenameRepo={setRepoNickname} onStartSession={startSession} onPullRepo={handlePullRepo} getRepoSessions={r => activeSessions.filter(s => s.repoId === r.id)} defaultUserName={setupState.identity.userName} />;
      case "activity":
        return <ActivityPage events={events} syncSettings={syncSettings} repoDiagnostics={repoDiagnostics} />;
      case "settings":
        return <SettingsPage setupState={setupState} checklist={checklist} settings={syncSettings} syncStatus={syncStatus} eventCount={events.length} appVersion={APP_VERSION} gitVersion={gitVersion} repoCount={repos.length} activeSessionCount={activeSessions.length} repoDiagnostics={repoDiagnostics} onIdentityChange={persistIdentity} onSetupChange={persistSetupState} onSettingsChange={persistSyncSettings} onValidateSetup={() => runSetupCheck(true)} onSyncNow={handleSyncNow} onResetSetup={() => { persistSetupState(resetSetupState()); setActiveNav("today"); }} onResetSessionsAndLocks={() => { setSessions([]); saveSessions([]); }} onResetSyncState={() => { const r = resetSyncState(); persistSetupState(r.setupState); persistSyncSettings(r.syncSettings); }} onFullLocalReset={handleFullLocalReset} onResetDismissedSuggestions={() => {}} />;
      default:
        return null;
    }
  }

  if (!setupState.setupComplete) {
    return <OnboardingPage identity={setupState.identity} checklist={checklist} busy={setupBusy || setupChecking} message={setupMessage} error={setupError} onIdentityChange={persistIdentity} onConnect={handleConnectWorkspace} onRecheck={() => runSetupCheck(true)} />;
  }

  return (
    <div className="flex h-screen bg-surface-0">
      <Sidebar activeItem={activeNav} onNavigate={setActiveNav} setupComplete={setupState.setupComplete} activeSessionCount={activeSessions.length} syncStatus={syncStatus} syncSettings={syncSettings} />
      <RepoDiscoveryModal open={showDiscoveryModal} onClose={() => setShowDiscoveryModal(false)} onAddRepo={addRepo} />
      {renderPage()}
    </div>
  );
}

export default App;
