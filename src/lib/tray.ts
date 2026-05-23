import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface TrayCallbacks {
  onToggleWidget: () => void;
  onSyncNow: () => void;
  onOpenMainWindow: () => void;
  onQuit: () => void;
}

let trayInstance: TrayIcon | null = null;

export async function initTray(callbacks: TrayCallbacks): Promise<TrayIcon> {
  if (trayInstance) return trayInstance;

  const showHide = await MenuItem.new({
    id: "toggle-widget",
    text: "Show/Hide Widget",
    action: callbacks.onToggleWidget,
  });

  const syncNow = await MenuItem.new({
    id: "sync-now",
    text: "Sync Now",
    action: callbacks.onSyncNow,
  });

  const openApp = await MenuItem.new({
    id: "open-app",
    text: "Open Axiom Workspace",
    action: callbacks.onOpenMainWindow,
  });

  const separator = await PredefinedMenuItem.new({ item: "Separator" });

  const quit = await MenuItem.new({
    id: "quit",
    text: "Quit",
    action: callbacks.onQuit,
  });

  const menu = await Menu.new({
    items: [showHide, syncNow, openApp, separator, quit],
  });

  trayInstance = await TrayIcon.new({
    id: "axiom-tray",
    menu,
    tooltip: "Axiom Workspace",
    showMenuOnLeftClick: false,
    action: (event) => {
      if (event.type === "Click" && event.button === "Left" && event.buttonState === "Up") {
        callbacks.onToggleWidget();
      }
    },
  });

  return trayInstance;
}

export async function updateTrayTooltip(text: string) {
  if (trayInstance) {
    await trayInstance.setTooltip(text);
  }
}

export async function destroyTray() {
  if (trayInstance) {
    await TrayIcon.removeById("axiom-tray");
    trayInstance = null;
  }
}

export async function openMainWindow() {
  const win = getCurrentWindow();
  await win.show();
  await win.unminimize();
  await win.setFocus();
}
