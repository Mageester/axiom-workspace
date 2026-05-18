import { openUrl } from "@tauri-apps/plugin-opener";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import axiomMark from "../../app-icon.png";
import type { DeviceIdentity, SetupChecklistItem, SetupStatus } from "../types";
import { GIT_FOR_WINDOWS_URL } from "../lib/sync";
import { primaryBtnClass, secondaryBtnClass } from "../lib/constants";

interface OnboardingPageProps {
  identity: DeviceIdentity;
  checklist: SetupChecklistItem[];
  busy: boolean;
  message: string;
  error: string;
  onIdentityChange: (identity: DeviceIdentity) => void;
  onConnect: () => Promise<void>;
  onRecheck: () => Promise<void>;
}

const fieldClass =
  "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent";

const statusCopy: Record<SetupStatus, string> = {
  complete: "Complete",
  missing: "Missing",
  needs_action: "Needs action",
  error: "Error",
  checking: "Checking",
};

function StatusIcon({ status }: { status: SetupStatus }) {
  if (status === "complete") {
    return <CheckCircle2 size={16} className="text-status-clean" />;
  }
  if (status === "checking") {
    return <Loader2 size={16} className="animate-spin text-accent" />;
  }
  return <AlertCircle size={16} className="text-status-dirty" />;
}

function statusClass(status: SetupStatus): string {
  if (status === "complete") {
    return "border-status-clean/30 bg-status-clean/10 text-status-clean";
  }
  if (status === "checking") {
    return "border-accent/30 bg-accent/10 text-accent-hover";
  }
  if (status === "error") {
    return "border-status-locked/30 bg-status-locked/10 text-status-locked";
  }
  return "border-status-dirty/30 bg-status-dirty/10 text-status-dirty";
}

export function OnboardingPage({
  identity,
  checklist,
  busy,
  message,
  error,
  onIdentityChange,
  onConnect,
  onRecheck,
}: OnboardingPageProps) {
  const gitMissing = checklist.some(
    (item) => item.key === "git" && item.status === "missing",
  );

  return (
    <div className="min-h-screen bg-surface-0 text-text-primary">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10">
        <section className="grid w-full grid-cols-1 gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex flex-col justify-center">
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-black">
              <img
                src={axiomMark}
                alt=""
                className="h-10 w-10 object-contain"
                aria-hidden="true"
              />
            </div>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-normal text-text-primary">
              Welcome to Axiom Workspace
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-text-secondary">
              Axiom Workspace keeps Aidan and Riley coordinated across repos,
              sessions, and soft locks.
            </p>
            <div className="mt-6 flex max-w-xl items-start gap-3 rounded-lg border border-border bg-surface-1 p-4">
              <ShieldCheck
                size={18}
                className="mt-0.5 shrink-0 text-status-clean"
              />
              <p className="text-sm leading-6 text-text-secondary">
                This syncs coordination state only. It does not sync your source
                code.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-1 p-6 shadow-2xl shadow-black/30">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-text-primary">
                Connect to Axiom Team Workspace
              </h2>
              <p className="mt-1 text-sm leading-6 text-text-muted">
                Axiom checks what is installed, skips anything already ready,
                and asks before opening a download page.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-muted">
                  Your name
                </span>
                <input
                  className={fieldClass}
                  value={identity.userName}
                  onChange={(event) =>
                    onIdentityChange({
                      ...identity,
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
                  value={identity.deviceName}
                  onChange={(event) =>
                    onIdentityChange({
                      ...identity,
                      deviceName: event.target.value,
                    })
                  }
                  placeholder="Riley laptop"
                />
              </label>
            </div>

            <div className="mt-6 space-y-3">
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
                  <span
                    className={`shrink-0 rounded-md border px-2 py-1 text-xs ${statusClass(
                      item.status,
                    )}`}
                  >
                    {statusCopy[item.status]}
                  </span>
                </div>
              ))}
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

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                className={primaryBtnClass}
                onClick={() => void onConnect()}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Connect to Axiom Team Workspace
              </button>
              <button
                className={secondaryBtnClass}
                onClick={() => void onRecheck()}
                disabled={busy}
              >
                <RefreshCw size={14} />
                Re-check Git
              </button>
              {gitMissing && (
                <button
                  className={secondaryBtnClass}
                  onClick={() => void openUrl(GIT_FOR_WINDOWS_URL)}
                  disabled={busy}
                >
                  <Download size={14} />
                  Install Git
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
