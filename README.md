# Axiom Workspace

Axiom Workspace is an internal Windows desktop app for coordinating active work across the Axiom team. It helps Aidan and Riley see who is working where, which files or folders are being touched, and when local repositories need attention before work overlaps.

The app is currently in internal beta for controlled Riley testing. It is ready to share for testing, but it is not a public release.

## What Problem It Solves

Small team development often breaks down because local work is invisible until a branch, commit, pull request, or merge conflict appears. Axiom Workspace gives the team a lightweight coordination layer before that point:

- Which repos are clean, dirty, behind, locked, or having Git errors.
- Which work sessions are active.
- Which files or folders are soft-locked by another teammate.
- Whether a new session overlaps an existing active lock.
- What changed locally in a dirty repo, without syncing the source code itself.

## Sync Scope

Axiom Workspace uses Git and GitHub for zero-cost team sync through the Axiom team workspace sync repo.

Synced:

- Work sessions
- Soft locks
- Notes and coordination events
- Basic identity/device metadata used by the app

Not synced:

- Source code
- Project files
- Credentials, passwords, or tokens
- Full local repo contents

The sync repo stores coordination state only. Project repositories remain normal local Git repositories.

## Main Features

- Repo status dashboard for local project health.
- Automatic repo discovery in common local Axiom folders.
- Smart repo profiles for Axiom Workspace, Axiom Site, and Axiom Pipeline Engine.
- Dirty file diagnostics that explain uncommitted local changes.
- One-click Start Work sessions with suggested lock targets.
- Soft locks for files and folders.
- Overlap warnings before starting conflicting work.
- Quiet auto-refresh and debounced auto-sync for coordination state.
- Zero-cost GitHub sync using Git instead of a paid backend.
- First-run setup for name, device, Git checks, and sync connection.
- Windows installer output from Tauri.

## Private Web Companion

A standalone private portal scaffold lives in `web/` for `workspace.getaxiom.ca`.

The portal is a static companion for desktop downloads, setup instructions, release links, safety notes, and future desktop deep-link documentation. It is not a backend for the Tauri app and does not read the private sync repo.

Privacy requirement:

- Protect `workspace.getaxiom.ca` with Cloudflare Access before deploying.
- Allow only Aidan and Riley.
- Do not deploy publicly without an access gate.
- Do not add client-side secrets, hosted databases, Next.js routes, SQL migrations, or source-code sync.

Portal build:

```bash
cd web
npm run build
```

See `web/DEPLOY.md` for deployment instructions.

## Developer Setup

Prerequisites:

- Windows 10 or Windows 11
- Node.js and npm
- Rust toolchain
- Git for Windows
- GitHub access to the app repo and the Axiom sync repo

Install dependencies:

```bash
npm install
```

Run the app in development mode:

```bash
npm run tauri dev
```

Run the frontend only:

```bash
npm run dev
```

## Build Instructions

Frontend/typecheck build:

```bash
npm run build
```

Rust/Tauri check:

```bash
cd src-tauri
cargo check
```

Windows installer build:

```bash
npm run tauri build
```

## Installer Output

Tauri writes Windows installer artifacts under:

```text
src-tauri/target/release/bundle/
```

Expected 0.3.0 installer filenames:

```text
src-tauri/target/release/bundle/nsis/Axiom Workspace_0.7.0_x64-setup.exe
src-tauri/target/release/bundle/msi/Axiom Workspace_0.7.0_x64_en-US.msi
```

## Reset Local Data

Uninstalling Axiom Workspace may leave local setup data, sync state, sessions, locks, and cached browser storage. For clean tester setup, use:

```text
Settings -> Advanced Sync Settings -> Reset -> Full reset local app data
```

Manual Windows reset, if needed:

```text
%LOCALAPPDATA%\Axiom Workspace
%APPDATA%\Axiom Workspace
```

Close the app before manually deleting those folders. Do not delete project repository folders when resetting local app data.

## Safety Notes

- Axiom Workspace reads project repo status, but does not sync project source code.
- Automatic discovery scans only standard local folders at shallow depth.
- Auto-sync writes coordination state only to the validated sync repo.
- Soft locks are coordination warnings, not enforced Git locks.
- GitHub authentication is handled by Git and Git Credential Manager.
- The app should not store GitHub passwords or tokens.
- Sync conflicts may require running Sync Now again if remote updates arrive mid-sync.
- This beta should only be shared with known internal testers.

## Project Layout

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
