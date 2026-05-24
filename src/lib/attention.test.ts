import { describe, expect, it } from "vitest";
import type { LiveRepo, WorkSession } from "../types";
import { computeAttentionItems } from "./attention";

function repo(overrides: Partial<LiveRepo>): LiveRepo {
  return {
    id: "repo-1",
    name: "Axiom Site",
    path: "C:\\Work\\Axiom Site",
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
    lastCheckedAt: new Date().toISOString(),
    errorMessage: null,
    ...overrides,
  };
}

function session(overrides: Partial<WorkSession>): WorkSession {
  return {
    id: "session-1",
    repoId: "repo-1",
    repoName: "Axiom Site",
    repoPath: "C:\\Work\\Axiom Site",
    userName: "Riley Hinsperger",
    title: "Homepage",
    branch: "main",
    targets: [],
    status: "active",
    startedAt: new Date(Date.now() - 74 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe("computeAttentionItems", () => {
  it("groups long-running teammate sessions by normalized user and project", () => {
    const items = computeAttentionItems(
      [repo({})],
      [
        session({ id: "one", userName: "Riley Hinsperger" }),
        session({ id: "two", userName: "Riley" }),
      ],
      "Aidan",
      [],
    );

    expect(items).toContainEqual(
      expect.objectContaining({
        id: "long-session-Riley-repo-1",
        title: "Riley has duplicate long-running sessions",
        description: "Axiom Site · 2 sessions · longest 74h",
        actionLabel: "Review",
      }),
    );
  });
});
