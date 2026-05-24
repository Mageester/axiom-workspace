import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("project actions", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("opens an installed project in VS Code through Tauri", async () => {
    const { openProjectInCode } = await import("./project-actions");
    invokeMock.mockResolvedValue({ ok: true });

    const result = await openProjectInCode("C:\\Work\\Axiom Workspace");

    expect(result.ok).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith("open_project_action", {
      path: "C:\\Work\\Axiom Workspace",
      action: "code",
    });
  });

  it("returns the user-safe VS Code error when the code command is unavailable", async () => {
    const { openProjectInCode } = await import("./project-actions");
    invokeMock.mockRejectedValue(new Error("code is not installed or not found on PATH"));

    const result = await openProjectInCode("C:\\Work\\Axiom Workspace");

    expect(result).toEqual({
      ok: false,
      message: "Unable to open VS Code.\nMake sure the code command is installed and available on this device.",
    });
  });
});
