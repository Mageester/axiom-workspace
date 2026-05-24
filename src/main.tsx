import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./index.css";

function getWindowLabel(): string {
  try {
    return getCurrentWindow().label;
  } catch {
    return "main";
  }
}

const label = getWindowLabel();

async function renderApp() {
  if (label === "tray-widget") {
    const { default: WidgetApp } = await import("./WidgetApp");
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <WidgetApp />
      </React.StrictMode>,
    );
  } else {
    const { default: App } = await import("./App");
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  }
}

void renderApp();
