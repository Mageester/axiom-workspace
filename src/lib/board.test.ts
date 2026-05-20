import { describe, expect, it } from "vitest";
import type { LiveRepo, WorkCard, WorkSession, WorkspaceEvent } from "../types";
import {
  applyBoardEvents,
  assessCardRisk,
  createWorkCard,
  mergeCards,
  updateWorkCard,
} from "./board";

function makeRepo(overrides: Partial<LiveRepo> = {}): LiveRepo {
  return {
    id: "repo-1",
    name: "axiom-workspace",
    path: "C:/repos/axiom-workspace",
    currentBranch: "main",
    isGitRepo: true,
    hasUncommittedChanges: false,
    hasUpstream: true,
    upstreamStatus: "ok",
    isDetachedHead: false,
    ahead: 0,
    behind: 0,
    changedFileCount: 0,
    changedFiles: [],
    hasMoreChangedFiles: false,
    status: "clean",
    lastCheckedAt: "2026-05-20T12:00:00.000Z",
    errorMessage: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<WorkSession> = {}): WorkSession {
  return {
    id: "session-1",
    repoId: "repo-1",
    repoName: "Axiom Workspace",
    repoPath: "C:/repos/axiom-workspace",
    userName: "Riley",
    title: "Dashboard work",
    status: "active",
    startedAt: "2026-05-20T12:00:00.000Z",
    targets: [{ id: "target-1", type: "folder", value: "src/pages" }],
    ...overrides,
  };
}

function makeCard(overrides: Partial<WorkCard> = {}): WorkCard {
  return {
    id: "card-1",
    title: "Build board",
    column: "ready",
    priority: "medium",
    assignee: "both",
    repoId: "repo-1",
    repoName: "Axiom Workspace",
    repoPath: "C:/repos/axiom-workspace",
    paths: ["src/pages/BoardPage.tsx"],
    acceptanceCriteria: [],
    createdBy: "Aidan",
    createdAt: "2026-05-20T12:00:00.000Z",
    updatedAt: "2026-05-20T12:00:00.000Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<WorkspaceEvent> = {}): WorkspaceEvent {
  return {
    id: "event-1",
    type: "board_card_created",
    deviceId: "device-1",
    userName: "Aidan",
    createdAt: "2026-05-20T12:00:00.000Z",
    payload: {},
    version: 1,
    ...overrides,
  };
}

describe("createWorkCard", () => {
  it("normalizes paths and checklist items", () => {
    const card = createWorkCard({
      title: " Ship board ",
      paths: [" src/pages ", "src/pages", ""],
      acceptanceCriteria: ["loads fast", "", "syncs cards"],
      createdBy: "Aidan",
    });

    expect(card.title).toBe("Ship board");
    expect(card.paths).toEqual(["src/pages"]);
    expect(card.acceptanceCriteria.map((item) => item.text)).toEqual([
      "loads fast",
      "syncs cards",
    ]);
  });
});

describe("updateWorkCard", () => {
  it("moves cards and updates checklist state", () => {
    const card = makeCard({
      acceptanceCriteria: [{ id: "criterion-1", text: "Pass tests", done: false }],
    });

    const [updated] = updateWorkCard([card], "card-1", {
      column: "review",
      acceptanceCriteria: [{ id: "criterion-1", text: "Pass tests", done: true }],
    });

    expect(updated?.column).toBe("review");
    expect(updated?.acceptanceCriteria[0]?.done).toBe(true);
    expect(updated?.updatedAt).not.toBe(card.updatedAt);
  });
});

describe("board event application", () => {
  it("applies card created and updated events", () => {
    const created = makeCard({ updatedAt: "2026-05-20T12:00:00.000Z" });
    const updated = makeCard({ column: "in_progress", updatedAt: "2026-05-20T12:05:00.000Z" });

    const cards = applyBoardEvents([], [
      makeEvent({ id: "create", type: "board_card_created", payload: { card: created } }),
      makeEvent({ id: "update", type: "board_card_updated", payload: { card: updated } }),
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0]?.column).toBe("in_progress");
  });

  it("keeps the newest card during merge", () => {
    const older = makeCard({ title: "Older", updatedAt: "2026-05-20T12:00:00.000Z" });
    const newer = makeCard({ title: "Newer", updatedAt: "2026-05-20T12:10:00.000Z" });

    expect(mergeCards([older], [newer])[0]?.title).toBe("Newer");
  });
});

describe("assessCardRisk", () => {
  it("marks overlapping active work as critical", () => {
    const risk = assessCardRisk(makeCard(), [makeRepo()], [makeSession()]);

    expect(risk.level).toBe("critical");
    expect(risk.reasons).toContain("Overlaps active work or locks");
  });

  it("marks clean, scoped, testable cards as low risk", () => {
    const risk = assessCardRisk(
      makeCard({
        paths: ["README.md"],
        acceptanceCriteria: [{ id: "criterion-1", text: "Docs updated", done: false }],
        testPlan: "npm test",
      }),
      [makeRepo()],
      [],
    );

    expect(risk.level).toBe("low");
  });
});
