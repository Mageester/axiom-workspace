import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  Play,
  Plus,
  ShieldAlert,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import type {
  BoardAssignee,
  BoardColumnId,
  BoardPriority,
  LiveRepo,
  LockTarget,
  WorkCard,
  WorkSession,
} from "../types";
import { PageHeader } from "../components/PageHeader";
import { StartSessionModal } from "../components/StartSessionModal";
import { primaryBtnClass, secondaryBtnClass } from "../lib/constants";
import { getRepoDisplayName } from "../lib/repos";
import { createLockTarget, type CreateSessionInput } from "../lib/sessions";
import {
  assessCardRisk,
  BOARD_COLUMNS,
  BOARD_COLUMN_ORDER,
  type CreateWorkCardInput,
  type WorkCardPatch,
} from "../lib/board";

interface BoardPageProps {
  cards: WorkCard[];
  repos: LiveRepo[];
  activeSessions: WorkSession[];
  defaultUserName: string;
  onCreateCard: (input: CreateWorkCardInput) => void;
  onUpdateCard: (cardId: string, patch: WorkCardPatch) => void;
  onStartSessionFromCard: (cardId: string, input: CreateSessionInput) => void;
}

const fieldClass =
  "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent";

const priorityLabels: Record<BoardPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const assigneeLabels: Record<BoardAssignee, string> = {
  you: "You",
  agent: "Agent",
  both: "Both",
  unassigned: "Unassigned",
};

function priorityClass(priority: BoardPriority): string {
  switch (priority) {
    case "urgent":
      return "border-status-locked/30 bg-status-locked/15 text-status-locked";
    case "high":
      return "border-status-dirty/30 bg-status-dirty/15 text-status-dirty";
    case "medium":
      return "border-status-behind/30 bg-status-behind/15 text-status-behind";
    default:
      return "border-border bg-surface-2 text-text-muted";
  }
}

function riskClass(level: string): string {
  switch (level) {
    case "critical":
      return "border-status-locked/30 bg-status-locked/15 text-status-locked";
    case "high":
      return "border-status-dirty/30 bg-status-dirty/15 text-status-dirty";
    case "medium":
      return "border-status-behind/30 bg-status-behind/15 text-status-behind";
    default:
      return "border-status-clean/30 bg-status-clean/10 text-status-clean";
  }
}

function assigneeIcon(assignee: BoardAssignee) {
  if (assignee === "agent") return <Bot size={12} />;
  if (assignee === "both") return <Users size={12} />;
  return <User size={12} />;
}

function compactList(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function targetTypeFromPath(path: string): LockTarget["type"] {
  const normalized = path.trim().replace(/\\/g, "/");
  const lastSegment = normalized.split("/").pop() ?? normalized;
  return lastSegment.includes(".") ? "file" : "folder";
}

function cardTargets(card: WorkCard): LockTarget[] {
  if (card.paths.length === 0) {
    return [createLockTarget("area", card.title)];
  }
  return card.paths.map((path) => createLockTarget(targetTypeFromPath(path), path));
}

function sessionNotesFromCard(card: WorkCard): string {
  return [
    card.description,
    card.agentBrief ? `Agent brief:\n${card.agentBrief}` : undefined,
    card.acceptanceCriteria.length > 0
      ? `Acceptance criteria:\n${card.acceptanceCriteria.map((item) => `- ${item.text}`).join("\n")}`
      : undefined,
    card.testPlan ? `Test plan:\n${card.testPlan}` : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function findCardRepo(card: WorkCard, repos: LiveRepo[]): LiveRepo | null {
  if (!card.repoId) return null;
  return repos.find((repo) => repo.id === card.repoId) ?? null;
}

function CardItem({
  card,
  repos,
  activeSessions,
  onUpdateCard,
  onStartWork,
}: {
  card: WorkCard;
  repos: LiveRepo[];
  activeSessions: WorkSession[];
  onUpdateCard: (cardId: string, patch: WorkCardPatch) => void;
  onStartWork: (card: WorkCard) => void;
}) {
  const risk = assessCardRisk(card, repos, activeSessions);
  const repo = findCardRepo(card, repos);
  const columnIndex = BOARD_COLUMN_ORDER.indexOf(card.column);
  const doneCount = card.acceptanceCriteria.filter((item) => item.done).length;
  const linkedActiveSession = card.linkedSessionId
    ? activeSessions.find((session) => session.id === card.linkedSessionId)
    : null;

  return (
    <article className="rounded-lg border border-border bg-surface-0 p-4 shadow-sm transition-colors hover:border-border-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold text-text-primary">
            {card.title}
          </h3>
          <p className="mt-1 truncate text-xs text-text-muted">
            {card.repoName ?? "No repo linked"}
            {card.branch ? ` · ${card.branch}` : ""}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${priorityClass(card.priority)}`}>
          {priorityLabels[card.priority]}
        </span>
      </div>

      {card.description && (
        <p className="mt-3 line-clamp-3 text-xs leading-5 text-text-secondary">
          {card.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-text-muted">
          {assigneeIcon(card.assignee)}
          {assigneeLabels[card.assignee]}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${riskClass(risk.level)}`} title={risk.reasons.join("\n")}>
          <ShieldAlert size={11} />
          {risk.label} risk
        </span>
        {linkedActiveSession && (
          <span className="inline-flex items-center gap-1 rounded-full border border-status-clean/30 bg-status-clean/10 px-2 py-0.5 text-[11px] text-status-clean">
            <Play size={11} />
            Active
          </span>
        )}
      </div>

      {card.paths.length > 0 && (
        <div className="mt-3 space-y-1">
          {card.paths.slice(0, 3).map((path) => (
            <p key={path} className="truncate rounded border border-border bg-surface-1 px-2 py-1 text-[11px] text-text-secondary">
              {path}
            </p>
          ))}
          {card.paths.length > 3 && (
            <p className="text-[11px] text-text-muted">+{card.paths.length - 3} more paths</p>
          )}
        </div>
      )}

      {card.acceptanceCriteria.length > 0 && (
        <div className="mt-3 rounded-md border border-border bg-surface-1 px-3 py-2">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            <CheckCircle2 size={12} />
            {doneCount}/{card.acceptanceCriteria.length} criteria
          </div>
          <div className="space-y-1.5">
            {card.acceptanceCriteria.slice(0, 3).map((item) => (
              <label key={item.id} className="flex cursor-pointer items-start gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-accent"
                  checked={item.done}
                  onChange={(event) => {
                    onUpdateCard(card.id, {
                      acceptanceCriteria: card.acceptanceCriteria.map((candidate) =>
                        candidate.id === item.id
                          ? { ...candidate, done: event.target.checked }
                          : candidate,
                      ),
                    });
                  }}
                />
                <span className={item.done ? "line-through text-text-muted" : ""}>
                  {item.text}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {risk.level !== "low" && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-status-dirty/25 bg-status-dirty/10 px-2.5 py-2 text-[11px] text-status-dirty">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{risk.reasons.slice(0, 2).join(". ")}</span>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className={secondaryBtnClass}
          disabled={columnIndex <= 0}
          onClick={() => onUpdateCard(card.id, { column: BOARD_COLUMN_ORDER[columnIndex - 1] })}
        >
          <ArrowLeft size={13} />
          Back
        </button>
        <button
          className={secondaryBtnClass}
          disabled={columnIndex >= BOARD_COLUMN_ORDER.length - 1}
          onClick={() => onUpdateCard(card.id, { column: BOARD_COLUMN_ORDER[columnIndex + 1] })}
        >
          Next
          <ArrowRight size={13} />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <select
          className={`${fieldClass} py-1.5 text-xs`}
          value={card.priority}
          onChange={(event) => onUpdateCard(card.id, { priority: event.target.value as BoardPriority })}
        >
          <option value="low">Low priority</option>
          <option value="medium">Medium priority</option>
          <option value="high">High priority</option>
          <option value="urgent">Urgent</option>
        </select>
        <button
          className={primaryBtnClass}
          disabled={!repo || Boolean(linkedActiveSession)}
          onClick={() => onStartWork(card)}
          title={repo ? "Start a linked work session" : "Link a repo before starting work"}
        >
          <Play size={13} />
          Start
        </button>
      </div>
    </article>
  );
}

export function BoardPage({
  cards,
  repos,
  activeSessions,
  defaultUserName,
  onCreateCard,
  onUpdateCard,
  onStartSessionFromCard,
}: BoardPageProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [repoId, setRepoId] = useState("");
  const [priority, setPriority] = useState<BoardPriority>("medium");
  const [assignee, setAssignee] = useState<BoardAssignee>("both");
  const [paths, setPaths] = useState("");
  const [criteria, setCriteria] = useState("");
  const [testPlan, setTestPlan] = useState("");
  const [agentBrief, setAgentBrief] = useState("");
  const [creating, setCreating] = useState(false);
  const [sessionCard, setSessionCard] = useState<WorkCard | null>(null);

  const cardsByColumn = useMemo(() => {
    const groups = new Map<BoardColumnId, WorkCard[]>();
    for (const column of BOARD_COLUMN_ORDER) groups.set(column, []);
    for (const card of cards) {
      groups.get(card.column)?.push(card);
    }
    return groups;
  }, [cards]);

  const selectedRepo = repos.find((repo) => repo.id === repoId) ?? null;
  const canCreate = title.trim().length > 0;

  function resetForm() {
    setTitle("");
    setDescription("");
    setRepoId("");
    setPriority("medium");
    setAssignee("both");
    setPaths("");
    setCriteria("");
    setTestPlan("");
    setAgentBrief("");
    setCreating(false);
  }

  function submitCard() {
    if (!canCreate) return;
    onCreateCard({
      title,
      description,
      column: "inbox",
      priority,
      assignee,
      repoId: selectedRepo?.id,
      repoName: selectedRepo ? getRepoDisplayName(selectedRepo) : undefined,
      repoPath: selectedRepo?.path,
      branch: selectedRepo?.currentBranch,
      paths: compactList(paths),
      acceptanceCriteria: compactList(criteria),
      testPlan,
      agentBrief,
      createdBy: defaultUserName,
    });
    resetForm();
  }

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        title="Board"
        description="Shared work packets for you and agents, connected to repos, sessions, and locks."
        actions={
          <button className={primaryBtnClass} onClick={() => setCreating((value) => !value)}>
            <Plus size={14} />
            New Card
          </button>
        }
      />

      <main className="space-y-6 p-8">
        <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface-1 p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Total Cards</p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">{cards.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">In Progress</p>
            <p className="mt-1 text-2xl font-semibold text-status-behind">{cardsByColumn.get("in_progress")?.length ?? 0}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Blocked</p>
            <p className="mt-1 text-2xl font-semibold text-status-locked">{cardsByColumn.get("blocked")?.length ?? 0}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Review</p>
            <p className="mt-1 text-2xl font-semibold text-status-dirty">{cardsByColumn.get("review")?.length ?? 0}</p>
          </div>
        </section>

        {creating && (
          <section className="rounded-xl border border-border bg-surface-1 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Create Work Packet
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <label className="block lg:col-span-2">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">Title</span>
                <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ship production dashboard" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">Repo</span>
                <select className={fieldClass} value={repoId} onChange={(event) => setRepoId(event.target.value)}>
                  <option value="">No repo yet</option>
                  {repos.map((repo) => (
                    <option key={repo.id} value={repo.id}>{getRepoDisplayName(repo)}</option>
                  ))}
                </select>
              </label>
              <label className="block lg:col-span-3">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">Description</span>
                <textarea className={`${fieldClass} min-h-20 resize-none`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What should change and why?" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">Priority</span>
                <select className={fieldClass} value={priority} onChange={(event) => setPriority(event.target.value as BoardPriority)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">Assignee</span>
                <select className={fieldClass} value={assignee} onChange={(event) => setAssignee(event.target.value as BoardAssignee)}>
                  <option value="you">You</option>
                  <option value="agent">Agent</option>
                  <option value="both">Both</option>
                  <option value="unassigned">Unassigned</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">Paths</span>
                <input className={fieldClass} value={paths} onChange={(event) => setPaths(event.target.value)} placeholder="src/pages, README.md" />
              </label>
              <label className="block lg:col-span-2">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">Acceptance Criteria</span>
                <textarea className={`${fieldClass} min-h-20 resize-none`} value={criteria} onChange={(event) => setCriteria(event.target.value)} placeholder="One per line" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">Test Plan</span>
                <textarea className={`${fieldClass} min-h-20 resize-none`} value={testPlan} onChange={(event) => setTestPlan(event.target.value)} placeholder="npm test, npm run build" />
              </label>
              <label className="block lg:col-span-3">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">Agent Brief</span>
                <textarea className={`${fieldClass} min-h-20 resize-none`} value={agentBrief} onChange={(event) => setAgentBrief(event.target.value)} placeholder="Constraints, files to inspect, definition of done" />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className={secondaryBtnClass} onClick={resetForm}>Cancel</button>
              <button className={primaryBtnClass} disabled={!canCreate} onClick={submitCard}>
                <ClipboardList size={14} />
                Add Card
              </button>
            </div>
          </section>
        )}

        <section className="grid min-h-[520px] grid-cols-1 gap-4 xl:grid-cols-6">
          {BOARD_COLUMNS.map((column) => {
            const columnCards = cardsByColumn.get(column.id) ?? [];
            return (
              <div key={column.id} className="rounded-xl border border-border bg-surface-1/70 p-3">
                <div className="mb-3 flex items-start justify-between gap-2 px-1">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">{column.label}</h2>
                    <p className="mt-0.5 text-[11px] leading-4 text-text-muted">{column.description}</p>
                  </div>
                  <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-text-muted">
                    {columnCards.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {columnCards.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-muted">
                      Empty
                    </div>
                  ) : (
                    columnCards.map((card) => (
                      <CardItem
                        key={card.id}
                        card={card}
                        repos={repos}
                        activeSessions={activeSessions}
                        onUpdateCard={onUpdateCard}
                        onStartWork={setSessionCard}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </main>

      <StartSessionModal
        open={sessionCard !== null}
        repos={repos}
        activeSessions={activeSessions}
        initialRepo={sessionCard ? findCardRepo(sessionCard, repos) : null}
        initialTitle={sessionCard?.title}
        initialNotes={sessionCard ? sessionNotesFromCard(sessionCard) : undefined}
        initialTargets={sessionCard ? cardTargets(sessionCard) : undefined}
        defaultUserName={defaultUserName}
        onClose={() => setSessionCard(null)}
        onCreate={(input) => {
          if (!sessionCard) return;
          onStartSessionFromCard(sessionCard.id, input);
          setSessionCard(null);
        }}
      />
    </div>
  );
}
