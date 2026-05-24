import { invoke } from "@tauri-apps/api/core";

export type ProjectOpenAction = "code" | "folder" | "terminal";

export interface ProjectActionResult {
  ok: boolean;
  message?: string;
}

const CODE_UNAVAILABLE_MESSAGE =
  "Unable to open VS Code.\nMake sure the code command is installed and available on this device.";

function safeActionError(action: ProjectOpenAction): ProjectActionResult {
  if (action === "code") {
    return { ok: false, message: CODE_UNAVAILABLE_MESSAGE };
  }
  if (action === "terminal") {
    return {
      ok: false,
      message: "Unable to open a terminal for this project.",
    };
  }
  return {
    ok: false,
    message: "Unable to open this project folder.",
  };
}

export async function openProjectAction(
  action: ProjectOpenAction,
  path: string,
): Promise<ProjectActionResult> {
  try {
    await invoke("open_project_action", { action, path });
    return { ok: true };
  } catch {
    return safeActionError(action);
  }
}

export function openProjectInCode(path: string): Promise<ProjectActionResult> {
  return openProjectAction("code", path);
}

export function openProjectFolder(path: string): Promise<ProjectActionResult> {
  return openProjectAction("folder", path);
}

export function openProjectTerminal(path: string): Promise<ProjectActionResult> {
  return openProjectAction("terminal", path);
}
