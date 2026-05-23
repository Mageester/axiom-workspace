import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo } from "@tauri-apps/api/event";
import { resolveResource } from "@tauri-apps/api/path";
import { Image } from "@tauri-apps/api/image";
import type { TrayNotification, TrayWidgetState } from "../types";

export interface TrayCallbacks {
  onSyncNow: () => void;
  onQuit: () => void;
}

let trayInstance: TrayIcon | null = null;
let widgetWindow: WebviewWindow | null = null;

export async function createWidgetWindow(): Promise<WebviewWindow> {
  const existing = await WebviewWindow.getByLabel("tray-widget");
  if (existing) {
    widgetWindow = existing;
    return existing;
  }

  // Position bottom-right of primary monitor using available screen area
  const width = 380;
  const height = 540;
  let x = 100;
  let y = 100;

  try {
    const { availableMonitors, primaryMonitor } = await import("@tauri-apps/api/window");
    const primary = await primaryMonitor();
    if (primary) {
      const screenW = primary.size.width / primary.scaleFactor;
      const screenH = primary.size.height / primary.scaleFactor;
      x = Math.max(0, Math.round(screenW - width - 16));
      y = Math.max(0, Math.round(screenH - height - 60));
    } else {
      // Fallback: try first available monitor
      const monitors = await availableMonitors();
      if (monitors.length > 0) {
        const mon = monitors[0];
        const screenW = mon.size.width / mon.scaleFactor;
        const screenH = mon.size.height / mon.scaleFactor;
        x = Math.max(0, Math.round(screenW - width - 16));
        y = Math.max(0, Math.round(screenH - height - 60));
      }
    }
  } catch {
    // Fallback to reasonable defaults if monitor API fails
    x = 1200;
    y = 400;
  }

  const win = new WebviewWindow("tray-widget", {
    url: "index.html",
    width,
    height,
    x,
    y,
    decorations: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    focus: false,
    visible: true,
    title: "Axiom Widget",
  });

  widgetWindow = win;
  return win;
}

export async function initTray(callbacks: TrayCallbacks): Promise<TrayIcon> {
  if (trayInstance) return trayInstance;

  const toggleWidget = async () => {
    if (!widgetWindow) return;
    const visible = await widgetWindow.isVisible();
    if (visible) {
      await widgetWindow.hide();
    } else {
      await widgetWindow.show();
      await widgetWindow.setFocus();
    }
  };

  const showHide = await MenuItem.new({
    id: "toggle-widget",
    text: "Show/Hide Widget",
    action: () => void toggleWidget(),
  });

  const syncNow = await MenuItem.new({
    id: "sync-now",
    text: "Sync Now",
    action: callbacks.onSyncNow,
  });

  const openApp = await MenuItem.new({
    id: "open-app",
    text: "Open Axiom Workspace",
    action: () => void openMainWindow(),
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

  // Load tray icon
  let trayIconImage: Image | undefined;
  try {
    const iconPath = await resolveResource("icons/32x32.png");
    trayIconImage = await Image.fromPath(iconPath);
  } catch {
    // If icon load fails, try alternative path
    try {
      const iconPath = await resolveResource("icons/icon.png");
      trayIconImage = await Image.fromPath(iconPath);
    } catch {
      // Tray will show without custom icon
    }
  }

  const trayOptions: Parameters<typeof TrayIcon.new>[0] = {
    id: "axiom-tray",
    menu,
    tooltip: "Axiom Workspace",
    menuOnLeftClick: false,
    action: (event) => {
      if (event.type === "Click" && event.button === "Left" && event.buttonState === "Up") {
        void toggleWidget();
      }
    },
  };

  if (trayIconImage) {
    trayOptions.icon = trayIconImage;
  }

  trayInstance = await TrayIcon.new(trayOptions);

  return trayInstance;
}

export async function broadcastWidgetState(state: TrayWidgetState) {
  try {
    await emitTo("tray-widget", "widget:state-update", state);
  } catch { /* widget window may not exist yet */ }
}

export async function broadcastNotification(notification: TrayNotification) {
  try {
    await emitTo("tray-widget", "widget:notification", notification);
  } catch { /* widget window may not exist yet */ }
}

export async function updateTrayTooltip(text: string) {
  if (trayInstance) {
    await trayInstance.setTooltip(text);
  }
}

export async function openMainWindow() {
  const win = getCurrentWindow();
  await win.show();
  await win.unminimize();
  await win.setFocus();
}

export async function destroyTray() {
  if (trayInstance) {
    await TrayIcon.removeById("axiom-tray");
    trayInstance = null;
  }
}

export async function destroyWidgetWindow() {
  if (widgetWindow) {
    try { await widgetWindow.destroy(); } catch { /* already gone */ }
    widgetWindow = null;
  }
}
