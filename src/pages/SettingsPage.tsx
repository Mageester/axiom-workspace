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

function formatDateTime(value?: string): string {
  if (!value) {
    return "never";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

// Sleek CSS Interactive Toggle Switch Component
interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Switch({ checked, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none ${
        checked ? "bg-accent" : "bg-surface-3 border border-border/20"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-150 ease-in-out ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const syncing = syncStatus !== "idle" && syncStatus !== "complete" && syncStatus !== "error";
  const lastError = settings.lastSyncError || setupState.lastError || "No recent errors";
  
  const diagnostics = [
    { label: "App version", value: appVersion },
    { label: "Git version", value: gitVersion || "Not checked" },
    { label: "Tracked Repos", value: String(repoCount) },
    { label: "Active Sessions", value: String(activeSessionCount) },
    { label: "Logged Events", value: String(eventCount) },
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

  const isIdentityChanged = 
    identityDraft.userName.trim() !== setupState.identity.userName ||
    identityDraft.deviceName.trim() !== setupState.identity.deviceName;

  return (
    <div className="flex-1 overflow-auto bg-surface-0 select-none">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Configure your identity and workspace automation."
      />

      <main className="max-w-2xl mx-auto p-6 md:p-8 space-y-8">
        {/* 1. Identity Section */}
        <section className="space-y-4 p-4 md:p-5 rounded-2xl border border-border/20 bg-surface-1/40">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Identity Profile
            </h3>
            {isIdentityChanged && (
              <button 
                className="text-xs font-bold text-accent hover:text-accent-hover transition-colors flex items-center gap-1" 
                onClick={saveIdentity}
              >
                <Save size={12} />
                Save Changes
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Display Name</label>
              <input
                className="w-full h-9 px-3 rounded-lg bg-surface-1 border border-border/40 focus:border-accent/40 text-xs font-semibold text-text-primary outline-none transition-all"
                value={identityDraft.userName}
                onChange={(e) => setIdentityDraft({ ...identityDraft, userName: e.target.value })}
                placeholder="Riley"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Device Name</label>
              <input
                className="w-full h-9 px-3 rounded-lg bg-surface-1 border border-border/40 focus:border-accent/40 text-xs font-semibold text-text-primary outline-none transition-all"
                value={identityDraft.deviceName}
                onChange={(e) => setIdentityDraft({ ...identityDraft, deviceName: e.target.value })}
                placeholder="Riley Laptop"
              />
            </div>
          </div>
        </section>

        {/* 2. Automation Section */}
        <section className="space-y-4 p-4 md:p-5 rounded-2xl border border-border/20 bg-surface-1/40">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Workspace Automation
          </h3>
          
          <div className="space-y-3">
            {/* Auto refresh project status */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-2/20 border border-border/15 hover:bg-surface-2/30 transition-colors">
              <div className="min-w-0 pr-4">
                <p className="text-xs font-bold text-text-primary">Auto-refresh project status</p>
                <p className="text-[11px] text-text-muted mt-0.5">Keep repo states fresh while working</p>
              </div>
              <Switch
                checked={settings.autoRefreshReposEnabled}
                onChange={(checked) => onSettingsChange({ ...settings, autoRefreshReposEnabled: checked })}
              />
            </div>

            {/* Auto sync changes */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-2/20 border border-border/15 hover:bg-surface-2/30 transition-colors">
              <div className="min-w-0 pr-4">
                <p className="text-xs font-bold text-text-primary">Auto-sync changes</p>
                <p className="text-[11px] text-text-muted mt-0.5">Share work status with the team automatically</p>
              </div>
              <Switch
                checked={settings.autoSyncEnabled}
                onChange={(checked) => onSettingsChange({ ...settings, autoSyncEnabled: checked })}
              />
            </div>
          </div>
        </section>

        {/* 3. Health & Diagnostics Summary */}
        <section className="space-y-4 p-4 md:p-5 rounded-2xl border border-border/20 bg-surface-1/40">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Workspace Diagnostics
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {diagnostics.map(item => (
              <div key={item.label} className="p-3 rounded-xl bg-surface-2/25 border border-border/15">
                <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">{item.label}</p>
                <p className="text-xs font-bold text-text-primary mt-1 truncate">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              className="h-8.5 px-3.5 rounded-lg bg-surface-2 border border-border/50 text-[10px] font-bold text-text-primary hover:bg-surface-3 transition-all flex items-center gap-1.5 active:scale-[0.98]"
              onClick={() => void onSyncNow()}
              disabled={syncing}
            >
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Sync Now
            </button>
            <button
              className="h-8.5 px-3.5 rounded-lg bg-surface-2 border border-border/50 text-[10px] font-bold text-text-primary hover:bg-surface-3 transition-all flex items-center gap-1.5 active:scale-[0.98]"
              onClick={() => void onValidateSetup()}
            >
              <CheckCircle2 size={12} />
              Validate Setup
            </button>
          </div>
        </section>

        {/* 4. Advanced (Secondary/System information) */}
        <section className="pt-4 border-t border-border/20">
          <button
            className="flex items-center gap-1.5 text-text-muted hover:text-text-primary transition-colors outline-none"
            onClick={() => setAdvancedOpen(!advancedOpen)}
          >
            {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="text-[9px] font-bold uppercase tracking-widest">Advanced Configuration</span>
          </button>

          {advancedOpen && (
            <div className="mt-4 space-y-4 animate-slide-in">
              <div className="p-4 rounded-xl border border-border/20 bg-surface-1/25 space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Sync Repo Remote URL</label>
                    <input className="w-full h-8 px-2.5 rounded bg-surface-2 border border-border/40 text-text-secondary font-mono text-[10px]" value={settings.syncRepoUrl} readOnly />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-text-muted">Local Sync Folder path</label>
                    <input className="w-full h-8 px-2.5 rounded bg-surface-2 border border-border/40 text-text-secondary font-mono text-[10px]" value={settings.syncLocalPath} readOnly />
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="p-4 rounded-xl border border-status-locked/15 bg-status-locked/5 space-y-3">
                <h4 className="text-[9px] font-bold uppercase tracking-widest text-status-locked">Danger Zone</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  <button
                    className="h-8.5 px-3 rounded-lg bg-status-locked/5 border border-status-locked/20 text-[10px] font-bold text-status-locked hover:bg-status-locked/10 transition-all text-left"
                    onClick={() => confirmReset("Full reset local app data? This clears all local state and reloads the app.", onFullLocalReset)}
                  >
                    Full Local Reset
                  </button>
                  <button
                    className="h-8.5 px-3 rounded-lg bg-status-locked/5 border border-status-locked/20 text-[10px] font-bold text-status-locked hover:bg-status-locked/10 transition-all text-left"
                    onClick={() => confirmReset("Reset sync state? This disconnects the app from the sync repo.", onResetSyncState)}
                  >
                    Reset Sync State
                  </button>
                  <button
                    className="h-8.5 px-3 rounded-lg bg-status-locked/5 border border-status-locked/20 text-[10px] font-bold text-status-locked hover:bg-status-locked/10 transition-all text-left"
                    onClick={() => confirmReset("Reset work and claimed areas?", onResetSessionsAndLocks)}
                  >
                    Reset Sessions & Locks
                  </button>
                  <button
                    className="h-8.5 px-3 rounded-lg bg-status-locked/5 border border-status-locked/20 text-[10px] font-bold text-status-locked hover:bg-status-locked/10 transition-all text-left"
                    onClick={() => confirmReset("Reset setup and reconnect?", onResetSetup)}
                  >
                    Reconnect Setup
                  </button>
                </div>
              </div>

              {/* Logs */}
              <div className="p-3.5 rounded-xl border border-border/20 bg-surface-1/20 font-mono">
                <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-1.5">Last System Error</p>
                <p className="text-[10px] text-status-locked break-all leading-relaxed">{lastError}</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
