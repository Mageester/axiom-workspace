import type { LockTarget, SessionOverlap, WorkSession } from "../types";

const STORAGE_KEY = "axiom-workspace:sessions";

export interface CreateSessionInput {
  repoId: string;
  repoName: string;
  repoPath: string;
  userName: string;
  title: string;
  notes?: string;
  branch?: string;
  targets: LockTarget[];
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isLockTarget(value: unknown): value is LockTarget {
  if (!value || typeof value !== "object") {
    return false;
  }

  const target = value as Partial<LockTarget>;
  return (
    typeof target.id === "string" &&
    (target.type === "file" || target.type === "folder" || target.type === "area") &&
    typeof target.value === "string" &&
    target.value.trim().length > 0 &&
    (target.label === undefined || typeof target.label === "string")
  );
}

function isWorkSession(value: unknown): value is WorkSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<WorkSession>;
  return (
    typeof session.id === "string" &&
    typeof session.repoId === "string" &&
    typeof session.repoName === "string" &&
    typeof session.repoPath === "string" &&
    typeof session.userName === "string" &&
    typeof session.title === "string" &&
    (session.notes === undefined || typeof session.notes === "string") &&
    (session.endNote === undefined || typeof session.endNote === "string") &&
    (session.branch === undefined || typeof session.branch === "string") &&
    Array.isArray(session.targets) &&
    session.targets.every(isLockTarget) &&
    (session.status === "active" || session.status === "ended") &&
    typeof session.startedAt === "string" &&
    (session.endedAt === undefined || typeof session.endedAt === "string")
  );
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeTargetValue(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

export function loadSessions(): WorkSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isWorkSession);
  } catch {
    return [];
  }
}

export function saveSessions(sessions: WorkSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage can be disabled or full; the app keeps the current in-memory state.
  }
}

export function createSession(input: CreateSessionInput): WorkSession {
  return {
    id: createId(),
    repoId: input.repoId,
    repoName: input.repoName,
    repoPath: input.repoPath,
    userName: input.userName.trim(),
    title: input.title.trim(),
    notes: normalizeOptionalText(input.notes),
    branch: normalizeOptionalText(input.branch),
    targets: input.targets.map((target) => ({
      id: target.id || createId(),
      type: target.type,
      value: target.value.trim(),
      label: normalizeOptionalText(target.label),
    })),
    status: "active",
    startedAt: new Date().toISOString(),
  };
}

export function endSession(sessionId: string, endNote?: string): WorkSession[];
export function endSession(
  sessions: WorkSession[],
  sessionId: string,
  endNote?: string,
): WorkSession[];
export function endSession(
  sessionsOrSessionId: WorkSession[] | string,
  secondArg?: string,
  thirdArg?: string,
): WorkSession[] {
  const isFirstArgString = typeof sessionsOrSessionId === "string";
  const sessions = isFirstArgString ? loadSessions() : sessionsOrSessionId;
  const sessionId = isFirstArgString ? sessionsOrSessionId : secondArg;
  const endNote = isFirstArgString ? secondArg : thirdArg;

  if (!sessionId) {
    return sessions;
  }

  const endedAt = new Date().toISOString();
  const trimmedNote = endNote?.trim() || undefined;
  const next: WorkSession[] = sessions.map((session) =>
    session.id === sessionId && session.status === "active"
      ? { ...session, status: "ended" as const, endedAt, endNote: trimmedNote }
      : session,
  );

  if (isFirstArgString) {
    saveSessions(next);
  }

  return next;
}

export function updateSessionNotes(
  sessions: WorkSession[],
  sessionId: string,
  notes: string,
): WorkSession[] {
  return sessions.map((session) =>
    session.id === sessionId
      ? { ...session, notes: notes.trim() || undefined }
      : session,
  );
}

export function getActiveSessions(sessions: WorkSession[]): WorkSession[] {
  return sessions
    .filter((session) => session.status === "active")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getRecentEndedSessions(
  sessions: WorkSession[],
  limit = 12,
): WorkSession[] {
  return sessions
    .filter((session) => session.status === "ended")
    .sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""))
    .slice(0, limit);
}

function pathsOverlap(
  incomingType: LockTarget["type"],
  incomingValue: string,
  activeType: LockTarget["type"],
  activeValue: string,
): boolean {
  if (incomingValue === activeValue) {
    return true;
  }

  if (incomingType === "area" || activeType === "area") {
    return false;
  }

  if (incomingType === "folder" && activeType === "folder") {
    return (
      incomingValue.startsWith(`${activeValue}/`) ||
      activeValue.startsWith(`${incomingValue}/`)
    );
  }

  if (incomingType === "file" && activeType === "folder") {
    return incomingValue.startsWith(`${activeValue}/`);
  }

  if (incomingType === "folder" && activeType === "file") {
    return activeValue.startsWith(`${incomingValue}/`);
  }

  return false;
}

function getOverlapReason(incoming: LockTarget, active: LockTarget): string {
  if (incoming.type === "area" && active.type === "area") {
    return "Area claim already active";
  }
  if (incoming.value.trim() === active.value.trim()) {
    return "Same target already claimed";
  }
  if (incoming.type === "file" && active.type === "folder") {
    return "File is inside an active folder lock";
  }
  if (incoming.type === "folder" && active.type === "file") {
    return "Folder contains an active file lock";
  }
  return "Target overlaps an active lock";
}

function getAreaValues(target: LockTarget): string[] {
  return [target.value, target.label]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeTargetValue);
}

export function detectSessionOverlap(
  input: CreateSessionInput,
  activeSessions: WorkSession[],
): SessionOverlap[] {
  const overlaps: SessionOverlap[] = [];

  for (const session of activeSessions) {
    if (session.repoId !== input.repoId) {
      continue;
    }

    for (const incomingTarget of input.targets) {
      const incomingValue = normalizeTargetValue(incomingTarget.value);
      const incomingAreaValues = getAreaValues(incomingTarget);

      for (const activeTarget of session.targets) {
        const activeValue = normalizeTargetValue(activeTarget.value);
        const isAreaMatch =
          incomingTarget.type === "area" &&
          activeTarget.type === "area" &&
          incomingAreaValues.some((value) =>
            getAreaValues(activeTarget).includes(value),
          );

        if (
          isAreaMatch ||
          pathsOverlap(
            incomingTarget.type,
            incomingValue,
            activeTarget.type,
            activeValue,
          )
        ) {
          overlaps.push({
            sessionId: session.id,
            sessionTitle: session.title,
            repoName: session.repoName,
            targetValue: activeTarget.label ?? activeTarget.value,
            reason: getOverlapReason(incomingTarget, activeTarget),
          });
        }
      }
    }
  }

  return overlaps;
}

export function createLockTarget(
  type: LockTarget["type"],
  value: string,
): LockTarget {
  return {
    id: createId(),
    type,
    value: value.trim(),
  };
}
