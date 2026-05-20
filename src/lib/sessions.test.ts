import { describe, expect, it } from "vitest";
import { detectSessionOverlap } from "./sessions";
import type { CreateSessionInput } from "./sessions";
import type { WorkSession } from "../types";

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
    targets: [
      {
        id: "target-1",
        type: "file",
        value: "src/pages/Dashboard.tsx",
      },
    ],
    ...overrides,
  };
}

function makeInput(overrides: Partial<CreateSessionInput> = {}): CreateSessionInput {
  return {
    repoId: "repo-1",
    repoName: "Axiom Workspace",
    repoPath: "C:/repos/axiom-workspace",
    userName: "Aidan",
    title: "Ship locks",
    targets: [{ id: "incoming-1", type: "file", value: "src/pages/Dashboard.tsx" }],
    ...overrides,
  };
}

describe("detectSessionOverlap", () => {
  it("marks exact target matches as critical", () => {
    const overlaps = detectSessionOverlap(makeInput(), [makeSession()]);

    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]).toMatchObject({
      reason: "Same target already claimed",
      severity: "critical",
      targetValue: "src/pages/Dashboard.tsx",
    });
  });

  it("marks folder and file overlaps as high severity", () => {
    const overlaps = detectSessionOverlap(
      makeInput({
        targets: [
          { id: "incoming-1", type: "folder", value: "src/pages" },
        ],
      }),
      [
        makeSession({
          targets: [
            {
              id: "target-1",
              type: "file",
              value: "src/pages/Dashboard.tsx",
            },
          ],
        }),
      ],
    );

    expect(overlaps).toHaveLength(1);
    expect(overlaps[0]?.severity).toBe("high");
  });
});
