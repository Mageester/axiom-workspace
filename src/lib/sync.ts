import { invoke } from "@tauri-apps/api/core";
import type {
  DeviceIdentity,
  SetupState,
  SyncSettings,
  SyncSnapshot,
  WorkSession,
  WorkspaceEvent,
  WorkspaceEventType,
} from "../types";

const SETUP_KEY = "axiom-workspace:setup-state";
const IDENTITY_KEY = "axiom-workspace:device-identity";
const SETTINGS_KEY = "axiom-workspace:sync-settings";
const EVENTS_KEY = "axiom-workspace:events";
const REPO_PATHS_KEY = "axiom-repo-paths";
const REPO_NICKNAMES_KEY = "axiom-repo-nicknames";
const IGNORED_DISCOVERY_KEY = "axiom-workspace:ignored-discovered-repos";
const DEFAULT_DISCOVERY_PATHS = [
  "%USERPROFILE%\\Desktop",
  "%USERPROFILE%\\Documents",
  "%USERPROFILE%\\OneDrive\\Desktop",
  "%USERPROFILE%\\OneDrive\\Documents",
  "%USERPROFILE%\\source\\repos",
  "%USERPROFILE%\\OneDrive\\Desktop\\Repos",
  "%USERPROFILE%\\Desktop\\Repos",
];

export const DEFAULT_SYNC_REPO_URL =
  "https://github.com/Mageester/axiom-workspace-sync";
export const GIT_FOR_WINDOWS_URL = "https://git-scm.com/download/win";

export interface GitInstallCheck {
  installed: boolean;
  version?: string;
  message: string;
}

export interface GithubAccessValidation {
  ok: boolean;
  category:
    | "ready"
    | "git_missing"
    | "no_access"
    | "repo_not_found"
    | "network_error"
    | "unknown_error";
  message: string;
}

export interface SyncRepoSetupResult {
  ok: boolean;
  syncLocalPath: string;
  message: string;
  recovered: boolean;
}

export interface SyncRepoValidation {
  ok: boolean;
  message: string;
  path: string;
}

export interface SyncNowResult {
  ok: boolean;
  message: string;
  events: WorkspaceEvent[];
  skipped: number;
  committed: boolean;
  durationMs: number;
  gitCommandCount: number;
  lastCommandError?: string | null;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeNow(): string {
  return new Date().toISOString();
}

function defaultDeviceName(): string {
  const platform = navigator.platform?.trim();
  return platform ? `Axiom ${platform}` : "Axiom Device";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDeviceIdentity(value: unknown): value is DeviceIdentity {
  return (
    isObject(value) &&
    typeof value.deviceId === "string" &&
    typeof value.deviceName === "string" &&
    typeof value.userName === "string" &&
    typeof value.createdAt === "string"
  );
}

function isWorkSession(value: unknown): value is WorkSession {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.repoId === "string" &&
    typeof value.repoName === "string" &&
    typeof value.repoPath === "string" &&
    typeof value.userName === "string" &&
    typeof value.title === "string" &&
    (value.notes === undefined || typeof value.notes === "string") &&
    (value.branch === undefined || typeof value.branch === "string") &&
    Array.isArray(value.targets) &&
    value.targets.every(
      (target) =>
        isObject(target) &&
        typeof target.id === "string" &&
        (target.type === "file" ||
          target.type === "folder" ||
          target.type === "area") &&
        typeof target.value === "string" &&
        (target.label === undefined || typeof target.label === "string"),
    ) &&
    (value.status === "active" || value.status === "ended") &&
    typeof value.startedAt === "string" &&
    (value.endedAt === undefined || typeof value.endedAt === "string")
  );
}

export function isWorkspaceEvent(value: unknown): value is WorkspaceEvent {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    [
      "session_created",
      "session_ended",
      "session_updated",
      "note_added",
      "snapshot_created",
      "sync_completed",
      "repo_refreshed",
    ].includes(String(value.type)) &&
    typeof value.deviceId === "string" &&
    typeof value.userName === "string" &&
    typeof value.createdAt === "string" &&
    value.version === 1 &&
    "payload" in value
  );
}

export function createDefaultIdentity(): DeviceIdentity {
  return {
    deviceId: createId(),
    deviceName: defaultDeviceName(),
    userName: "",
    createdAt: safeNow(),
  };
}

export function loadDeviceIdentity(): DeviceIdentity {
  try {
    const stored = localStorage.getItem(IDENTITY_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    if (isDeviceIdentity(parsed)) {
      return parsed;
    }

    if (isObject(parsed) && typeof parsed.deviceId === "string") {
      const migrated: DeviceIdentity = {
        deviceId: parsed.deviceId,
        deviceName:
          typeof parsed.deviceName === "string"
            ? parsed.deviceName
            : defaultDeviceName(),
        userName: typeof parsed.userName === "string" ? parsed.userName : "",
        createdAt: safeNow(),
      };
      saveDeviceIdentity(migrated);
      return migrated;
    }
  } catch {
    // Corrupt identity data is replaced with a fresh safe identity.
  }

  const identity = createDefaultIdentity();
  saveDeviceIdentity(identity);
  return identity;
}

export function saveDeviceIdentity(identity: DeviceIdentity): void {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // Keep the current in-memory identity if browser storage is unavailable.
  }
}

export function createDefaultSetupState(): SetupState {
  return {
    setupComplete: false,
    identity: loadDeviceIdentity(),
    syncRepoUrl: DEFAULT_SYNC_REPO_URL,
    syncLocalPath: "",
    lastSetupCheckAt: null,
  };
}

export function loadSetupState(): SetupState {
  const identity = loadDeviceIdentity();

  try {
    const stored = localStorage.getItem(SETUP_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    if (isObject(parsed)) {
      return {
        setupComplete: parsed.setupComplete === true,
        identity,
        syncRepoUrl:
          typeof parsed.syncRepoUrl === "string" && parsed.syncRepoUrl.trim()
            ? parsed.syncRepoUrl
            : DEFAULT_SYNC_REPO_URL,
        syncLocalPath:
          typeof parsed.syncLocalPath === "string" ? parsed.syncLocalPath : "",
        lastSetupCheckAt:
          typeof parsed.lastSetupCheckAt === "string"
            ? parsed.lastSetupCheckAt
            : null,
        lastError:
          typeof parsed.lastError === "string" ? parsed.lastError : undefined,
      };
    }
  } catch {
    // Malformed setup state should never block the app from recovering.
  }

  return createDefaultSetupState();
}

export function saveSetupState(state: SetupState): void {
  saveDeviceIdentity(state.identity);
  try {
    localStorage.setItem(
      SETUP_KEY,
      JSON.stringify({
        setupComplete: state.setupComplete,
        syncRepoUrl: state.syncRepoUrl,
        syncLocalPath: state.syncLocalPath,
        lastSetupCheckAt: state.lastSetupCheckAt,
        lastError: state.lastError,
      }),
    );
  } catch {
    // Current state remains usable in memory.
  }
}

export function resetSetupState(): SetupState {
  const identity = createDefaultIdentity();
  const reset: SetupState = {
    setupComplete: false,
    identity,
    syncRepoUrl: DEFAULT_SYNC_REPO_URL,
    syncLocalPath: "",
    lastSetupCheckAt: null,
  };
  saveSetupState(reset);
  saveSyncSettings(createDefaultSyncSettings(reset));
  return reset;
}

export function resetSyncState(): {
  setupState: SetupState;
  syncSettings: SyncSettings;
} {
  const identity = loadDeviceIdentity();
  const setupState: SetupState = {
    setupComplete: false,
    identity,
    syncRepoUrl: DEFAULT_SYNC_REPO_URL,
    syncLocalPath: "",
    lastSetupCheckAt: null,
    lastError:
      "Sync settings were reset. Reconnect to the team sync workspace when ready.",
  };
  const syncSettings = createDefaultSyncSettings(setupState);
  saveSetupState(setupState);
  saveSyncSettings(syncSettings);
  saveEvents([]);
  return { setupState, syncSettings };
}

export function clearAxiomLocalStorage(): void {
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && (key.startsWith("axiom-workspace:") || key === REPO_PATHS_KEY)) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(REPO_NICKNAMES_KEY);
    localStorage.removeItem(IGNORED_DISCOVERY_KEY);
  } catch {
    localStorage.removeItem(SETUP_KEY);
    localStorage.removeItem(IDENTITY_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(EVENTS_KEY);
    localStorage.removeItem(REPO_PATHS_KEY);
    localStorage.removeItem(REPO_NICKNAMES_KEY);
    localStorage.removeItem(IGNORED_DISCOVERY_KEY);
  }
}

export function createDefaultSyncSettings(
  setupState = loadSetupState(),
): SyncSettings {
  return {
    syncRepoUrl: setupState.syncRepoUrl || DEFAULT_SYNC_REPO_URL,
    syncLocalPath: setupState.syncLocalPath,
    autoSyncEnabled: true,
    syncIntervalSeconds: 180,
    autoRefreshReposEnabled: true,
    repoRefreshIntervalSeconds: 120,
    repoDiscoveryPaths: DEFAULT_DISCOVERY_PATHS,
    dismissedSuggestions: [],
  };
}

export function loadSyncSettings(): SyncSettings {
  const setupState = loadSetupState();

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    if (isObject(parsed)) {
      return {
        syncRepoUrl:
          typeof parsed.syncRepoUrl === "string" && parsed.syncRepoUrl.trim()
            ? parsed.syncRepoUrl
            : setupState.syncRepoUrl,
        syncLocalPath:
          typeof parsed.syncLocalPath === "string"
            ? parsed.syncLocalPath
            : setupState.syncLocalPath,
        autoSyncEnabled: parsed.autoSyncEnabled !== false,
        syncIntervalSeconds:
          typeof parsed.syncIntervalSeconds === "number" &&
          parsed.syncIntervalSeconds >= 60
            ? parsed.syncIntervalSeconds
            : 180,
        autoRefreshReposEnabled: parsed.autoRefreshReposEnabled !== false,
        repoRefreshIntervalSeconds:
          typeof parsed.repoRefreshIntervalSeconds === "number" &&
          parsed.repoRefreshIntervalSeconds >= 120
            ? parsed.repoRefreshIntervalSeconds
            : 120,
        repoDiscoveryPaths:
          Array.isArray(parsed.repoDiscoveryPaths) &&
          parsed.repoDiscoveryPaths.every((item) => typeof item === "string")
            ? parsed.repoDiscoveryPaths
            : DEFAULT_DISCOVERY_PATHS,
        dismissedSuggestions:
          Array.isArray(parsed.dismissedSuggestions) &&
          parsed.dismissedSuggestions.every((item) => typeof item === "string")
            ? parsed.dismissedSuggestions
            : [],
        lastSyncAt:
          typeof parsed.lastSyncAt === "string" ? parsed.lastSyncAt : undefined,
        lastSyncStatus:
          typeof parsed.lastSyncStatus === "string"
            ? parsed.lastSyncStatus
            : undefined,
        lastSyncError:
          typeof parsed.lastSyncError === "string"
            ? parsed.lastSyncError
            : undefined,
        lastSyncDurationMs:
          typeof parsed.lastSyncDurationMs === "number"
            ? parsed.lastSyncDurationMs
            : undefined,
        lastSyncGitCommandCount:
          typeof parsed.lastSyncGitCommandCount === "number"
            ? parsed.lastSyncGitCommandCount
            : undefined,
        lastSyncCommandError:
          typeof parsed.lastSyncCommandError === "string"
            ? parsed.lastSyncCommandError
            : undefined,
      };
    }
  } catch {
    // Use defaults when settings are malformed.
  }

  return createDefaultSyncSettings(setupState);
}

export function saveSyncSettings(settings: SyncSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Keep current settings in memory.
  }
}

export function loadEvents(): WorkspaceEvent[] {
  try {
    const stored = localStorage.getItem(EVENTS_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? dedupeEvents(parsed.filter(isWorkspaceEvent)) : [];
  } catch {
    return [];
  }
}

export function saveEvents(events: WorkspaceEvent[]): void {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(dedupeEvents(events)));
  } catch {
    // Events remain in memory until the next app write succeeds.
  }
}

export function createWorkspaceEvent(
  type: WorkspaceEventType,
  payload: unknown,
  identity: DeviceIdentity,
): WorkspaceEvent {
  return {
    id: createId(),
    type,
    deviceId: identity.deviceId,
    userName: identity.userName.trim() || "Unknown",
    createdAt: safeNow(),
    payload,
    version: 1,
  };
}

function mergeSession(existing: WorkSession, incoming: WorkSession): WorkSession {
  if (existing.status === "ended" && incoming.status !== "ended") {
    return existing;
  }
  if (incoming.status === "ended" && existing.status !== "ended") {
    return incoming;
  }
  const existingTime = existing.endedAt ?? existing.startedAt;
  const incomingTime = incoming.endedAt ?? incoming.startedAt;
  return incomingTime.localeCompare(existingTime) >= 0 ? incoming : existing;
}

export function mergeSessions(
  current: WorkSession[],
  incoming: WorkSession[],
): WorkSession[] {
  const byId = new Map<string, WorkSession>();
  for (const session of current.filter(isWorkSession)) {
    byId.set(session.id, session);
  }
  for (const session of incoming.filter(isWorkSession)) {
    const existing = byId.get(session.id);
    byId.set(session.id, existing ? mergeSession(existing, session) : session);
  }
  return Array.from(byId.values()).sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );
}

export function dedupeEvents(events: WorkspaceEvent[]): WorkspaceEvent[] {
  return Array.from(
    new Map(events.filter(isWorkspaceEvent).map((event) => [event.id, event]))
      .values(),
  ).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function applyWorkspaceEvent(
  sessions: WorkSession[],
  event: WorkspaceEvent,
): WorkSession[] {
  if (!isWorkspaceEvent(event) || !isObject(event.payload)) {
    return sessions;
  }

  if (event.type === "session_created") {
    const session = event.payload.session;
    return isWorkSession(session) ? mergeSessions(sessions, [session]) : sessions;
  }

  if (event.type === "session_ended") {
    const sessionId = event.payload.sessionId;
    const endedAt = event.payload.endedAt;
    const endNote = event.payload.endNote;
    if (typeof sessionId !== "string" || typeof endedAt !== "string") {
      return sessions;
    }
    return sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            status: "ended" as const,
            endedAt,
            endNote: typeof endNote === "string" ? endNote : session.endNote,
          }
        : session,
    );
  }

  if (event.type === "session_updated") {
    const session = event.payload.session;
    return isWorkSession(session) ? mergeSessions(sessions, [session]) : sessions;
  }

  return sessions;
}

export function applyWorkspaceEvents(
  sessions: WorkSession[],
  events: WorkspaceEvent[],
): WorkSession[] {
  return dedupeEvents(events).reduce(applyWorkspaceEvent, sessions);
}

export function buildSnapshotFromSessions(
  sessions: WorkSession[],
  events: WorkspaceEvent[],
  identity: DeviceIdentity,
): SyncSnapshot {
  const cleanEvents = dedupeEvents(events);
  return {
    version: 1,
    createdAt: safeNow(),
    createdByDeviceId: identity.deviceId,
    sessions: mergeSessions([], sessions),
    eventsApplied: cleanEvents.map((event) => event.id),
  };
}

export async function checkGitInstalled(): Promise<GitInstallCheck> {
  return invoke<GitInstallCheck>("check_git_installed");
}

export async function validateGithubAccess(
  syncRepoUrl: string,
): Promise<GithubAccessValidation> {
  return invoke<GithubAccessValidation>("validate_github_access", {
    syncRepoUrl,
  });
}

export async function getDefaultSyncPath(): Promise<string> {
  return invoke<string>("get_default_sync_path");
}

export async function setupSyncRepo(
  syncRepoUrl: string,
): Promise<SyncRepoSetupResult> {
  return invoke<SyncRepoSetupResult>("setup_sync_repo", { syncRepoUrl });
}

export async function validateSyncRepo(
  path: string,
  expectedRepoUrl = DEFAULT_SYNC_REPO_URL,
): Promise<SyncRepoValidation> {
  return invoke<SyncRepoValidation>("validate_sync_repo", {
    path,
    expectedRepoUrl,
  });
}

export async function validateSyncWriteAccess(
  path: string,
  deviceId: string,
  expectedRepoUrl = DEFAULT_SYNC_REPO_URL,
): Promise<SyncRepoValidation> {
  return invoke<SyncRepoValidation>("validate_sync_write_access", {
    path,
    expectedRepoUrl,
    deviceId,
  });
}

export async function ensureSyncStructure(path: string): Promise<string> {
  return invoke<string>("ensure_sync_structure", { path });
}

export async function syncNow(
  path: string,
  syncRepoUrl: string,
  events: WorkspaceEvent[],
  snapshot: SyncSnapshot,
): Promise<SyncNowResult> {
  const result = await invoke<SyncNowResult>("sync_now", {
    path,
    syncRepoUrl,
    events: dedupeEvents(events),
    snapshot,
  });
  return {
    ...result,
    events: result.events.filter(isWorkspaceEvent),
  };
}
