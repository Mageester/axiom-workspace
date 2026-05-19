# Axiom Workspace v0.3.0 Beta

Status: internal beta for Aidan and Riley.

## New in v0.3.0

- Automatic repo discovery across common Desktop, Documents, OneDrive, and Repos folders.
- Known Axiom repo profiles with friendly names and descriptions.
- Discover Repos flow with add selected, add all recommended, and ignore controls.
- Safer auto-refresh on startup, app focus, and a quiet two-minute minimum interval.
- Debounced auto-sync after session starts, endings, note edits, and handoff notes.
- One-click Start Work flow with repo, branch, user, and target suggestions.
- Lightweight dashboard suggestions for dirty repos, stale sync, generated screenshots, teammate locks, and unsynced sessions.
- First-run flow opens repo discovery after sync setup completes.
- Settings for auto-refresh, auto-sync, discovery paths, refresh interval, suggestion reset, and advanced sync.

## Safety Guarantees

- Project repos remain read-only: Axiom only runs Git status and metadata commands there.
- Only the validated sync repo receives Git write commands.
- Source code, project files, credentials, passwords, and tokens are not synced.
- No paid APIs, hosted databases, analytics, Supabase, Firebase, or SaaS were added.
- Auto-refresh prevents overlapping refreshes and uses a two-minute minimum timer.
- Auto-sync is debounced, prevents overlap, and keeps Manual Sync Now available.
- Repo discovery scans only known local folders to depth three and skips heavy folders.

## Installer Filenames

```text
Axiom Workspace_0.3.0_x64-setup.exe
Axiom Workspace_0.3.0_x64_en-US.msi
```

Expected local output paths:

```text
src-tauri/target/release/bundle/nsis/Axiom Workspace_0.3.0_x64-setup.exe
src-tauri/target/release/bundle/msi/Axiom Workspace_0.3.0_x64_en-US.msi
```

## Manual Beta Checklist

- Fresh setup.
- Repo discovery.
- Add recommended repos.
- Auto-refresh on startup and focus.
- Dirty repo suggestion.
- One-click Start Work.
- Auto-sync after session start and session end.
- Manual Sync Now.
- No terminal windows.
- Responsive dashboard and repo pages.
