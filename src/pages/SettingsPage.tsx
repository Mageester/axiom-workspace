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
import { fieldClass, labelClass, primaryBtnClass, secondaryBtnClass } from "../lib/constants";

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

const statusCopy: Record<SetupStatus, string> = {
  complete: "Done",
  missing: "Not found",
  needs_action: "Action needed",
  error: "Problem",
  checking: "Checking...",
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
      return "Checking...";
    case "writing_local_events":
      return "Saving your changes...";
    case "pulling_updates":
      return "Getting team updates...";
    case "reading_shared_events":
      return "Reading team activity...";
    case "merging":
      return "Combining updates...";
    case "pushing":
      return "Sharing with team...";
    case "complete":
      return "Up to date";
    case "error":
      return "Needs attention";
    default:
      return "Ready";
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
    { label: "Git version", value: gitVersion || "Not checked" },
    { label: "Repos", value: String(repoCount) },
    { label: "Active", value: String(activeSessionCount) },
    { label: "Events", value: String(eventCount) },
    { label: "Last sync", value: formatDateTime(settings.lastSyncAt) },
  ];

  function saveIdentity() {
    onIdentityChange({
      ...identityDraft,
      userName: identityDraft.userName.trim(),
      deviceName: identityDraft.deviceName.trim() || "Axiom Device",
    });
  }

  function confirmReset(message: string, action: () => void) {
    if (window.confirm(message)) {
      action();
    }
  }

  return (
    <div className="flex-1 overflow-auto bg-surface-0">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Configure your identity and workspace automation."
      />

      <main className="max-w-4xl mx-auto p-8 space-y-12">
        {/* Identity Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted">
              Identity
            </h3>
            <button className="text-xs font-semibold text-accent-hover hover:underline" onClick={saveIdentity}>
              Save changes
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">Display Name</label>
              <input
                className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border/50 focus:border-accent/50 focus:ring-1 focus:ring-accent/20 outline-none transition-all"
                value={identityDraft.userName}
                onChange={(e) => setIdentityDraft({ ...identityDraft, userName: e.target.value })}
                placeholder="Riley"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">Device Name</label>
              <input
                className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border/50 focus:border-accent/50 focus:ring-1 focus:ring-accent/20 outline-none transition-all"
                value={identityDraft.deviceName}
                onChange={(e) => setIdentityDraft({ ...identityDraft, deviceName: e.target.value })}
                placeholder="Riley Laptop"
              />
            </div>
          </div>
        </section>

        {/* Automation Section */}
        <section className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted">
            Automation
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-1/50 border border-border/40">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">Auto-refresh project status</p>
                <p className="text-xs text-text-muted mt-0.5">Keep repo states fresh while working</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoRefreshReposEnabled}
                onChange={(e) => onSettingsChange({ ...settings, autoRefreshReposEnabled: e.target.checked })}
                className="w-5 h-5 accent-accent"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-1/50 border border-border/40">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">Auto-sync changes</p>
                <p className="text-xs text-text-muted mt-0.5">Share work status with the team automatically</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoSyncEnabled}
                onChange={(e) => onSettingsChange({ ...settings, autoSyncEnabled: e.target.checked })}
                className="w-5 h-5 accent-accent"
              />
            </div>
          </div>
        </section>

        {/* Diagnostics Summary */}
        <section className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-text-muted">
            Health & Diagnostics
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {diagnostics.map(item => (
              <div key={item.label} className="p-4 rounded-2xl bg-surface-1/50 border border-border/40">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{item.label}</p>
                <p className="text-sm font-medium text-text-primary mt-1 truncate">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              className="h-10 px-4 rounded-xl bg-surface-2 border border-border/50 text-xs font-semibold text-text-primary hover:bg-surface-3 transition-all flex items-center gap-2"
              onClick={() => void onSyncNow()}
              disabled={syncing}
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Sync Now
            </button>
            <button
              className="h-10 px-4 rounded-xl bg-surface-2 border border-border/50 text-xs font-semibold text-text-primary hover:bg-surface-3 transition-all flex items-center gap-2"
              onClick={() => void onValidateSetup()}
            >
              <CheckCircle2 size={14} />
              Validate Setup
            </button>
          </div>
        </section>

        {/* Advanced Section */}
        <section className="pt-8 border-t border-border/30">
          <button
            className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors"
            onClick={() => setAdvancedOpen(!advancedOpen)}
          >
            {advancedOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className="text-xs font-bold uppercase tracking-wider">Advanced Settings</span>
          </button>

          {advancedOpen && (
            <div className="mt-8 space-y-10 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-6">
                 <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-text-secondary">Sync Repo URL</label>
                    <input className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border/50 text-text-muted font-mono text-xs" value={settings.syncRepoUrl} readOnly />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-text-secondary">Local Sync path</label>
                    <input className="w-full h-11 px-4 rounded-xl bg-surface-1 border border-border/50 text-text-muted font-mono text-xs" value={settings.syncLocalPath} readOnly />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                 <h4 className="text-xs font-bold uppercase tracking-wider text-status-locked">Danger Zone</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      className="h-10 px-4 rounded-xl bg-status-locked/5 border border-status-locked/20 text-xs font-medium text-status-locked hover:bg-status-locked/10 transition-all text-left"
                      onClick={() => confirmReset("Full reset local app data? This clears all local state and reloads the app.", onFullLocalReset)}
                    >
                      Full Local Reset
                    </button>
                    <button
                      className="h-10 px-4 rounded-xl bg-status-locked/5 border border-status-locked/20 text-xs font-medium text-status-locked hover:bg-status-locked/10 transition-all text-left"
                      onClick={() => confirmReset("Reset sync state? This disconnects the app from the sync repo.", onResetSyncState)}
                    >
                      Reset Sync State
                    </button>
                    <button
                      className="h-10 px-4 rounded-xl bg-status-locked/5 border border-status-locked/20 text-xs font-medium text-status-locked hover:bg-status-locked/10 transition-all text-left"
                      onClick={() => confirmReset("Reset work and claimed areas?", onResetSessionsAndLocks)}
                    >
                      Reset Sessions & Locks
                    </button>
                    <button
                      className="h-10 px-4 rounded-xl bg-status-locked/5 border border-status-locked/20 text-xs font-medium text-status-locked hover:bg-status-locked/10 transition-all text-left"
                      onClick={() => confirmReset("Reset setup and reconnect?", onResetSetup)}
                    >
                      Reconnect Setup
                    </button>
                 </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface-1/30 border border-border/30">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">Last System Error</p>
                 <p className="text-xs font-mono text-status-locked break-all">{lastError}</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
