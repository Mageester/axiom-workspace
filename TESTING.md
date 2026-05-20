# Axiom Workspace Riley Test Script

Use this script for the first controlled Riley test pass. Please report anything confusing, broken, or surprising, even if the app technically works.

## Installer Test

1. Install Axiom Workspace using `Axiom Workspace_0.7.0_x64-setup.exe`.
2. Open Axiom Workspace from the Start menu or desktop shortcut.
3. Confirm the app opens without a crash.
4. Confirm the first screen asks for setup instead of showing an error.

## First-Run Setup Test

1. Enter your display name as `Riley`.
2. Enter a recognizable device name.
3. Review the setup checks shown by the app.
4. Confirm the app explains what Git is needed for.

## Git Missing Test

Only do this if practical on a test machine or fresh Windows profile.

1. Open the app before Git for Windows is installed.
2. Confirm the app says Git is needed for free team sync.
3. Click `Install Git`.
4. Install Git for Windows.
5. Return to Axiom Workspace and click `Re-check Git`.
6. If Git is still not detected, restart Axiom Workspace and try again.

## Connect to Axiom Team Workspace

1. Click `Connect to Axiom Team Workspace`.
2. Confirm the connection completes.
3. If GitHub asks for sign-in, complete sign-in through Git or Git Credential Manager.
4. Confirm the app reaches the dashboard.

## Add Repo

1. On the dashboard, click `Add Repo`.
2. Choose or paste the path to a local Git repo you can safely test with.
3. Confirm the repo appears on the dashboard.
4. Confirm the repo card shows a status such as clean, dirty, behind, locked, or error.

## Start Session

1. Start a work session from the dashboard.
2. Pick the test repo.
3. Add a short session title.
4. Add at least one file or folder lock target.
5. Add a note if useful.
6. Create the session.
7. Confirm the session appears in Sessions and Locks.

## Sync Now

1. Click `Sync Now`.
2. Wait for the sync result message.
3. Confirm the app reports that shared sessions and locks are up to date.
4. If the app says remote updates arrived during sync, click `Sync Now` again.

## Confirm Aidan Sees Riley Session

1. Tell Aidan you have synced.
2. Ask Aidan to click `Sync Now`.
3. Confirm Aidan can see your Riley session and lock targets.

## Confirm Riley Sees Aidan Session

1. Ask Aidan to start or update a test session.
2. Ask Aidan to click `Sync Now`.
3. Click `Sync Now` on Riley's machine.
4. Confirm Riley can see Aidan's session and lock targets.

## Dirty Repo Explanation Test

1. In the test repo, make a harmless local change.
2. Return to Axiom Workspace.
3. Refresh repo status if needed.
4. Confirm the repo is marked dirty.
5. Open the dirty details on the repo card.
6. Confirm the app explains which files changed.
7. Do not commit test changes unless Aidan asks you to.

## Reset App Data Test

1. Open `Settings`.
2. Open `Advanced Sync Settings`.
3. Use `Reset`.
4. Choose `Full reset local app data`.
5. Confirm the app reloads and returns to first-run setup.
6. Confirm your project repos were not deleted.

## Known Issues to Report

Please report:

- Any installer warning, crash, or blocked install.
- Any setup wording that is unclear.
- Any point where Git or GitHub sign-in is confusing.
- Any Sync Now error or repeated conflict message.
- Sessions or locks that appear on one machine but not the other.
- Dirty repo explanations that do not match the actual repo.
- Buttons that are hard to find or require too many clicks.
- Anything that makes you unsure whether source code or credentials are being synced.
