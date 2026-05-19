# Axiom Workspace v0.2.0

Status: internal beta for Aidan and Riley.

## New in v0.2.0

- Repo nicknames: edit display names for tracked repos inline on repo cards.
- Session handoff notes: add an optional handoff note when ending a session.
- Edit session notes on active sessions without restarting.
- Activity timeline filters: All, Sessions, Sync, Repos, Errors.
- Sync completions and repo refreshes now appear in the activity timeline.
- Version bumped to 0.2.0 across all manifests.

## Carried from v0.1.0

- Hidden git process windows on Windows.
- Parallel repo status checks for faster Refresh All.
- Full Dashboard with team sync status, stat cards, and active session overview.
- Repos page with add, remove, refresh, open folder, copy path.
- Sessions page with duration tracking and overlap warnings.
- Locks page grouped by repo.
- Activity page with summary cards and event timeline.
- Settings page with diagnostics, setup checklist, and reset controls.
- Onboarding flow with Git, GitHub, and sync validation.
- Sidebar with dynamic sync status and active session count.
- Confirmation dialogs on all destructive actions.

## Safety Guarantees

- Project repos are read-only: Axiom never runs git write commands on your projects.
- Only the validated sync repo (axiom-workspace-sync) receives git writes.
- No paid APIs, cloud databases, or external services.
- All data stored locally in localStorage and AppData.
- Manual Sync Now only (no background auto-sync).

## Known Limitations

- Soft locks are advisory coordination signals only.
- Git and GitHub access must already work on the tester machine.
- If Git is installed after the app starts, the app may need to be restarted before Git is detected.
- Sync may ask the tester to run Sync Now again if remote updates arrive during the same sync operation.
- Resetting local app data does not uninstall the app and does not remove project repositories.

## Installer Filenames

```text
Axiom Workspace_0.2.0_x64-setup.exe
Axiom Workspace_0.2.0_x64_en-US.msi
```

Expected local output paths:

```text
src-tauri/target/release/bundle/nsis/Axiom Workspace_0.2.0_x64-setup.exe
src-tauri/target/release/bundle/msi/Axiom Workspace_0.2.0_x64_en-US.msi
```

## GitHub Release Prep

- Build installer with `npm run tauri build`.
- Attach NSIS `.exe` and MSI.
- Tag `v0.2.0-beta`.
- Mark as pre-release/internal beta.
