import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emitTo } from "@tauri-apps/api/event";
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

  const primary = getCurrentWindow();
  const factor = await primary.scaleFactor();
  const screen = await primary.outerSize();

  const width = 370;
  const height = 520;
  const x = Math.round((screen.width / factor) - width - 16);
  const y = Math.round((screen.height / factor) - height - 60);

  const win = new WebviewWindow("tray-widget", {
    url: "index.html",
    width,
    height,
    x: Math.max(0, x),
    y: Math.max(0, y),
    decorations: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
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

  trayInstance = await TrayIcon.new({
    id: "axiom-tray",
    menu,
    tooltip: "Axiom Workspace",
    showMenuOnLeftClick: false,
    action: (event) => {
      if (event.type === "Click" && event.button === "Left" && event.buttonState === "Up") {
        void toggleWidget();
      }
    },
  });

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
