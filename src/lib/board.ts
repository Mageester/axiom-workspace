import type {
  BoardAssignee,
  BoardChecklistItem,
  BoardColumnId,
  BoardPriority,
  CardRiskAssessment,
  LiveRepo,
  WorkCard,
  WorkSession,
  WorkspaceEvent,
} from "../types";
import { normalizeTargetValue } from "./sessions";

const STORAGE_KEY = "axiom-workspace:board-cards";

export const BOARD_COLUMNS: { id: BoardColumnId; label: string; description: string }[] = [
  { id: "inbox", label: "Inbox", description: "Captured ideas and loose work." },
  { id: "ready", label: "Ready", description: "Clear and ready to start." },
  { id: "in_progress", label: "In Progress", description: "Actively being worked." },
  { id: "blocked", label: "Blocked", description: "Waiting on a decision or dependency." },
  { id: "review", label: "Review", description: "Needs validation before done." },
  { id: "done", label: "Done", description: "Completed and verified." },
];

export const BOARD_COLUMN_ORDER = BOARD_COLUMNS.map((column) => column.id);

export interface CreateWorkCardInput {
  title: string;
  description?: string;
  column?: BoardColumnId;
  priority?: BoardPriority;
  assignee?: BoardAssignee;
  repoId?: string;
  repoName?: string;
  repoPath?: string;
  branch?: string;
  paths?: string[];
  acceptanceCriteria?: string[];
  testPlan?: string;
  agentBrief?: string;
  notes?: string;
  createdBy: string;
}

export type WorkCardPatch = Partial<
  Pick<
    WorkCard,
    | "title"
    | "description"
    | "column"
    | "priority"
    | "assignee"
    | "repoId"
    | "repoName"
    | "repoPath"
    | "linkedSessionId"
    | "branch"
    | "paths"
    | "acceptanceCriteria"
    | "testPlan"
    | "agentBrief"
    | "notes"
  >
>;

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizePaths(paths: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (paths ?? [])
        .map((path) => path.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeChecklist(items: string[] | BoardChecklistItem[] | undefined): BoardChecklistItem[] {
  return (items ?? [])
    .map((item) => {
      if (typeof item === "string") {
        return { id: createId(), text: item.trim(), done: false };
      }
      return {
        id: item.id || createId(),
        text: item.text.trim(),
        done: item.done === true,
      };
    })
    .filter((item) => item.text.length > 0);
}

function isBoardColumn(value: unknown): value is BoardColumnId {
  return BOARD_COLUMN_ORDER.includes(value as BoardColumnId);
}

function isBoardPriority(value: unknown): value is BoardPriority {
  return value === "low" || value === "medium" || value === "high" || value === "urgent";
}

function isBoardAssignee(value: unknown): value is BoardAssignee {
  return value === "you" || value === "agent" || value === "both" || value === "unassigned";
}

function isChecklistItem(value: unknown): value is BoardChecklistItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BoardChecklistItem>;
  return typeof item.id === "string" && typeof item.text === "string" && typeof item.done === "boolean";
}

export function isWorkCard(value: unknown): value is WorkCard {
  if (!value || typeof value !== "object") return false;
  const card = value as Partial<WorkCard>;
  return (
    typeof card.id === "string" &&
    typeof card.title === "string" &&
    card.title.trim().length > 0 &&
    (card.description === undefined || typeof card.description === "string") &&
    isBoardColumn(card.column) &&
    isBoardPriority(card.priority) &&
    isBoardAssignee(card.assignee) &&
    (card.repoId === undefined || typeof card.repoId === "string") &&
    (card.repoName === undefined || typeof card.repoName === "string") &&
    (card.repoPath === undefined || typeof card.repoPath === "string") &&
    (card.linkedSessionId === undefined || typeof card.linkedSessionId === "string") &&
    (card.branch === undefined || typeof card.branch === "string") &&
    Array.isArray(card.paths) &&
    card.paths.every((path) => typeof path === "string") &&
    Array.isArray(card.acceptanceCriteria) &&
    card.acceptanceCriteria.every(isChecklistItem) &&
    (card.testPlan === undefined || typeof card.testPlan === "string") &&
    (card.agentBrief === undefined || typeof card.agentBrief === "string") &&
    (card.notes === undefined || typeof card.notes === "string") &&
    typeof card.createdBy === "string" &&
    typeof card.createdAt === "string" &&
    typeof card.updatedAt === "string"
  );
}

export function loadCards(): WorkCard[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter(isWorkCard) : [];
  } catch {
    return [];
  }
}

export function saveCards(cards: WorkCard[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards.filter(isWorkCard)));
  } catch {
    // In-memory state remains usable if storage is unavailable.
  }
}

export function createWorkCard(input: CreateWorkCardInput): WorkCard {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title: input.title.trim(),
    description: normalizeOptionalText(input.description),
    column: input.column ?? "inbox",
    priority: input.priority ?? "medium",
    assignee: input.assignee ?? "unassigned",
    repoId: normalizeOptionalText(input.repoId),
    repoName: normalizeOptionalText(input.repoName),
    repoPath: normalizeOptionalText(input.repoPath),
    branch: normalizeOptionalText(input.branch),
    paths: normalizePaths(input.paths),
    acceptanceCriteria: normalizeChecklist(input.acceptanceCriteria),
    testPlan: normalizeOptionalText(input.testPlan),
    agentBrief: normalizeOptionalText(input.agentBrief),
    notes: normalizeOptionalText(input.notes),
    createdBy: input.createdBy.trim() || "Unknown",
    createdAt: now,
    updatedAt: now,
  };
}

export function updateWorkCard(cards: WorkCard[], id: string, patch: WorkCardPatch): WorkCard[] {
  const updatedAt = new Date().toISOString();
  return cards.map((card) => {
    if (card.id !== id) return card;
    const next: WorkCard = {
      ...card,
      ...patch,
      title: patch.title !== undefined ? patch.title.trim() : card.title,
      description: patch.description !== undefined ? normalizeOptionalText(patch.description) : card.description,
      repoId: patch.repoId !== undefined ? normalizeOptionalText(patch.repoId) : card.repoId,
      repoName: patch.repoName !== undefined ? normalizeOptionalText(patch.repoName) : card.repoName,
      repoPath: patch.repoPath !== undefined ? normalizeOptionalText(patch.repoPath) : card.repoPath,
      branch: patch.branch !== undefined ? normalizeOptionalText(patch.branch) : card.branch,
      paths: patch.paths !== undefined ? normalizePaths(patch.paths) : card.paths,
      acceptanceCriteria:
        patch.acceptanceCriteria !== undefined
          ? normalizeChecklist(patch.acceptanceCriteria)
          : card.acceptanceCriteria,
      testPlan: patch.testPlan !== undefined ? normalizeOptionalText(patch.testPlan) : card.testPlan,
      agentBrief: patch.agentBrief !== undefined ? normalizeOptionalText(patch.agentBrief) : card.agentBrief,
      notes: patch.notes !== undefined ? normalizeOptionalText(patch.notes) : card.notes,
      updatedAt,
    };
    return next.title ? next : card;
  });
}

export function mergeCards(current: WorkCard[], incoming: WorkCard[]): WorkCard[] {
  const byId = new Map<string, WorkCard>();
  for (const card of current.filter(isWorkCard)) {
    byId.set(card.id, card);
  }
  for (const card of incoming.filter(isWorkCard)) {
    const existing = byId.get(card.id);
    byId.set(card.id, !existing || card.updatedAt.localeCompare(existing.updatedAt) >= 0 ? card : existing);
  }
  return Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function applyBoardEvent(cards: WorkCard[], event: WorkspaceEvent): WorkCard[] {
  if (!event.payload || typeof event.payload !== "object") return cards;
  const payload = event.payload as { card?: unknown };
  if (event.type === "board_card_created" || event.type === "board_card_updated") {
    return isWorkCard(payload.card) ? mergeCards(cards, [payload.card]) : cards;
  }
  return cards;
}

export function applyBoardEvents(cards: WorkCard[], events: WorkspaceEvent[]): WorkCard[] {
  return [...events]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .reduce(applyBoardEvent, cards);
}

function cardPathOverlapsSession(cardPath: string, session: WorkSession): boolean {
  const normalizedCardPath = normalizeTargetValue(cardPath);
  return session.targets.some((target) => {
    const normalizedTarget = normalizeTargetValue(target.value);
    if (normalizedCardPath === normalizedTarget) return true;
    if (target.type === "area") return false;
    return (
      normalizedCardPath.startsWith(`${normalizedTarget}/`) ||
      normalizedTarget.startsWith(`${normalizedCardPath}/`)
    );
  });
}

export function assessCardRisk(
  card: WorkCard,
  repos: LiveRepo[],
  activeSessions: WorkSession[],
): CardRiskAssessment {
  const reasons: string[] = [];
  const repo = card.repoId ? repos.find((item) => item.id === card.repoId) : null;
  const sessionsForRepo = card.repoId
    ? activeSessions.filter((session) => session.repoId === card.repoId)
    : [];
  const conflictingSessions = sessionsForRepo.filter(
    (session) =>
      session.id !== card.linkedSessionId &&
      (card.paths.length === 0 || card.paths.some((path) => cardPathOverlapsSession(path, session))),
  );

  if (conflictingSessions.length > 0) {
    reasons.push("Overlaps active work or locks");
  }
  if (repo?.status === "error") {
    reasons.push("Repo status needs attention");
  }
  if (repo?.hasUncommittedChanges) {
    reasons.push(`${repo.changedFileCount} uncommitted file${repo.changedFileCount === 1 ? "" : "s"}`);
  }
  if ((repo?.behind ?? 0) > 0) {
    reasons.push(`${repo?.behind} remote update${repo?.behind === 1 ? "" : "s"} available`);
  }
  if (card.acceptanceCriteria.length === 0) {
    reasons.push("No acceptance criteria");
  }
  if (!card.testPlan && card.column !== "inbox") {
    reasons.push("No test plan");
  }

  if (conflictingSessions.length > 0 || repo?.status === "error") {
    return { level: "critical", label: "Critical", reasons };
  }
  if (repo?.hasUncommittedChanges || card.priority === "urgent") {
    return { level: "high", label: "High", reasons };
  }
  if ((repo?.behind ?? 0) > 0 || reasons.length > 0) {
    return { level: "medium", label: "Medium", reasons };
  }
  return { level: "low", label: "Low", reasons: ["Ready to work"] };
}

export function getBoardStats(cards: WorkCard[]): {
  active: number;
  blocked: number;
  review: number;
  done: number;
} {
  return {
    active: cards.filter((card) => card.column === "in_progress").length,
    blocked: cards.filter((card) => card.column === "blocked").length,
    review: cards.filter((card) => card.column === "review").length,
    done: cards.filter((card) => card.column === "done").length,
  };
}
