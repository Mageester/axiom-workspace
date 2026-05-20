import { describe, expect, it } from "vitest";
import { applyWorkspaceEvents, dedupeEvents } from "./sync";
import type { WorkSession, WorkspaceEvent } from "../types";

function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: "session-1",
    repoId: "repo-1",
    repoName: "Axiom Workspace",
    repoPath: "C:/repos/axiom-workspace",
    userName: "Riley",
    title: "Update dashboard",
    status: "active",
    startedAt: "2026-05-20T12:00:00.000Z",
    targets: [],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<WorkspaceEvent> = {}): WorkspaceEvent {
  return {
    id: "event-1",
    type: "session_created",
    deviceId: "device-1",
    userName: "Riley",
    createdAt: "2026-05-20T12:00:00.000Z",
    payload: {},
    version: 1,
    ...overrides,
  };
}

describe("dedupeEvents", () => {
  it("keeps the latest copy of duplicate ids and sorts by time", () => {
    const events = dedupeEvents([
      makeEvent({ id: "b", createdAt: "2026-05-20T12:10:00.000Z" }),
      makeEvent({ id: "a", createdAt: "2026-05-20T12:05:00.000Z" }),
      makeEvent({
        id: "a",
        createdAt: "2026-05-20T12:15:00.000Z",
        payload: { copied: true },
      }),
    ]);

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.id)).toEqual(["b", "a"]);
    expect(events[1]?.payload).toEqual({ copied: true });
  });
});

describe("applyWorkspaceEvents", () => {
  it("applies created and ended session events", () => {
    const createdSession = makeSession();
    const events: WorkspaceEvent[] = [
      makeEvent({
        id: "create",
        type: "session_created",
        createdAt: "2026-05-20T12:00:00.000Z",
        payload: { session: createdSession },
      }),
      makeEvent({
        id: "end",
        type: "session_ended",
        createdAt: "2026-05-20T12:30:00.000Z",
        payload: {
          sessionId: createdSession.id,
          endedAt: "2026-05-20T12:30:00.000Z",
          endNote: "Handoff complete",
        },
      }),
    ];

    const sessions = applyWorkspaceEvents([], events);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: createdSession.id,
      status: "ended",
      endNote: "Handoff complete",
      endedAt: "2026-05-20T12:30:00.000Z",
    });
  });
});
