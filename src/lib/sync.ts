import { invoke } from "@tauri-apps/api/core";
import type {
  DeviceIdentity,
  SyncSettings,
  SyncSnapshot,
  WorkSession,
  WorkspaceEvent,
  WorkspaceEventType,
} from "../types";

const IDENTITY_KEY = "axiom-workspace:device-identity";
const SETTINGS_KEY = "axiom-workspace:sync-settings";
const EVENTS_KEY = "axiom-workspace:events";

export interface SyncRepoValidation {
  ok: boolean;
  message: string;
  path: string;
}

export interface ReadSyncEventsResult {
  events: WorkspaceEvent[];
  skipped: number;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultDeviceName(): string {
  const platform = navigator.platform?.trim();
  return platform ? `Axiom ${platform}` : "Axiom device";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
    typeof value.type === "string" &&
    [
      "session_created",
      "session_ended",
      "session_updated",
      "lock_created",
      "lock_released",
      "note_added",
    ].includes(value.type) &&
    typeof value.deviceId === "string" &&
    typeof value.userName === "string" &&
    typeof value.createdAt === "string" &&
    value.version === 1 &&
    "payload" in value
  );
}

export function loadDeviceIdentity(): DeviceIdentity {
  try {
    const stored = localStorage.getItem(IDENTITY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<DeviceIdentity>;
      if (
        typeof parsed.deviceId === "string" &&
        typeof parsed.deviceName === "string" &&
        typeof parsed.userName === "string"
      ) {
        return parsed as DeviceIdentity;
      }
    }
  } catch {
    // Fall through to a fresh local identity.
  }

  const identity: DeviceIdentity = {
    deviceId: createId(),
    deviceName: defaultDeviceName(),
    userName: "Aidan",
  };
  saveDeviceIdentity(identity);
  return identity;
}

export function saveDeviceIdentity(identity: DeviceIdentity): void {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // The current in-memory identity still works if storage is unavailable.
  }
}

export function loadSyncSettings(): SyncSettings {
  const identity = loadDeviceIdentity();

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<SyncSettings>;
      return {
        identity,
        syncRepoPath:
          typeof parsed.syncRepoPath === "string" ? parsed.syncRepoPath : "",
        autoSyncEnabled: false,
      };
    }
  } catch {
    // Use defaults when settings are malformed.
  }

  return {
    identity,
    syncRepoPath: "",
    autoSyncEnabled: false,
  };
}

export function saveSyncSettings(settings: SyncSettings): void {
  saveDeviceIdentity(settings.identity);
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        syncRepoPath: settings.syncRepoPath,
        autoSyncEnabled: false,
      }),
    );
  } catch {
    // Keep the current settings in memory.
  }
}

export function loadEvents(): WorkspaceEvent[] {
  try {
    const stored = localStorage.getItem(EVENTS_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isWorkspaceEvent) : [];
  } catch {
    return [];
  }
}

export function saveEvents(events: WorkspaceEvent[]): void {
  const uniqueEvents = Array.from(
    new Map(events.filter(isWorkspaceEvent).map((event) => [event.id, event]))
      .values(),
  ).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(uniqueEvents));
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
    createdAt: new Date().toISOString(),
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
    if (typeof sessionId !== "string" || typeof endedAt !== "string") {
      return sessions;
    }
    return sessions.map((session) =>
      session.id === sessionId
        ? { ...session, status: "ended" as const, endedAt }
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
  return events
    .filter(isWorkspaceEvent)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .reduce(applyWorkspaceEvent, sessions);
}

export function buildSnapshotFromEvents(
  events: WorkspaceEvent[],
  identity: DeviceIdentity,
  baseSessions: WorkSession[] = [],
): SyncSnapshot {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    device: identity,
    sessions: applyWorkspaceEvents(baseSessions, events),
    events: events.filter(isWorkspaceEvent),
  };
}

export function buildSnapshot(
  sessions: WorkSession[],
  events: WorkspaceEvent[],
  identity: DeviceIdentity,
): SyncSnapshot {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    device: identity,
    sessions,
    events,
  };
}

export function parseImportedState(input: string): {
  sessions: WorkSession[];
  events: WorkspaceEvent[];
} {
  const parsed = JSON.parse(input);
  if (Array.isArray(parsed)) {
    return { sessions: parsed.filter(isWorkSession), events: [] };
  }
  if (!isObject(parsed)) {
    return { sessions: [], events: [] };
  }

  const sessions = Array.isArray(parsed.sessions)
    ? parsed.sessions.filter(isWorkSession)
    : [];
  const events = Array.isArray(parsed.events)
    ? parsed.events.filter(isWorkspaceEvent)
    : [];
  return { sessions, events };
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function validateSyncRepo(
  path: string,
): Promise<SyncRepoValidation> {
  return invoke<SyncRepoValidation>("validate_sync_repo", { path });
}

export async function writeSyncEvent(
  path: string,
  event: WorkspaceEvent,
): Promise<string> {
  return invoke<string>("write_sync_event", { path, event });
}

export async function readSyncEvents(
  path: string,
): Promise<ReadSyncEventsResult> {
  const result = await invoke<ReadSyncEventsResult>("read_sync_events", { path });
  return {
    events: result.events.filter(isWorkspaceEvent),
    skipped: result.skipped,
  };
}
