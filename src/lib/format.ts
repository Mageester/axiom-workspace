export function timeAgo(timestamp: string | undefined, fallback = "never"): string {
  if (!timestamp) return fallback;
  const ms = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(ms) || ms < 0) return fallback;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatElapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function syncStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    idle: "Local mode",
    checking: "Syncing",
    writing_local_events: "Syncing",
    pulling_updates: "Syncing",
    reading_shared_events: "Syncing",
    merging: "Syncing",
    pushing: "Syncing",
    complete: "Saved",
    error: "Sync Error",
  };
  return labels[status] || "Unknown";
}

export function syncStatusColor(status: string): string {
  if (status === "error") return "text-status-locked";
  if (status === "complete" || status === "idle") return "text-status-clean";
  return "text-status-dirty";
}

export function statusColorClass(status: string): string {
  const colors: Record<string, string> = {
    clean: "bg-status-clean",
    dirty: "bg-status-dirty",
    behind: "bg-status-behind",
    locked: "bg-status-locked",
    error: "bg-status-locked",
  };
  return colors[status] || "bg-text-muted";
}

export function sessionDurationStage(startedAt: string): { text: string; bg: string } {
  const ms = Date.now() - new Date(startedAt).getTime();
  const hours = ms / (60 * 60 * 1000);
  if (hours < 1) return { text: "text-status-clean", bg: "bg-status-clean" };
  if (hours < 4) return { text: "text-accent", bg: "bg-accent" };
  if (hours < 8) return { text: "text-status-dirty", bg: "bg-status-dirty" };
  return { text: "text-status-locked", bg: "bg-status-locked" };
}
