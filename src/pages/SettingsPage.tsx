import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
} from "lucide-react";
import type {
  DeviceIdentity,
  SetupChecklistItem,
  SetupState,
  SetupStatus,
  SyncSettings,
  SyncStatus,
  RepoDiagnostics,
} from "../types";
import { PageHeader } from "../components/PageHeader";
import { primaryBtnClass, secondaryBtnClass } from "../lib/constants";

interface SettingsPageProps {
  setupState: SetupState;
  checklist: SetupChecklistItem[];
  settings: SyncSettings;
  syncStatus: SyncStatus;
  eventCount: number;
  appVersion: string;
  gitVersion: string;
  repoCount: number;
  activeSessionCount: number;
  repoDiagnostics: RepoDiagnostics;
  onIdentityChange: (identity: DeviceIdentity) => void;
  onSetupChange: (setupState: SetupState) => void;
  onSettingsChange: (settings: SyncSettings) => void;
  onValidateSetup: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onResetSetup: () => void;
  onResetSessionsAndLocks: () => void;
  onResetSyncState: () => void;
  onFullLocalReset: () => void;
  onResetDismissedSuggestions: () => void;
}

const fieldClass =
  "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent disabled:cursor-not-allowed disabled:opacity-70";

const statusCopy: Record<SetupStatus, string> = {
  complete: "Complete",
  missing: "Missing",
  needs_action: "Needs action",
  error: "Error",
  checking: "Checking",
};

function formatDateTime(value?: string): string {
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

function formatDuration(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not recorded yet";
  }
  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }
  return `${(value / 1000).toFixed(1)} s`;
}

function syncStatusLabel(status: SyncStatus): string {
  switch (status) {
    case "checking":
      return "Checking";
    case "writing_local_events":
      return "Writing local events";
    case "pulling_updates":
      return "Pulling updates";
    case "reading_shared_events":
      return "Reading shared events";
    case "merging":
      return "Merging";
    case "pushing":
      return "Pushing";
    case "complete":
      return "Complete";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

function StatusIcon({ status }: { status: SetupStatus }) {
  if (status === "complete") {
    return <CheckCircle2 size={15} className="text-status-clean" />;
  }
  if (status === "checking") {
    return <Loader2 size={15} className="animate-spin text-accent" />;
  }
  return <AlertCircle size={15} className="text-status-dirty" />;
}

export function SettingsPage({
  setupState,
  checklist,
  settings,
  syncStatus,
  eventCount,
  appVersion,
  gitVersion,
  repoCount,
  activeSessionCount,
  repoDiagnostics,
  onIdentityChange,
  onSetupChange,
  onSettingsChange,
  onValidateSetup,
  onSyncNow,
  onResetSetup,
  onResetSessionsAndLocks,
  onResetSyncState,
  onFullLocalReset,
  onResetDismissedSuggestions,
}: SettingsPageProps) {
  const [identityDraft, setIdentityDraft] = useState(setupState.identity);
  const [repoUrlDraft, setRepoUrlDraft] = useState(settings.syncRepoUrl);
  const [syncPathDraft, setSyncPathDraft] = useState(settings.syncLocalPath);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const syncing =
    syncStatus !== "idle" && syncStatus !== "complete" && syncStatus !== "error";
  const lastError =
    settings.lastSyncError || setupState.lastError || "No recent errors";
  const diagnostics = [
    { label: "App version", value: appVersion },
    {
      label: "Setup",
      value: setupState.setupComplete ? "Connected" : "Needs setup",
    },
    { label: "Sync status", value: syncStatusLabel(syncStatus) },
    { label: "Sync repo path", value: settings.syncLocalPath || "Not connected" },
    { label: "Git version", value: gitVersion || "Not checked yet" },
    { label: "Repos tracked", value: String(repoCount) },
    { label: "Active work", value: String(activeSessionCount) },
    { label: "Last sync", value: formatDateTime(settings.lastSyncAt) },
    { label: "Last sync duration", value: formatDuration(settings.lastSyncDurationMs) },
    {
      label: "Last sync Git commands",
      value:
        typeof settings.lastSyncGitCommandCount === "number"
          ? String(settings.lastSyncGitCommandCount)
          : "Not recorded yet",
    },
    {
      label: "Last repo refresh",
      value: repoDiagnostics.lastRefreshRepoPath || "Not recorded yet",
    },
    {
      label: "Last repo refresh duration",
      value: formatDuration(repoDiagnostics.lastRefreshDurationMs),
    },
    {
      label: "Last repo Git commands",
      value:
        typeof repoDiagnostics.gitCommandCount === "number"
          ? String(repoDiagnostics.gitCommandCount)
          : "Not recorded yet",
    },
    { label: "Last error", value: lastError },
    {
      label: "Last command error",
      value:
        settings.lastSyncCommandError ||
        repoDiagnostics.lastCommandError ||
        "No recent command errors",
    },
  ];

  function saveIdentity() {
    onIdentityChange({
      ...identityDraft,
      userName: identityDraft.userName.trim(),
      deviceName: identityDraft.deviceName.trim() || "Axiom Device",
    });
  }

  function saveAdvanced() {
    const nextSettings = {
      ...settings,
      syncRepoUrl: repoUrlDraft.trim(),
      syncLocalPath: syncPathDraft.trim(),
    };
    onSettingsChange(nextSettings);
    onSetupChange({
      ...setupState,
      setupComplete: false,
      syncRepoUrl: nextSettings.syncRepoUrl,
      syncLocalPath: nextSettings.syncLocalPath,
      lastError: "Reconnect to validate the updated sync settings.",
    });
  }

  function confirmReset(message: string, action: () => void) {
    if (window.confirm(message)) {
      action();
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <PageHeader
        title="Settings"
        description="Identity, team sync, and setup health."
      />

      <main className="space-y-6 p-8">
        <section className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="mb-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Identity
            </h3>
            <p className="mt-1 text-sm leading-6 text-text-muted">
              This is how your work and claimed areas appear to the team.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                User display name
              </span>
              <input
                className={fieldClass}
                value={identityDraft.userName}
                onChange={(event) =>
                  setIdentityDraft({
                    ...identityDraft,
                    userName: event.target.value,
                  })
                }
                placeholder="Riley"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                Device name
              </span>
              <input
                className={fieldClass}
                value={identityDraft.deviceName}
                onChange={(event) =>
                  setIdentityDraft({
                    ...identityDraft,
                    deviceName: event.target.value,
                  })
                }
                placeholder="Riley laptop"
              />
            </label>

            <label className="block lg:col-span-2">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                Device ID
              </span>
              <input
                className={fieldClass}
                value={setupState.identity.deviceId}
                readOnly
              />
            </label>
          </div>

          <div className="mt-5">
            <button className={primaryBtnClass} onClick={saveIdentity}>
              <Save size={14} />
              Save Identity
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Team Sync
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-text-muted">
                This syncs work, claimed areas, and notes only. Your source code
                stays in your normal project repos. Axiom Workspace uses GitHub
                so team sync stays free.
              </p>
            </div>
            <span className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-text-muted">
              Manual sync
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-md border border-border bg-surface-0 px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-text-muted">
                Status
              </p>
              <p className="mt-1 text-sm text-text-primary">
                {syncStatusLabel(syncStatus)}
              </p>
            </div>
            <div className="rounded-md border border-border bg-surface-0 px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-text-muted">
                Last sync
              </p>
              <p className="mt-1 text-sm text-text-primary">
                {formatDateTime(settings.lastSyncAt)}
              </p>
            </div>
            <div className="rounded-md border border-border bg-surface-0 px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-text-muted">
                Local events
              </p>
              <p className="mt-1 text-sm text-text-primary">{eventCount}</p>
            </div>
            <div className="rounded-md border border-border bg-surface-0 px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-text-muted">
                Connected
              </p>
              <p className="mt-1 text-sm text-text-primary">
                {setupState.setupComplete ? "Yes" : "Needs setup"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                Sync repo URL
              </span>
              <input className={fieldClass} value={settings.syncRepoUrl} readOnly />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                Local sync folder
              </span>
              <input
                className={fieldClass}
                value={settings.syncLocalPath}
                readOnly
              />
            </label>
          </div>

          {(settings.lastSyncStatus || settings.lastSyncError) && (
            <div
              className={`mt-5 rounded-md border px-3 py-2 text-sm ${
                settings.lastSyncError
                  ? "border-status-locked/40 bg-status-locked/10 text-status-locked"
                  : "border-status-clean/40 bg-status-clean/10 text-status-clean"
              }`}
            >
              {settings.lastSyncError || settings.lastSyncStatus}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className={primaryBtnClass}
              onClick={() => void onSyncNow()}
              disabled={syncing || !setupState.setupComplete}
            >
              {syncing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
            <button
              className={secondaryBtnClass}
              onClick={() => void onValidateSetup()}
              disabled={syncing}
            >
              <CheckCircle2 size={14} />
              Validate Read Access
            </button>
            {!setupState.setupComplete && (
              <button
                className={secondaryBtnClass}
                onClick={() =>
                  confirmReset(
                    "Reset setup and reconnect? This clears setup completion and identity, then shows onboarding again. It will not delete repos or folders.",
                    onResetSetup,
                  )
                }
              >
                <RotateCcw size={14} />
                Reconnect
              </button>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="mb-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Automation
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-text-muted">
              Axiom can keep repo status and coordination state fresh without
              touching project source code.
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-0 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Auto-refresh repo status
                </p>
                <p className="text-xs text-text-muted">
                  Refreshes on startup, window focus, and a quiet timer.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoRefreshReposEnabled}
                onChange={(event) =>
                  onSettingsChange({
                    ...settings,
                    autoRefreshReposEnabled: event.target.checked,
                  })
                }
                className="h-4 w-4 accent-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-0 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Auto-sync after work changes
                </p>
                <p className="text-xs text-text-muted">
                  Syncs after Start Work, Finish Work, note edits, app focus, and every few minutes.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoSyncEnabled}
                onChange={(event) =>
                  onSettingsChange({
                    ...settings,
                    autoSyncEnabled: event.target.checked,
                  })
                }
                className="h-4 w-4 accent-indigo-500"
              />
            </label>

            <label className="block rounded-md border border-border bg-surface-0 px-3 py-3">
              <span className="mb-1.5 block text-sm font-medium text-text-primary">
                Minimum refresh interval
              </span>
              <input
                className={fieldClass}
                type="number"
                min={120}
                step={30}
                value={settings.repoRefreshIntervalSeconds}
                onChange={(event) =>
                  onSettingsChange({
                    ...settings,
                    repoRefreshIntervalSeconds: Math.max(
                      120,
                      Number(event.target.value) || 120,
                    ),
                  })
                }
              />
              <p className="mt-1 text-xs text-text-muted">
                Minimum is 120 seconds.
              </p>
            </label>

            <label className="block rounded-md border border-border bg-surface-0 px-3 py-3">
              <span className="mb-1.5 block text-sm font-medium text-text-primary">
                Repo discovery paths
              </span>
              <textarea
                className={`${fieldClass} min-h-24 resize-none font-mono text-xs`}
                value={settings.repoDiscoveryPaths.join("\n")}
                onChange={(event) =>
                  onSettingsChange({
                    ...settings,
                    repoDiscoveryPaths: event.target.value
                      .split(/\r?\n/)
                      .map((line) => line.trim())
                      .filter(Boolean),
                  })
                }
              />
              <p className="mt-1 text-xs text-text-muted">
                Discovery uses these standard folders and limits scans to three levels.
              </p>
            </label>

            <button className={secondaryBtnClass} onClick={onResetDismissedSuggestions}>
              <RotateCcw size={14} />
              Reset dismissed suggestions
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="mb-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Diagnostics
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-text-muted">
              A quick health snapshot for setup, sync, and local coordination.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {diagnostics.map((item) => (
              <div
                key={item.label}
                className="rounded-md border border-border bg-surface-0 px-3 py-3"
              >
                <p className="text-xs uppercase tracking-wide text-text-muted">
                  {item.label}
                </p>
                <p className="mt-1 break-words text-sm text-text-primary">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface-1 p-5">
          <div className="mb-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Setup Checklist
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {checklist.map((item) => (
              <div
                key={item.key}
                className="flex items-start justify-between gap-4 rounded-md border border-border bg-surface-0 px-3 py-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <StatusIcon status={item.status} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-text-muted">
                      {item.message}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-text-muted">
                  {statusCopy[item.status]}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface-1 p-5">
          <button
            className="flex w-full items-center justify-between text-left"
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Advanced Sync Settings
              </h3>
              <p className="mt-1 text-sm text-text-muted">
                Main users should not need these controls.
              </p>
            </div>
            {advancedOpen ? (
              <ChevronDown size={18} className="text-text-muted" />
            ) : (
              <ChevronRight size={18} className="text-text-muted" />
            )}
          </button>

          {advancedOpen && (
            <div className="mt-5 space-y-5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                  Sync repo URL override
                </span>
                <input
                  className={fieldClass}
                  value={repoUrlDraft}
                  onChange={(event) => setRepoUrlDraft(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                  Local sync path override
                </span>
                <input
                  className={fieldClass}
                  value={syncPathDraft}
                  onChange={(event) => setSyncPathDraft(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className={secondaryBtnClass} onClick={saveAdvanced}>
                  <Save size={14} />
                  Save Advanced Settings
                </button>
                <button
                  className={secondaryBtnClass}
                  onClick={() => void onValidateSetup()}
                >
                  <RefreshCw size={14} />
                  Re-check Prerequisites
                </button>
              </div>

              <div className="border-t border-border pt-5">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                  Reset
                </h4>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-text-muted">
                  Uninstalling the app may keep local setup data. Use these controls
                  when testing a fresh install. These actions do not delete
                  project repos, source code, or the sync repo folder.
                </p>
                <div className="mt-3 rounded-md border border-border bg-surface-0 px-3 py-2.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">
                    To fully reset local app data on Windows
                  </p>
                  <p className="text-xs text-text-secondary leading-5">
                    Delete these folders after uninstalling:
                  </p>
                  <code className="mt-1 block text-xs text-text-muted font-mono">%LOCALAPPDATA%\Axiom Workspace</code>
                  <code className="mt-0.5 block text-xs text-text-muted font-mono">%APPDATA%\Axiom Workspace</code>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <button
                    className={secondaryBtnClass}
                    onClick={() =>
                      confirmReset(
                        "Reset setup only? This clears setup completion and identity, then shows onboarding again. It will not delete repos or folders.",
                        onResetSetup,
                      )
                    }
                  >
                    <RotateCcw size={14} />
                    Reset setup only
                  </button>
                  <button
                    className={secondaryBtnClass}
                    onClick={() =>
                      confirmReset(
                        "Reset work and claimed areas? This clears local work, claimed areas, and local sync events. It will not remove repo paths or setup.",
                        onResetSessionsAndLocks,
                      )
                    }
                  >
                    <RotateCcw size={14} />
                    Reset work and claimed areas
                  </button>
                  <button
                    className={secondaryBtnClass}
                    onClick={() =>
                      confirmReset(
                        "Reset sync state? This clears local sync settings and events and disconnects this app from the sync repo. It will not delete the sync repo folder.",
                        onResetSyncState,
                      )
                    }
                  >
                    <RotateCcw size={14} />
                    Reset sync state
                  </button>
                  <button
                    className={secondaryBtnClass}
                    onClick={() =>
                      confirmReset(
                        "Full reset local app data? This clears all Axiom Workspace localStorage keys and reloads the app. It will not delete project repos, source code, or sync folders.",
                        onFullLocalReset,
                      )
                    }
                  >
                    <RotateCcw size={14} />
                    Full reset local app data
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
