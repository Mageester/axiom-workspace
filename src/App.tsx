import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BoardColumnId,
  DeviceIdentity,
  LiveRepo,
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
import { Dashboard } from "./pages/Dashboard";
import { ActivityPage } from "./pages/ActivityPage";
import { ReposPage } from "./pages/ReposPage";
import { useRepos } from "./hooks/useRepos";
import { SessionsPage } from "./pages/SessionsPage";
import { LocksPage } from "./pages/LocksPage";
import { BoardPage } from "./pages/BoardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import {
  createSession,
  endSession,
  getActiveSessions,
  getRecentEndedSessions,
  loadSessions,
  saveSessions,
  updateSessionNotes,
  type CreateSessionInput,
} from "./lib/sessions";
import {
  applyBoardEvents,
  createWorkCard,
  loadCards,
  saveCards,
  updateWorkCard,
  type CreateWorkCardInput,
  type WorkCardPatch,
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

const APP_VERSION = "1.1.0";
const FOCUS_AUTO_SYNC_MS = 2 * 60 * 1000;
const FOCUSED_SYNC_MS = 30 * 1000;
const BLURRED_SYNC_MS = 180 * 1000;
const SYNC_RETRY_DELAYS_MS = [5000, 30_000, 120_000];

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

function formatEventDescription(event: WorkspaceEvent): string {
  const payload = event.payload as Record<string, unknown>;
  switch (event.type) {
    case "session_created": {
      const s = payload.session as { repoName?: string } | undefined;
      return `Started session on ${s?.repoName || "unknown repo"}`;
    }
    case "session_ended": {
      const note = payload.endNote as string | undefined;
      return note ? `Ended session — ${note}` : "Ended session";
    }
    case "board_card_created": {
      const c = payload.card as { title?: string } | undefined;
      return `Created card: ${c?.title || "untitled"}`;
    }
    case "board_card_updated": {
      const c = payload.card as { title?: string } | undefined;
      return `Updated card: ${c?.title || "untitled"}`;
    }
    case "sync_completed":
      return "Sync completed";
    case "repo_refreshed": {
      const path = payload.repoPath as string | undefined;
      return path === "all" ? "Refreshed all repos" : `Refreshed ${path || "repo"}`;
    }
    default:
      return event.type.replace(/_/g, " ");
  }
}

function App() {
  const [activeNav, setActiveNav] = useState<NavPage>("dashboard");
  const [sessions, setSessions] = useState<WorkSession[]>(() => loadSessions());
  const [cards, setCards] = useState<WorkCard[]>(() => loadCards());
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
  const [repoNicknames, setRepoNicknames] = useState<Record<string, string>>(
    () => loadRepoNicknames(),
  );
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupChecking, setSetupChecking] = useState(false);
  const [setupMessage, setSetupMessage] = useState("");
  const [setupError, setSetupError] = useState("");
  const [gitVersion, setGitVersion] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [pullingPaths, setPullingPaths] = useState<Set<string>>(new Set());
  const [_widgetCreated, setWidgetCreated] = useState(false);
  const trayInitializedRef = useRef(false);
  const prevSessionIdsRef = useRef<Set<string>>(new Set());
  const syncInFlightRef = useRef(false);
  const autoSyncTimerRef = useRef<number | null>(null);
  const syncRetryTimerRef = useRef<number | null>(null);
  const syncRetryCountRef = useRef(0);
  const sessionsRef = useRef(sessions);
  const cardsRef = useRef(cards);
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

  const activeSessions = useMemo(
    () => getActiveSessions(sessions),
    [sessions],
  );
  const recentEndedSessions = useMemo(
    () => getRecentEndedSessions(sessions),
    [sessions],
  );

  // Tray widget state — split into independent memos to avoid cross-triggering
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
    const columnCounts: Record<BoardColumnId, number> = {
      inbox: 0, ready: 0, in_progress: 0, blocked: 0, review: 0, done: 0,
    };
    let assignedToYou = 0;
    for (const card of cards) {
      columnCounts[card.column] = (columnCounts[card.column] || 0) + 1;
      if (card.assignee === "you" || card.createdBy === setupState.identity.userName) {
        assignedToYou++;
      }
    }
    return { ...columnCounts, assignedToYou };
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

  const notificationsInitializedRef = useRef(false);

  // Broadcast widget state to separate widget window whenever it changes
  useEffect(() => {
    void broadcastWidgetState(trayWidgetState);
  }, [trayWidgetState]);

  // Session change detection — broadcast notifications to widget window
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

  // Initialize tray icon + widget window + minimize-to-tray
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

    void createWidgetWindow().then(() => setWidgetCreated(true));

    // Listen for events from widget window
    const unlisteners: (() => void)[] = [];
    void (async () => {
      const u1 = await listen("widget:sync-request", () => {
        void handleSyncNow(false);
      });
      unlisteners.push(u1);

      const u2 = await listen("widget:open-main", () => {
        void openMainWindow();
      });
      unlisteners.push(u2);
    })();

    // Hide to tray on close instead of quitting
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupState.setupComplete]);

  // Update tray tooltip with session info
  useEffect(() => {
    if (!trayInitializedRef.current) return;
    const count = activeSessions.length;
    const tooltip = count > 0
      ? `Axiom — ${count} active session${count !== 1 ? "s" : ""}`
      : "Axiom Workspace";
    void updateTrayTooltip(tooltip);
  }, [activeSessions.length]);

  useEffect(() => {
    setChecklist(createChecklist(setupState));
  }, [setupState]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    setupStateRef.current = setupState;
  }, [setupState]);

  useEffect(() => {
    syncSettingsRef.current = syncSettings;
  }, [syncSettings]);

  useEffect(() => {
    void runSetupCheck(false);
    // Run once on startup; setupState changes are handled by direct updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (autoSyncTimerRef.current !== null) {
        window.clearTimeout(autoSyncTimerRef.current);
      }
      if (syncRetryTimerRef.current !== null) {
        window.clearTimeout(syncRetryTimerRef.current);
      }
    };
  }, []);

  // Auto-fill identity from OS on first launch.
  useEffect(() => {
    if (identityAutoFilledRef.current) return;
    const current = setupStateRef.current.identity;
    const needsUser = !current.userName.trim();
    const needsDevice =
      !current.deviceName.trim() ||
      current.deviceName.trim() === "Axiom Device" ||
      current.deviceName.trim().startsWith("Axiom ");
    if (!needsUser && !needsDevice) {
      identityAutoFilledRef.current = true;
      return;
    }
    identityAutoFilledRef.current = true;
    void (async () => {
      try {
        const detected = await getSystemIdentity();
        const next: DeviceIdentity = {
          ...current,
          userName: needsUser && detected.userName
            ? detected.userName
            : current.userName,
          deviceName: needsDevice && detected.hostName
            ? detected.hostName
            : current.deviceName,
        };
        if (
          next.userName !== current.userName ||
          next.deviceName !== current.deviceName
        ) {
          persistIdentity(next);
        }
      } catch {
        // Fall back silently; user can still edit manually.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-connect when prerequisites are ready.
  useEffect(() => {
    if (setupState.setupComplete) return;
    if (autoConnectAttemptedRef.current || setupInFlightRef.current) return;
    if (setupBusy || setupChecking) return;
    const identity = setupState.identity;
    if (!identity.userName.trim() || !identity.deviceName.trim()) return;
    const gitItem = checklist.find((item) => item.key === "git");
    if (!gitItem || gitItem.status !== "complete") return;
    autoConnectAttemptedRef.current = true;
    void handleConnectWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    setupState.setupComplete,
    setupState.identity.userName,
    setupState.identity.deviceName,
    checklist,
    setupBusy,
    setupChecking,
  ]);

  // Auto-discover and add Axiom repos after first successful setup.
  useEffect(() => {
    if (!setupState.setupComplete) return;
    if (autoAddReposAttemptedRef.current) return;
    if (loadRepoPaths().length > 0) {
      autoAddReposAttemptedRef.current = true;
      return;
    }
    autoAddReposAttemptedRef.current = true;
    void (async () => {
      try {
        const discovered = await discoverLocalRepos();
        const filtered = filterDiscoverableRepos(discovered);
        const recommended = filtered.filter(
          (repo) => repo.confidenceScore >= 90 || Boolean(getRepoProfile(repo.name)),
        );
        for (const repo of recommended) {
          try {
            await addRepo(repo.path);
          } catch {
            // Skip any repo that fails to add; user can do it manually later.
          }
        }
      } catch {
        // Discovery may fail on locked-down machines; ignore silently.
      }
    })();
  }, [setupState.setupComplete, addRepo]);

  // Periodic update check (every 6 hours + on startup).
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const result = await checkForUpdate(APP_VERSION);
      if (!cancelled && result && result.available) {
        setUpdateInfo(result);
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 6 * 60 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!setupState.setupComplete || !syncSettings.autoSyncEnabled) {
      return;
    }
    if (!syncSettings.lastSyncAt) {
      void handleSyncNow(true);
      return;
    }
    const lastMs = new Date(syncSettings.lastSyncAt).getTime();
    if (!Number.isFinite(lastMs) || Date.now() - lastMs > FOCUS_AUTO_SYNC_MS) {
      void handleSyncNow(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupState.setupComplete]);

  useEffect(() => {
    if (!setupState.setupComplete || !syncSettings.autoSyncEnabled) {
      return;
    }
    function onFocus() {
      const last = syncSettingsRef.current.lastSyncAt;
      const lastMs = last ? new Date(last).getTime() : 0;
      if (
        !syncInFlightRef.current &&
        (!Number.isFinite(lastMs) || Date.now() - lastMs > FOCUS_AUTO_SYNC_MS)
      ) {
        void handleSyncNow(true);
      }
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupState.setupComplete, syncSettings.autoSyncEnabled]);

  useEffect(() => {
    if (!setupState.setupComplete || !syncSettings.autoSyncEnabled) {
      return;
    }
    // Tick every 15s; pick threshold based on focus state.
    const timer = window.setInterval(() => {
      if (syncInFlightRef.current) return;
      const focused =
        typeof document !== "undefined" ? document.hasFocus() : true;
      const threshold = focused ? FOCUSED_SYNC_MS : BLURRED_SYNC_MS;
      const last = syncSettingsRef.current.lastSyncAt;
      const lastMs = last ? new Date(last).getTime() : 0;
      if (!Number.isFinite(lastMs) || Date.now() - lastMs >= threshold) {
        void handleSyncNow(true);
      }
    }, 15_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    setupState.setupComplete,
    syncSettings.autoSyncEnabled,
  ]);

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
    if (setupCheckInFlightRef.current || setupInFlightRef.current) {
      return;
    }
    setupCheckInFlightRef.current = true;
    setSetupChecking(true);
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
      setGitVersion(git.version || git.message || "");
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
    } finally {
      setupCheckInFlightRef.current = false;
      setSetupChecking(false);
    }
  }

  async function handleConnectWorkspace() {
    if (setupInFlightRef.current) {
      return;
    }
    const identity = setupState.identity;
    if (!identity.userName.trim() || !identity.deviceName.trim()) {
      setSetupError("Enter your name and device name, then connect.");
      updateChecklistItem("identity", {
        status: "needs_action",
        message: "Enter your name and a friendly device name.",
      });
      return;
    }

    setupInFlightRef.current = true;
    setSetupBusy(true);
    setSetupMessage("");
    setSetupError("");
    try {
      updateChecklistItem("git", { status: "checking", message: "Checking Git." });
      const git = await checkGitInstalled();
      setGitVersion(git.version || git.message || "");
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
        autoSyncEnabled: true,
      });
      setSetupMessage(setup.message);
      setActiveNav("dashboard");
      setShowDiscoveryModal(true);
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
      setupInFlightRef.current = false;
      setSetupBusy(false);
    }
  }

  function startSession(input: CreateSessionInput): WorkSession {
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
    scheduleAutoSync();
    return session;
  }

  function createCard(input: CreateWorkCardInput) {
    const card = createWorkCard({
      ...input,
      createdBy: input.createdBy || setupState.identity.userName,
    });
    const event = createWorkspaceEvent(
      "board_card_created",
      { card },
      setupState.identity,
    );
    setCards((prev) => {
      const next = [card, ...prev];
      saveCards(next);
      return next;
    });
    setEvents((prev) => {
      const next = dedupeEvents([...prev, event]);
      saveEvents(next);
      return next;
    });
    scheduleAutoSync();
  }

  function updateCard(cardId: string, patch: WorkCardPatch) {
    setCards((prev) => {
      const next = updateWorkCard(prev, cardId, patch);
      saveCards(next);
      const card = next.find((item) => item.id === cardId);
      if (card) {
        const event = createWorkspaceEvent(
          "board_card_updated",
          { card },
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
    scheduleAutoSync();
  }

  function startSessionFromCard(cardId: string, input: CreateSessionInput) {
    const session = startSession(input);
    updateCard(cardId, {
      column: "in_progress",
      linkedSessionId: session.id,
      repoId: session.repoId,
      repoName: session.repoName,
      repoPath: session.repoPath,
      branch: session.branch,
      paths: session.targets.map((target) => target.value),
    });
  }

  function finishSession(sessionId: string, endNote?: string) {
    setSessions((prev) => {
      const next = endSession(prev, sessionId, endNote);
      saveSessions(next);
      const endedSession = next.find((session) => session.id === sessionId);
      if (endedSession?.endedAt) {
        const event = createWorkspaceEvent(
          "session_ended",
          { sessionId, endedAt: endedSession.endedAt, endNote: endedSession.endNote },
          setupState.identity,
        );
        setEvents((eventPrev) => {
          const eventNext = dedupeEvents([...eventPrev, event]);
          saveEvents(eventNext);
          return eventNext;
        });
        scheduleAutoSync();
      }
      return next;
    });
  }

  function handleUpdateSessionNotes(sessionId: string, notes: string) {
    setSessions((prev) => {
      const next = updateSessionNotes(prev, sessionId, notes);
      saveSessions(next);
      const session = next.find((item) => item.id === sessionId);
      const event = createWorkspaceEvent(
        "session_updated",
        session ? { session } : { sessionId, notes },
        setupState.identity,
      );
      setEvents((eventPrev) => {
        const eventNext = dedupeEvents([...eventPrev, event]);
        saveEvents(eventNext);
        return eventNext;
      });
      return next;
    });
    scheduleAutoSync();
  }

  function scheduleAutoSync() {
    if (
      !setupStateRef.current.setupComplete ||
      !syncSettingsRef.current.autoSyncEnabled ||
      !syncSettingsRef.current.syncLocalPath.trim()
    ) {
      return;
    }

    if (autoSyncTimerRef.current !== null) {
      window.clearTimeout(autoSyncTimerRef.current);
    }

    autoSyncTimerRef.current = window.setTimeout(() => {
      autoSyncTimerRef.current = null;
      if (!syncInFlightRef.current) {
        void handleSyncNow(true);
      }
    }, 5000);
  }

  function handleRenameRepo(path: string, name: string) {
    const updated = setRepoNickname(path, name);
    setRepoNicknames(updated);
  }

  function emitEvent(type: Parameters<typeof createWorkspaceEvent>[0], payload: unknown) {
    const event = createWorkspaceEvent(type, payload, setupState.identity);
    setEvents((prev) => {
      const next = dedupeEvents([...prev, event]);
      saveEvents(next);
      return next;
    });
  }

  async function handleRefreshRepo(path: string) {
    await refreshRepo(path);
    emitEvent("repo_refreshed", { repoPath: path });
  }

  async function handleRefreshAll() {
    await refreshAll();
    emitEvent("repo_refreshed", { repoPath: "all" });
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

  async function handleSyncNow(isAutomatic = false) {
    if (syncInFlightRef.current) {
      return;
    }

    syncInFlightRef.current = true;

    try {
      const currentSetupState = setupStateRef.current;
      const currentSyncSettings = syncSettingsRef.current;
      const currentSessions = sessionsRef.current;
      const currentCards = cardsRef.current;
      const currentEvents = eventsRef.current;

      if (!currentSetupState.setupComplete || !currentSyncSettings.syncLocalPath.trim()) {
        const message =
          "Axiom is local-only until the team sync workspace is connected.";
        setSyncStatus("error");
        persistSyncSettings({
          ...currentSyncSettings,
          lastSyncStatus: "Error",
          lastSyncError: isAutomatic ? "Auto-sync failed. Click Sync Now." : message,
        });
        return;
      }

      setSyncStatus("checking");
      persistSyncSettings({
        ...currentSyncSettings,
        lastSyncStatus: "Checking",
        lastSyncError: undefined,
      });

      setSyncStatus("writing_local_events");
      const snapshot = buildSnapshotFromSessions(
        currentSessions,
        currentEvents,
        currentSetupState.identity,
        currentCards,
      );
      const result = await syncNow(
        currentSyncSettings.syncLocalPath,
        currentSyncSettings.syncRepoUrl,
        currentEvents,
        snapshot,
      );

      setSyncStatus("merging");
      const mergedEvents = dedupeEvents([...currentEvents, ...result.events]);
      const mergedSessions = applyWorkspaceEvents(currentSessions, mergedEvents);
      const mergedCards = applyBoardEvents(currentCards, mergedEvents);
      updateEvents(mergedEvents);
      updateSessions(mergedSessions);
      setCards(mergedCards);
      saveCards(mergedCards);

      const nextSettings: SyncSettings = {
        ...currentSyncSettings,
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: result.message,
        lastSyncError: undefined,
        lastSyncDurationMs: result.durationMs,
        lastSyncGitCommandCount: result.gitCommandCount,
        lastSyncCommandError: result.lastCommandError,
      };
      persistSyncSettings(nextSettings);
      emitEvent("sync_completed", {
        durationMs: result.durationMs,
        gitCommandCount: result.gitCommandCount,
      });
      setSyncStatus("complete");
      syncRetryCountRef.current = 0;
      if (syncRetryTimerRef.current !== null) {
        window.clearTimeout(syncRetryTimerRef.current);
        syncRetryTimerRef.current = null;
      }
    } catch (error) {
      const message = formatError(
        error,
        "Sync could not upload changes. Check internet and GitHub login.",
      );
      if (isAutomatic && syncRetryCountRef.current < SYNC_RETRY_DELAYS_MS.length) {
        // Silent retry with backoff; keep last known sync status visible.
        const delay = SYNC_RETRY_DELAYS_MS[syncRetryCountRef.current];
        syncRetryCountRef.current += 1;
        persistSyncSettings({
          ...syncSettingsRef.current,
          lastSyncCommandError: message,
        });
        setSyncStatus("idle");
        if (syncRetryTimerRef.current !== null) {
          window.clearTimeout(syncRetryTimerRef.current);
        }
        syncRetryTimerRef.current = window.setTimeout(() => {
          syncRetryTimerRef.current = null;
          if (!syncInFlightRef.current) {
            void handleSyncNow(true);
          }
        }, delay);
      } else {
        syncRetryCountRef.current = 0;
        persistSyncSettings({
          ...syncSettingsRef.current,
          lastSyncStatus: "Error",
          lastSyncError: isAutomatic
            ? "Sync paused. Axiom will retry next time the app is active."
            : message,
          lastSyncCommandError: message,
        });
        setSyncStatus("error");
      }
    } finally {
      syncInFlightRef.current = false;
    }
  }

  function handleDismissSuggestion(id: string) {
    const dismissed = Array.from(
      new Set([...(syncSettings.dismissedSuggestions ?? []), id]),
    );
    persistSyncSettings({
      ...syncSettings,
      dismissedSuggestions: dismissed,
    });
  }

  function handleResetDismissedSuggestions() {
    persistSyncSettings({
      ...syncSettings,
      dismissedSuggestions: [],
    });
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

  function handleResetSessionsAndLocks() {
    setSessions([]);
    setCards([]);
    setEvents([]);
    saveSessions([]);
    saveCards([]);
    saveEvents([]);
    setSyncStatus("idle");
    persistSyncSettings({
      ...syncSettings,
      lastSyncStatus: "Local sessions and locks were reset.",
      lastSyncError: undefined,
    });
  }

  function handleResetSyncState() {
    const reset = resetSyncState();
    setSetupState(reset.setupState);
    setSyncSettings(reset.syncSettings);
    setEvents([]);
    setCards([]);
    setChecklist(createChecklist(reset.setupState));
    setActiveNav("dashboard");
    setSetupMessage("");
    setSetupError("");
    setSyncStatus("idle");
  }

  function handleFullLocalReset() {
    clearAxiomLocalStorage();
    setSessions([]);
    setCards([]);
    setEvents([]);
    window.location.reload();
  }

  async function handlePullRepo(path: string) {
    setPullingPaths((prev) => new Set(prev).add(path));
    try {
      await invokePullRepo(path);
      await refreshRepo(path);
    } catch {
      // Pull error is visible via repo status after refresh
      await refreshRepo(path);
    } finally {
      setPullingPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  }

  async function handlePullAll() {
    const behind = repos.filter((r) => r.behind > 0);
    if (behind.length === 0) return;
    for (const repo of behind) {
      try {
        setPullingPaths((prev) => new Set(prev).add(repo.path));
        await invokePullRepo(repo.path);
      } catch {
        // Individual pull errors are non-fatal for pull-all
      } finally {
        setPullingPaths((prev) => {
          const next = new Set(prev);
          next.delete(repo.path);
          return next;
        });
      }
    }
    await refreshAll();
  }

  function getRepoSessions(repo: LiveRepo): WorkSession[] {
    return activeSessions.filter((session) => session.repoId === repo.id);
  }

  function renderPage() {
    if (activeNav === "dashboard") {
      return (
        <Dashboard
          repos={repos}
          repoNicknames={repoNicknames}
          cards={cards}
          activeSessions={activeSessions}
          recentEvents={events}
          loading={loading}
          refreshingPaths={refreshingPaths}
          onRefreshAll={handleRefreshAll}
          onRefreshRepo={handleRefreshRepo}
          onAddRepo={addRepo}
          onRemoveRepo={removeRepo}
          onRenameRepo={handleRenameRepo}
          onStartSession={startSession}
          onFinishSession={finishSession}
          getRepoSessions={getRepoSessions}
          defaultUserName={setupState.identity.userName}
          setupState={setupState}
          syncSettings={syncSettings}
          syncStatus={syncStatus}
          onSyncNow={handleSyncNow}
          onDismissSuggestion={handleDismissSuggestion}
          onPullAll={handlePullAll}
          onOpenBoard={() => setActiveNav("board")}
          updateInfo={updateDismissed ? null : updateInfo}
          onDismissUpdate={() => setUpdateDismissed(true)}
        />
      );
    }
    if (activeNav === "sessions") {
      return (
        <SessionsPage
          activeSessions={activeSessions}
          recentEndedSessions={recentEndedSessions}
          onEndSession={finishSession}
          onUpdateNotes={handleUpdateSessionNotes}
        />
      );
    }
    if (activeNav === "board") {
      return (
        <BoardPage
          cards={cards}
          repos={repos}
          activeSessions={activeSessions}
          defaultUserName={setupState.identity.userName}
          onCreateCard={createCard}
          onUpdateCard={updateCard}
          onStartSessionFromCard={startSessionFromCard}
        />
      );
    }
    if (activeNav === "locks") {
      return <LocksPage activeSessions={activeSessions} />;
    }
    if (activeNav === "repos") {
      return (
        <ReposPage
          repos={repos}
          repoNicknames={repoNicknames}
          activeSessions={activeSessions}
          loading={loading}
          refreshingPaths={refreshingPaths}
          pullingPaths={pullingPaths}
          onRefreshAll={handleRefreshAll}
          onRefreshRepo={handleRefreshRepo}
          onAddRepo={addRepo}
          onRemoveRepo={removeRepo}
          onRenameRepo={handleRenameRepo}
          onStartSession={startSession}
          onPullRepo={handlePullRepo}
          getRepoSessions={getRepoSessions}
          defaultUserName={setupState.identity.userName}
        />
      );
    }
    if (activeNav === "activity") {
      return (
        <ActivityPage
          events={events}
          syncSettings={syncSettings}
          repoDiagnostics={repoDiagnostics}
        />
      );
    }
    if (activeNav === "settings") {
      return (
        <SettingsPage
          setupState={setupState}
          checklist={checklist}
          settings={syncSettings}
          syncStatus={syncStatus}
          eventCount={events.length}
          appVersion={APP_VERSION}
          gitVersion={gitVersion}
          repoCount={repos.length}
          activeSessionCount={activeSessions.length}
          repoDiagnostics={repoDiagnostics}
          onIdentityChange={persistIdentity}
          onSetupChange={persistSetupState}
          onSettingsChange={persistSyncSettings}
          onValidateSetup={() => runSetupCheck(true)}
          onSyncNow={handleSyncNow}
          onResetSetup={handleResetSetup}
          onResetSessionsAndLocks={handleResetSessionsAndLocks}
          onResetSyncState={handleResetSyncState}
          onFullLocalReset={handleFullLocalReset}
          onResetDismissedSuggestions={handleResetDismissedSuggestions}
        />
      );
    }
    return null;
  }

  if (!setupState.setupComplete) {
    return (
      <OnboardingPage
        identity={setupState.identity}
        checklist={checklist}
        busy={setupBusy || setupChecking}
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
      <Sidebar
        activeItem={activeNav}
        onNavigate={setActiveNav}
        setupComplete={setupState.setupComplete}
        activeSessionCount={activeSessions.length}
        syncStatus={syncStatus}
        syncSettings={syncSettings}
      />
      <RepoDiscoveryModal
        open={showDiscoveryModal}
        onClose={() => setShowDiscoveryModal(false)}
        onAddRepo={addRepo}
      />
      {renderPage()}
    </div>
  );
}

export default App;
