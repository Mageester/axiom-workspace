# Axiom Workspace

Axiom Workspace is an internal Windows desktop app for coordinating work across Aidan and Riley. It tracks local repositories, work sessions, soft locks, notes, and shared coordination events without syncing source code.

## Team Sync

Axiom Workspace uses Git and GitHub for zero-cost team sync:

- Default sync repo: `https://github.com/Mageester/axiom-workspace-sync`
- Default local sync folder: the app data folder, for example `AppData/Local/Axiom Workspace/sync`
- Synced data: sessions, locks, notes, activity events, and identity/device metadata
- Not synced: source code files, project repo contents, GitHub passwords, or tokens

On first run, the app checks setup health, asks for a user display name and device name, verifies Git, verifies access to the sync repo, and connects the local app-data sync folder automatically.

## Riley Setup

1. Install and open Axiom Workspace.
2. Enter your name and device name.
3. Click **Connect to Axiom Team Workspace**.
4. If Git is missing, click **Install Git**, install Git for Windows, then click **Re-check Git**.
5. Once connected, use **Sync Now** to share sessions and locks.

## Development

```bash
npm install
npm run tauri dev
```

## Checks

```bash
npm run build
cd src-tauri
cargo check
```

## Build

```bash
npm run tauri build
```

## Architecture

```text
src/                    React frontend
  components/           Reusable UI components
  pages/                Dashboard, onboarding, sessions, locks, settings
  lib/                  Local storage, sessions, repo helpers, sync helpers
  types/                Shared TypeScript types
src-tauri/              Rust backend
  src/commands/         Tauri commands for repo status and safe sync operations
  tauri.conf.json       Windows app and bundle configuration
```
