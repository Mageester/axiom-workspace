import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { TrayNotification, TrayWidgetState } from "./types";
import { TrayWidget } from "./components/TrayWidget";

const EMPTY_STATE: TrayWidgetState = {
  activeSessions: [],
  repos: [],
  recentEvents: [],
  boardSummary: { inbox: 0, ready: 0, in_progress: 0, blocked: 0, review: 0, done: 0, assignedToYou: 0 },
  syncStatus: "idle",
  currentUser: "",
};

export default function WidgetApp() {
  const [state, setState] = useState<TrayWidgetState>(EMPTY_STATE);
  const [notifications, setNotifications] = useState<TrayNotification[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    void (async () => {
      const u1 = await listen<TrayWidgetState>("widget:state-update", (e) => {
        setState(e.payload);
        const s = e.payload.syncStatus;
        setIsSyncing(s !== "idle" && s !== "complete" && s !== "error");
      });
      unlisteners.push(u1);

      const u2 = await listen<TrayNotification>("widget:notification", (e) => {
        setNotifications((prev) => [...prev, e.payload]);
      });
      unlisteners.push(u2);
    })();

    return () => unlisteners.forEach((u) => u());
  }, []);

  // Prevent widget window from actually closing — just hide it
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      const win = getCurrentWindow();
      unlisten = await win.onCloseRequested(async (event) => {
        event.preventDefault();
        await win.hide();
      });
    })();
    return () => unlisten?.();
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleSyncNow = useCallback(() => {
    void import("@tauri-apps/api/event").then(({ emit }) =>
      emit("widget:sync-request")
    );
  }, []);

  const handleOpenMainWindow = useCallback(() => {
    void import("@tauri-apps/api/event").then(({ emit }) =>
      emit("widget:open-main")
    );
  }, []);

  const handleFinishCurrent = useCallback(() => {
    void import("@tauri-apps/api/event").then(({ emit }) =>
      emit("widget:finish-current")
    );
  }, []);

  const handleClose = useCallback(async () => {
    const win = getCurrentWindow();
    await win.hide();
  }, []);

  return (
    <div className="w-screen h-screen bg-transparent">
      <TrayWidget
        state={state}
        notifications={notifications}
        expanded={expanded}
        isSyncing={isSyncing}
        onToggleExpand={() => setExpanded((v) => !v)}
        onClose={handleClose}
        onSyncNow={handleSyncNow}
        onOpenMainWindow={handleOpenMainWindow}
        onFinishCurrent={handleFinishCurrent}
        onDismissNotification={dismissNotification}
      />
    </div>
  );
}
