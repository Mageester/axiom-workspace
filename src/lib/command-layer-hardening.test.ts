import { describe, expect, it } from "vitest";
import type { LiveRepo, WorkSession } from "../types";
import { computeAttentionItems } from "./attention";
import { normalizeDisplayName } from "./identity";
import { formatChangedFiles } from "./project-status";
import { assessProjectSafety } from "./safety";

function repo(overrides: Partial<LiveRepo> = {}): LiveRepo {
  return {
    id: "axiom-site",
    name: "Axiom Site",
    path: "C:/Workspace/axiom-site",
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
    repoId: "axiom-pipeline",
    repoName: "Axiom Pipeline Engine",
    repoPath: "C:/Workspace/axiom-pipeline",
    userName: "Riley Hinsperger",
    title: "Working",
    branch: "main",
    targets: [],
    status: "active",
    startedAt: new Date(Date.now() - 74 * 36e5).toISOString(),
    ...overrides,
  };
}

describe("command layer hardening", () => {
  it("normalizes known teammate identities", () => {
    expect(normalizeDisplayName("Riley Hinsperger")).toBe("Riley");
    expect(normalizeDisplayName("riley h")).toBe("Riley");
    expect(normalizeDisplayName("Aidan Magee")).toBe("Aidan");
  });

  it("does not mark changed repos safe to start", () => {
    const safety = assessProjectSafety(repo({ changedFileCount: 1, hasUncommittedChanges: true, status: "dirty" }), null, [], "Aidan");
    expect(safety.label).toBe("review_first");
    expect(safety.displayText).toBe("Review first");
  });

  it("uses polished changed-file status copy", () => {
    expect(formatChangedFiles(0)).toBe("Clean");
    expect(formatChangedFiles(1)).toBe("1 file changed");
    expect(formatChangedFiles(9)).toBe("9 files changed");
  });

  it("groups long-running sessions by normalized user and project", () => {
    const items = computeAttentionItems(
      [],
      [
        session({ id: "session-1", userName: "Riley" }),
        session({ id: "session-2", userName: "Riley Hinsperger", startedAt: new Date(Date.now() - 9 * 36e5).toISOString() }),
      ],
      "Aidan",
      [],
    );

    const longSessionItems = items.filter((item) => item.id.startsWith("long-session-Riley"));
    expect(longSessionItems).toHaveLength(1);
    expect(longSessionItems[0].title).toBe("Riley has long-running sessions");
    expect(longSessionItems[0].description).toContain("2 sessions");
  });
});
