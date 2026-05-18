import { useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  FolderGit2,
  RefreshCw,
  Upload,
} from "lucide-react";
import type {
  DeviceIdentity,
  SyncSettings,
  SyncStatus,
  WorkSession,
  WorkspaceEvent,
} from "../types";
import { PageHeader } from "../components/PageHeader";
import { primaryBtnClass, secondaryBtnClass } from "../lib/constants";
import {
  applyWorkspaceEvents,
  buildSnapshot,
  downloadJson,
  mergeSessions,
  parseImportedState,
  readSyncEvents,
  saveSyncSettings,
  validateSyncRepo,
  writeSyncEvent,
} from "../lib/sync";

interface SettingsPageProps {
  sessions: WorkSession[];
  events: WorkspaceEvent[];
  settings: SyncSettings;
  lastSyncAt: string | null;
  onSettingsChange: (settings: SyncSettings) => void;
  onSessionsChange: (sessions: WorkSession[]) => void;
  onEventsChange: (events: WorkspaceEvent[]) => void;
  onSyncCompleted: () => void;
}

const fieldClass =
  "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent";

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not synced yet";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: SyncStatus): string {
  switch (status) {
    case "validating":
      return "Checking sync repo";
    case "exporting":
      return "Exporting state";
    case "importing":
      return "Importing state";
    case "writing":
      return "Writing events";
    case "reading":
      return "Reading events";
    case "success":
      return "Ready";
    case "error":
      return "Needs attention";
    default:
      return "Idle";
  }
}

function mergeEvents(
  current: WorkspaceEvent[],
  incoming: WorkspaceEvent[],
): WorkspaceEvent[] {
  return Array.from(
    new Map([...current, ...incoming].map((event) => [event.id, event])).values(),
  ).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function SettingsPage({
  sessions,
  events,
  settings,
  lastSyncAt,
  onSettingsChange,
  onSessionsChange,
  onEventsChange,
  onSyncCompleted,
}: SettingsPageProps) {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function updateIdentity(nextIdentity: Partial<DeviceIdentity>) {
    const nextSettings = {
      ...settings,
      identity: {
        ...settings.identity,
        ...nextIdentity,
      },
    };
    saveSyncSettings(nextSettings);
    onSettingsChange(nextSettings);
  }

  function updateSyncRepoPath(syncRepoPath: string) {
    const nextSettings = { ...settings, syncRepoPath };
    saveSyncSettings(nextSettings);
    onSettingsChange(nextSettings);
  }

  function setSuccess(nextMessage: string) {
    setStatus("success");
    setMessage(nextMessage);
    setError("");
  }

  function setFailure(nextError: string) {
    setStatus("error");
    setError(nextError);
    setMessage("");
  }

  async function handleValidate() {
    if (!settings.syncRepoPath.trim()) {
      setFailure("Choose a local sync repo path first.");
      return;
    }

    setStatus("validating");
    try {
      const result = await validateSyncRepo(settings.syncRepoPath.trim());
      if (result.ok) {
        setSuccess(result.message);
        onSyncCompleted();
      } else {
        setFailure(result.message);
      }
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not validate sync repo.");
    }
  }

  function handleExport() {
    setStatus("exporting");
    try {
      const snapshot = buildSnapshot(sessions, events, settings.identity);
      downloadJson("axiom-workspace-state.json", snapshot);
      setSuccess("Workspace coordination state exported.");
    } catch {
      setFailure("Could not export workspace state.");
    }
  }

  async function handleImportFile(file: File) {
    setStatus("importing");
    try {
      const text = await file.text();
      const imported = parseImportedState(text);
      const mergedEvents = mergeEvents(events, imported.events);
      const eventSessions = applyWorkspaceEvents(sessions, imported.events);
      const mergedSessions = mergeSessions(eventSessions, imported.sessions);
      onEventsChange(mergedEvents);
      onSessionsChange(mergedSessions);
      setSuccess(
        `Imported ${imported.sessions.length} sessions and ${imported.events.length} events.`,
      );
    } catch {
      setFailure("That file is not valid Axiom Workspace sync JSON.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleWriteEvents() {
    if (!settings.syncRepoPath.trim()) {
      setFailure("Choose a local sync repo path first.");
      return;
    }

    setStatus("writing");
    try {
      const validation = await validateSyncRepo(settings.syncRepoPath.trim());
      if (!validation.ok) {
        setFailure(validation.message);
        return;
      }
      await Promise.all(
        events.map((event) => writeSyncEvent(settings.syncRepoPath.trim(), event)),
      );
      onSyncCompleted();
      setSuccess(`Wrote ${events.length} local events to the sync repo.`);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not write sync events.");
    }
  }

  async function handleReadEvents() {
    if (!settings.syncRepoPath.trim()) {
      setFailure("Choose a local sync repo path first.");
      return;
    }

    setStatus("reading");
    try {
      const validation = await validateSyncRepo(settings.syncRepoPath.trim());
      if (!validation.ok) {
        setFailure(validation.message);
        return;
      }
      const result = await readSyncEvents(settings.syncRepoPath.trim());
      const mergedEvents = mergeEvents(events, result.events);
      const mergedSessions = applyWorkspaceEvents(sessions, result.events);
      onEventsChange(mergedEvents);
      onSessionsChange(mergedSessions);
      onSyncCompleted();
      setSuccess(
        `Read ${result.events.length} events from the sync repo${
          result.skipped ? ` and skipped ${result.skipped} unreadable files` : ""
        }.`,
      );
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Could not read sync events.");
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        title="Settings"
        description="Identity and zero-cost coordination sync."
      />

      <main className="space-y-6 p-8">
        <section className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Sync
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-text-muted">
                This syncs Axiom Workspace coordination state only. It does not
                sync source code.
              </p>
            </div>
            <span className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-text-muted">
              Manual
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                User display name
              </span>
              <input
                className={fieldClass}
                value={settings.identity.userName}
                onChange={(event) =>
                  updateIdentity({ userName: event.target.value })
                }
                placeholder="Aidan"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                Device name
              </span>
              <input
                className={fieldClass}
                value={settings.identity.deviceName}
                onChange={(event) =>
                  updateIdentity({ deviceName: event.target.value })
                }
                placeholder="Aidan desktop"
              />
            </label>

            <label className="block lg:col-span-2">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                Sync repo path
              </span>
              <input
                className={fieldClass}
                value={settings.syncRepoPath}
                onChange={(event) => updateSyncRepoPath(event.target.value)}
                placeholder="C:\\Users\\aidan\\Desktop\\axiom-workspace-sync"
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-0 px-3 py-3 lg:col-span-2">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Auto-sync
                </p>
                <p className="text-xs text-text-muted">Coming soon</p>
              </div>
              <input
                type="checkbox"
                checked={false}
                disabled
                className="h-4 w-4 accent-indigo-500"
              />
            </label>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-md border border-border bg-surface-0 px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-text-muted">
                Status
              </p>
              <p className="mt-1 text-sm text-text-primary">
                {statusLabel(status)}
              </p>
            </div>
            <div className="rounded-md border border-border bg-surface-0 px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-text-muted">
                Last sync
              </p>
              <p className="mt-1 text-sm text-text-primary">
                {formatDateTime(lastSyncAt)}
              </p>
            </div>
            <div className="rounded-md border border-border bg-surface-0 px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-text-muted">
                Local events
              </p>
              <p className="mt-1 text-sm text-text-primary">{events.length}</p>
            </div>
          </div>

          {(message || error) && (
            <div
              className={`mt-5 rounded-md border px-3 py-2 text-sm ${
                error
                  ? "border-status-locked/40 bg-status-locked/10 text-status-locked"
                  : "border-status-clean/40 bg-status-clean/10 text-status-clean"
              }`}
            >
              {message || error}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button className={secondaryBtnClass} onClick={handleValidate}>
              <FolderGit2 size={14} />
              Validate Sync Repo
            </button>
            <button className={secondaryBtnClass} onClick={handleExport}>
              <Download size={14} />
              Export State
            </button>
            <button
              className={secondaryBtnClass}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} />
              Import State
            </button>
            <button className={primaryBtnClass} onClick={handleWriteEvents}>
              <CheckCircle2 size={14} />
              Write Local Events to Sync Repo
            </button>
            <button className={secondaryBtnClass} onClick={handleReadEvents}>
              <RefreshCw size={14} />
              Read Events from Sync Repo
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleImportFile(file);
              }
            }}
          />
        </section>
      </main>
    </div>
  );
}
