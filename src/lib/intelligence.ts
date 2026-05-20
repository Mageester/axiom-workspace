import type {
  FileClassification,
  LiveRepo,
  RepoFileCategory,
  RepoRiskLevel,
  RepoSafetyState,
  RepoIntelligence,
  RepoChangeKind,
} from "../types";

type PatternMatch = (path: string) => boolean;

interface CategoryRule {
  category: RepoFileCategory;
  match: PatternMatch;
}

function ext(...extensions: string[]): PatternMatch {
  return (path) => extensions.some((ext) => path.endsWith(ext));
}

function pathStartsWith(prefix: string): PatternMatch {
  const normalized = prefix.toLowerCase();
  return (path) => path.toLowerCase().replace(/\\/g, "/").startsWith(normalized);
}

function nameEquals(...names: string[]): PatternMatch {
  const lowerNames = names.map((n) => n.toLowerCase());
  return (path) => {
    const segments = path.replace(/\\/g, "/").split("/");
    const fileName = segments[segments.length - 1] ?? "";
    return lowerNames.some((n) => fileName === n);
  };
}

function nameStartsWith(...prefixes: string[]): PatternMatch {
  const lowerPrefixes = prefixes.map((p) => p.toLowerCase());
  return (path) => {
    const segments = path.replace(/\\/g, "/").split("/");
    const fileName = segments[segments.length - 1] ?? "";
    return lowerPrefixes.some((p) => fileName.startsWith(p));
  };
}

function pathContains(...substrings: string[]): PatternMatch {
  return (path) => {
    const p = path.replace(/\\/g, "/").toLowerCase();
    return substrings.some((s) => p.includes(s));
  };
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "config",
    match: (path) =>
      nameEquals(
        "package.json",
        "Cargo.toml",
        "tsconfig.json", "tsconfig.app.json", "tsconfig.node.json",
        "vite.config.ts", "vite.config.js", "tailwind.config.ts", "tailwind.config.js",
        "next.config.ts", "next.config.js", "postcss.config.js",
        "biome.json", ".eslintrc.json", ".eslintrc.js", ".eslintrc.cjs",
        ".prettierrc", ".prettierrc.json", ".prettierrc.js",
        "jest.config.ts", "vitest.config.ts",
        ".gitignore", ".gitattributes",
        "Cargo.lock",
        "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
        "bun.lock", "bun.lockb",
      )(path) || nameStartsWith(".env", ".env.")(path),
  },
  {
    category: "deployment",
    match: (path) =>
      nameStartsWith("Dockerfile")(path) ||
      nameEquals("docker-compose.yml", "docker-compose.yaml")(path) ||
      nameStartsWith("wrangler.")(path) ||
      pathContains(".github/workflows/", ".aws/", ".cloudflare/")(path),
  },
  {
    category: "generated",
    match: (path) =>
      pathStartsWith("dist/")(path) ||
      pathStartsWith("build/")(path) ||
      pathStartsWith(".next/")(path) ||
      pathStartsWith("target/")(path) ||
      pathContains("generated")(path) ||
      pathContains("__generated__")(path),
  },
  {
    category: "local_tooling",
    match: (path) =>
      pathStartsWith(".vscode/")(path) ||
      pathStartsWith(".idea/")(path) ||
      pathStartsWith(".claude/")(path) ||
      pathStartsWith(".playwright-mcp/")(path) ||
      ext(".local")(path),
  },
  {
    category: "screenshots",
    match: (path) =>
      pathStartsWith(".codex-screenshots/")(path) ||
      pathStartsWith("screenshots/")(path) ||
      pathStartsWith("test-screenshots/")(path) ||
      pathStartsWith("playwright-report/")(path) ||
      pathStartsWith("test-results/")(path),
  },
  {
    category: "docs",
    match: (path) =>
      ext(".md", ".mdx")(path) ||
      pathStartsWith("docs/")(path) ||
      nameStartsWith("CONTRIBUTING", "LICENSE", "CHANGELOG", "README")(path),
  },
  {
    category: "source_code",
    match: ext(
      ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
      ".rs", ".py", ".go", ".java", ".cpp", ".c", ".h",
      ".css", ".scss", ".less", ".html", ".vue", ".svelte",
      ".rb", ".php", ".swift", ".kt", ".dart", ".zig",
    ),
  },
];

function classifySingleFile(path: string): RepoFileCategory {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.match(normalized)) {
      return rule.category;
    }
  }
  return "unknown";
}

export function classifyFile(path: string, kind: RepoChangeKind): FileClassification {
  return {
    path,
    kind,
    category: classifySingleFile(path),
  };
}

const LOW_RISK_CATEGORIES = new Set<RepoFileCategory>(["generated", "local_tooling", "screenshots", "docs"]);

function hasCategory(counts: Record<RepoFileCategory, number>, category: RepoFileCategory): boolean {
  return (counts[category] ?? 0) > 0;
}

function categoryKeys(counts: Record<RepoFileCategory, number>): RepoFileCategory[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([key]) => key as RepoFileCategory);
}

function deriveSafetyState(
  repo: LiveRepo,
  counts: Record<RepoFileCategory, number>,
  hasChangedFiles: boolean,
): RepoSafetyState {
  if (repo.status === "error") return "conflict_risk";
  if (hasChangedFiles && hasCategory(counts, "deployment")) return "deployment_risk";
  if (repo.hasUncommittedChanges && hasChangedFiles) {
    const categories = categoryKeys(counts);
    const allLowRisk = categories.length > 0 && categories.every((c) => LOW_RISK_CATEGORIES.has(c));
    if (allLowRisk) return "dirty_low_risk";
    return "dirty_needs_review";
  }
  if (repo.behind > 0) return "behind_remote";
  if (repo.ahead > 0) return "ahead_of_remote";
  return "safe";
}

function deriveRiskLevel(safety: RepoSafetyState): RepoRiskLevel {
  if (safety === "conflict_risk" || safety === "deployment_risk") return "high";
  if (safety === "dirty_needs_review") return "medium";
  if (safety === "dirty_low_risk") return "low";
  if (safety === "behind_remote") return "low";
  if (safety === "ahead_of_remote") return "none";
  return "none";
}

function buildRecommendation(
  repo: LiveRepo,
  safety: RepoSafetyState,
  classifiedFiles: FileClassification[],
): string {
  if (safety === "conflict_risk") {
    return repo.errorMessage
      ? `Repo check failed: ${repo.errorMessage}`
      : "Repo has errors — inspect and resolve.";
  }

  if (classifiedFiles.length === 0) {
    if (safety === "behind_remote") return "Remote has newer commits — pull to stay in sync.";
    if (safety === "ahead_of_remote") return "Local has unpushed commits — push when ready.";
    return "No action needed.";
  }

  const paths = classifiedFiles.map((f) => f.path.toLowerCase().replace(/\\/g, "/"));

  const allInDir = (dir: string) => paths.every((p) => p.startsWith(dir));

  if (allInDir(".claude/") || allInDir(".playwright-mcp/")) {
    return "Only known local-tooling files changed — consider adding these directories to .gitignore.";
  }
  if (allInDir(".codex-screenshots/") || allInDir("screenshots/")) {
    return "Only screenshot files changed — likely unintentional. Consider ignoring or deleting.";
  }
  if (paths.some((p) => p.endsWith("cargo.lock"))) {
    return "Cargo.lock changed — review dependency changes before committing.";
  }
  if (paths.some((p) => p.includes("wrangler"))) {
    return "Deployment configuration changed — verify before pushing.";
  }
  if (paths.some((p) => p.endsWith("package.json") || p.endsWith("pnpm-lock.yaml") || p.endsWith("yarn.lock") || p.endsWith("package-lock.json"))) {
    return "Dependency manifest or lockfile changed — needs review.";
  }
  if (paths.some((p) => p.startsWith("src/") || p.startsWith("lib/") || p.startsWith("app/"))) {
    return "Source code changes — review before committing.";
  }
  if (paths.some((p) => p.startsWith(".github/workflows/") || p.includes("dockerfile"))) {
    return "Deployment pipeline changed — verify before pushing.";
  }

  return "Files changed — review before committing.";
}

function buildNextAction(safety: RepoSafetyState): string {
  if (safety === "conflict_risk") return "Inspect and resolve repo error";
  if (safety === "deployment_risk") return "Review and verify deployment changes";
  if (safety === "dirty_needs_review") return "Review changes and commit when ready";
  if (safety === "dirty_low_risk") return "Consider committing or gitignoring";
  if (safety === "behind_remote") return "Pull from remote";
  if (safety === "ahead_of_remote") return "Push to remote";
  return "All clear";
}

export function analyzeRepo(repo: LiveRepo): RepoIntelligence {
  const classifiedFiles: FileClassification[] = repo.changedFiles.map((file) =>
    classifyFile(file.path, file.kind),
  );

  const counts: Record<RepoFileCategory, number> = {
    source_code: 0, config: 0, deployment: 0, generated: 0,
    local_tooling: 0, screenshots: 0, docs: 0, unknown: 0,
  };
  for (const file of classifiedFiles) {
    counts[file.category] = (counts[file.category] ?? 0) + 1;
  }

  const hasChangedFiles = classifiedFiles.length > 0;
  const safetyState = deriveSafetyState(repo, counts, hasChangedFiles);
  const riskLevel = deriveRiskLevel(safetyState);
  const categories = categoryKeys(counts);
  const isDirtyIntentional =
    hasChangedFiles && categories.length > 0 && categories.every((c) => LOW_RISK_CATEGORIES.has(c));

  return {
    safetyState,
    riskLevel,
    recommendation: buildRecommendation(repo, safetyState, classifiedFiles),
    nextAction: buildNextAction(safetyState),
    classifiedFiles,
    categoryCounts: counts,
    isDirtyIntentional,
  };
}

export interface SystemJudgment {
  safeCount: number;
  needsReviewCount: number;
  highestRiskRepo: LiveRepo | null;
  highestRiskLevel: RepoRiskLevel;
  highestSafetyState: RepoSafetyState | null;
  systemRecommendation: string;
  breakdown: Record<RepoSafetyState, number>;
}

const JUDGMENT_SORT: Record<RepoSafetyState, number> = {
  conflict_risk: 0,
  deployment_risk: 1,
  dirty_needs_review: 2,
  dirty_low_risk: 3,
  behind_remote: 4,
  ahead_of_remote: 5,
  safe: 6,
};

export function getSystemJudgment(repos: LiveRepo[]): SystemJudgment {
  const intel = repos.map((repo) => ({ repo, intel: analyzeRepo(repo) }));
  const breakdown: Record<RepoSafetyState, number> = {
    safe: 0, dirty_low_risk: 0, dirty_needs_review: 0,
    ahead_of_remote: 0, behind_remote: 0, conflict_risk: 0, deployment_risk: 0,
  };
  for (const { intel: i } of intel) {
    breakdown[i.safetyState] = (breakdown[i.safetyState] ?? 0) + 1;
  }

  const needsReview = intel.filter(
    ({ intel: i }) => i.riskLevel === "high" || i.riskLevel === "medium",
  );
  const safeCount = intel.filter(
    ({ intel: i }) => i.riskLevel === "none" || i.riskLevel === "low",
  ).length;
  const highestRisk = intel.sort(
    (a, b) => (JUDGMENT_SORT[a.intel.safetyState] ?? 6) - (JUDGMENT_SORT[b.intel.safetyState] ?? 6),
  )[0] ?? null;

  let systemRecommendation = "All repos are in good shape.";
  if (highestRisk && highestRisk.intel.riskLevel !== "none") {
    systemRecommendation = highestRisk.intel.recommendation;
  }

  return {
    safeCount,
    needsReviewCount: needsReview.length,
    highestRiskRepo: highestRisk?.repo ?? null,
    highestRiskLevel: highestRisk?.intel.riskLevel ?? "none",
    highestSafetyState: highestRisk?.intel.safetyState ?? "safe",
    systemRecommendation,
    breakdown,
  };
}

export function categoryLabel(category: RepoFileCategory): string {
  const labels: Record<RepoFileCategory, string> = {
    source_code: "Source code",
    config: "Config",
    deployment: "Deployment",
    generated: "Generated",
    local_tooling: "Local tooling",
    screenshots: "Screenshots",
    docs: "Docs",
    unknown: "Unknown",
  };
  return labels[category];
}

export function riskLabel(level: RepoRiskLevel): string {
  const labels: Record<RepoRiskLevel, string> = {
    none: "None",
    low: "Low",
    medium: "Medium",
    high: "High",
  };
  return labels[level];
}
