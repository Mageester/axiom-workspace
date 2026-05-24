import { Minus, Square, X } from "lucide-react";
import axiomMark from "/axiom-mark.png";

async function currentWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      className="flex h-8 shrink-0 items-center justify-between border-b border-border/20 bg-surface-0/95 select-none"
    >
      <div data-tauri-drag-region className="flex items-center gap-2 px-3">
        <img src={axiomMark} alt="" className="h-4 w-4 object-contain" aria-hidden="true" />
        <span className="text-[11px] font-semibold text-text-muted">Axiom Workspace</span>
      </div>
      <div className="flex h-full">
        <button
          className="flex h-full w-11 items-center justify-center text-text-muted hover:bg-surface-2 hover:text-text-primary"
          onClick={() => void currentWindow().then((win) => win.minimize())}
          aria-label="Minimize"
        >
          <Minus size={13} />
        </button>
        <button
          className="flex h-full w-11 items-center justify-center text-text-muted hover:bg-surface-2 hover:text-text-primary"
          onClick={() => void currentWindow().then((win) => win.toggleMaximize())}
          aria-label="Maximize"
        >
          <Square size={11} />
        </button>
        <button
          className="flex h-full w-11 items-center justify-center text-text-muted hover:bg-status-locked hover:text-white"
          onClick={() => void currentWindow().then((win) => win.close())}
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
