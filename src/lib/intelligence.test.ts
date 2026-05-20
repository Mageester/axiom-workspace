import { describe, expect, it } from "vitest";
import type { LiveRepo } from "../types";
import { analyzeRepo, classifyFile, getSystemJudgment, categoryLabel } from "./intelligence";

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

describe("classifyFile", () => {
  const cases: [string, string][] = [
    ["src/App.tsx", "source_code"],
    ["src/lib/repos.ts", "source_code"],
    ["src/components/Button.tsx", "source_code"],
    ["styles.css", "source_code"],
    ["page.html", "source_code"],
    ["main.rs", "source_code"],
    ["index.py", "source_code"],
    ["package.json", "config"],
    ["Cargo.toml", "config"],
    ["tsconfig.json", "config"],
    ["vite.config.ts", "config"],
    [".env.local", "config"],
    [".env", "config"],
    [".github/workflows/deploy.yml", "deployment"],
    ["Dockerfile", "deployment"],
    ["docker-compose.yml", "deployment"],
    ["Cargo.lock", "config"],
    ["pnpm-lock.yaml", "config"],
    ["dist/bundle.js", "generated"],
    [".next/build-manifest.json", "generated"],
    [".claude/settings.json", "local_tooling"],
    [".playwright-mcp/config.json", "local_tooling"],
    [".vscode/extensions.json", "local_tooling"],
    [".codex-screenshots/scr1.png", "screenshots"],
    ["screenshots/ui.png", "screenshots"],
    ["README.md", "docs"],
    ["docs/guide.md", "docs"],
    ["CHANGELOG.md", "docs"],
    ["unknown.bin", "unknown"],
    ["data.csv", "unknown"],
  ];

  for (const [path, expected] of cases) {
    it(`classifies ${path} as ${expected}`, () => {
      const result = classifyFile(path, "modified");
      expect(result.category).toBe(expected);
    });
  }
});

describe("analyzeRepo", () => {
  it("marks clean repo as safe", () => {
    const intel = analyzeRepo(makeRepo());
    expect(intel.safetyState).toBe("safe");
    expect(intel.riskLevel).toBe("none");
    expect(intel.nextAction).toBe("All clear");
  });

  it("marks dirty repo with only .claude/ files as dirty_low_risk with gitignore reco", () => {
    const intel = analyzeRepo(makeRepo({
      status: "dirty",
      hasUncommittedChanges: true,
      changedFileCount: 2,
      changedFiles: [
        { path: ".claude/settings.json", kind: "untracked" },
        { path: ".claude/commands.json", kind: "untracked" },
      ],
    }));
    expect(intel.safetyState).toBe("dirty_low_risk");
    expect(intel.riskLevel).toBe("low");
    expect(intel.isDirtyIntentional).toBe(true);
    expect(intel.recommendation.toLowerCase()).toContain("gitignore");
  });

  it("marks dirty repo with Cargo.lock as dirty_needs_review with dep reco", () => {
    const intel = analyzeRepo(makeRepo({
      status: "dirty",
      hasUncommittedChanges: true,
      changedFileCount: 1,
      changedFiles: [
        { path: "Cargo.lock", kind: "modified" },
      ],
    }));
    expect(intel.safetyState).toBe("dirty_needs_review");
    expect(intel.riskLevel).toBe("medium");
    expect(intel.recommendation.toLowerCase()).toContain("dependency");
  });

  it("marks dirty repo with wrangler.jsonc as deployment_risk", () => {
    const intel = analyzeRepo(makeRepo({
      status: "dirty",
      hasUncommittedChanges: true,
      changedFileCount: 1,
      changedFiles: [
        { path: "wrangler.jsonc", kind: "modified" },
      ],
    }));
    expect(intel.safetyState).toBe("deployment_risk");
    expect(intel.riskLevel).toBe("high");
  });

  it("marks dirty repo with src/ changes as dirty_needs_review", () => {
    const intel = analyzeRepo(makeRepo({
      status: "dirty",
      hasUncommittedChanges: true,
      changedFileCount: 1,
      changedFiles: [
        { path: "src/pages/BoardPage.tsx", kind: "modified" },
      ],
    }));
    expect(intel.safetyState).toBe("dirty_needs_review");
    expect(intel.riskLevel).toBe("medium");
    expect(intel.recommendation.toLowerCase()).toContain("source code");
  });

  it("marks clean repo behind remote as behind_remote", () => {
    const intel = analyzeRepo(makeRepo({
      status: "behind",
      behind: 3,
    }));
    expect(intel.safetyState).toBe("behind_remote");
    expect(intel.riskLevel).toBe("low");
    expect(intel.recommendation.toLowerCase()).toContain("pull");
  });

  it("marks clean repo ahead of remote as ahead_of_remote", () => {
    const intel = analyzeRepo(makeRepo({
      status: "clean",
      ahead: 2,
    }));
    expect(intel.safetyState).toBe("ahead_of_remote");
    expect(intel.riskLevel).toBe("none");
    expect(intel.recommendation.toLowerCase()).toContain("push");
  });

  it("marks error repo as conflict_risk", () => {
    const intel = analyzeRepo(makeRepo({
      status: "error",
      errorMessage: "Git not found",
    }));
    expect(intel.safetyState).toBe("conflict_risk");
    expect(intel.riskLevel).toBe("high");
    expect(intel.recommendation).toContain("Git not found");
  });
});

describe("getSystemJudgment", () => {
  it("returns all safe for clean repos", () => {
    const judgment = getSystemJudgment([makeRepo({ id: "a" }), makeRepo({ id: "b" })]);
    expect(judgment.safeCount).toBe(2);
    expect(judgment.needsReviewCount).toBe(0);
    expect(judgment.systemRecommendation).toBe("All repos are in good shape.");
  });

  it("identifies highest risk repo", () => {
    const judgment = getSystemJudgment([
      makeRepo({ id: "good" }),
      makeRepo({
        id: "bad",
        status: "error",
        errorMessage: "Disk error",
      }),
    ]);
    expect(judgment.needsReviewCount).toBe(1);
    expect(judgment.highestRiskRepo?.id).toBe("bad");
    expect(judgment.highestRiskLevel).toBe("high");
  });
});

describe("categoryLabel", () => {
  it("returns readable labels", () => {
    expect(categoryLabel("source_code")).toBe("Source code");
    expect(categoryLabel("deployment")).toBe("Deployment");
    expect(categoryLabel("generated")).toBe("Generated");
  });
});
