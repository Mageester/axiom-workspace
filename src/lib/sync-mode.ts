import type { SetupState, SyncSettings, SyncStatus } from "../types";
import { timeAgo } from "./format";

export type SyncMode = "local" | "github" | "cloud" | "cloud_unavailable" | "offline" | "not_configured" | "sync_failed";
export type LastSyncSource = "Local" | "GitHub" | "Cloudflare" | "None";

export interface SyncModeInfo {
  mode: SyncMode;
  label: string;
  detail: string;
  savedLabel: string;
  lastSuccessfulSource: LastSyncSource;
  backendHealth: "healthy" | "unavailable" | "not checked";
  cloudConfigured: boolean;
  tokenConfigured: boolean;
  isSyncing: boolean;
  isError: boolean;
  dotClass: string;
  textClass: string;
}

export function getSyncModeInfo(
  setupState: SetupState,
  settings: SyncSettings,
  syncStatus: SyncStatus,
  cloudSyncUnavailable: boolean,
): SyncModeInfo {
  const cloudConfigured = Boolean(settings.cloudSyncEndpoint?.trim());
  const tokenConfigured = Boolean(settings.cloudSyncDeviceToken?.trim());
  const isSyncing = syncStatus !== "idle" && syncStatus !== "complete" && syncStatus !== "error";
  const isError = syncStatus === "error" || Boolean(settings.lastSyncError);

  let mode: SyncMode = "local";
  if (isError) mode = "sync_failed";
  else if (cloudConfigured && tokenConfigured && cloudSyncUnavailable) mode = "cloud_unavailable";
  else if (cloudConfigured && tokenConfigured && !cloudSyncUnavailable && settings.cloudSyncLastCheckedAt) mode = "cloud";
  else if (setupState.setupComplete && settings.syncLocalPath.trim()) mode = "github";
  else if (cloudConfigured || tokenConfigured) mode = "not_configured";

  const lastSuccessfulSource: LastSyncSource =
    mode === "cloud" ? "Cloudflare" :
    setupState.setupComplete && settings.lastSyncAt ? "GitHub" :
    settings.lastSyncAt ? "Local" : "None";

  const savedLabel =
    mode === "local" || mode === "not_configured"
      ? settings.lastSyncAt ? `Saved ${timeAgo(settings.lastSyncAt)}` : "Saved locally"
      : settings.lastSyncAt ? `Synced ${timeAgo(settings.lastSyncAt)}` : "Not synced yet";

  const table: Record<SyncMode, Pick<SyncModeInfo, "label" | "detail" | "backendHealth" | "dotClass" | "textClass">> = {
    local: {
      label: "Local mode",
      detail: "Saved on this device",
      backendHealth: "not checked",
      dotClass: "bg-status-clean",
      textClass: "text-status-clean",
    },
    github: {
      label: "GitHub sync",
      detail: savedLabel,
      backendHealth: "not checked",
      dotClass: "bg-status-clean",
      textClass: "text-status-clean",
    },
    cloud: {
      label: "Cloud sync",
      detail: savedLabel,
      backendHealth: "healthy",
      dotClass: "bg-status-clean",
      textClass: "text-status-clean",
    },
    cloud_unavailable: {
      label: "Cloud sync unavailable",
      detail: "Using local cache",
      backendHealth: "unavailable",
      dotClass: "bg-status-dirty",
      textClass: "text-status-dirty",
    },
    offline: {
      label: "Offline",
      detail: "Using local cache",
      backendHealth: "unavailable",
      dotClass: "bg-status-dirty",
      textClass: "text-status-dirty",
    },
    not_configured: {
      label: "Not configured",
      detail: "Cloud sync needs endpoint and token",
      backendHealth: "not checked",
      dotClass: "bg-text-muted",
      textClass: "text-text-muted",
    },
    sync_failed: {
      label: "Sync failed",
      detail: settings.lastSyncError || "Open Settings to resolve",
      backendHealth: cloudConfigured && tokenConfigured ? "unavailable" : "not checked",
      dotClass: "bg-status-locked",
      textClass: "text-status-locked",
    },
  };

  const presentation = table[mode];
  return {
    mode,
    ...presentation,
    detail: isSyncing ? "Syncing" : presentation.detail,
    savedLabel,
    lastSuccessfulSource,
    cloudConfigured,
    tokenConfigured,
    isSyncing,
    isError,
  };
}
