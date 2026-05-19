# Axiom Workspace 0.1.0

Status: internal beta for Riley testing. Not a public release.

## Included

- Windows desktop app built with Tauri and React.
- Repo status dashboard for local Git repositories.
- Dirty repo diagnostics with changed file summaries.
- Work sessions with notes, branches, and lock targets.
- Soft locks for files and folders.
- Overlap warnings for active session targets.
- Zero-cost GitHub sync for coordination state.
- First-run setup for user identity, device name, Git checks, and sync connection.
- Settings reset tools for setup, sessions/locks, sync state, and full local app data.
- Windows installer build output.

## Not Included Yet

- Public release packaging or marketing page.
- Paid backend, database, or hosted sync service.
- Source code sync.
- Project file sync.
- Credential or token management inside the app.
- Hard enforcement of locks in Git.
- Multi-team administration.

## Known Limitations

- Soft locks are advisory coordination signals only.
- Git and GitHub access must already work on the tester machine.
- If Git is installed after the app starts, the app may need to be restarted before Git is detected.
- Sync may ask the tester to run `Sync Now` again if remote updates arrive during the same sync operation.
- Resetting local app data does not uninstall the app and does not remove project repositories.

## Riley Testing Checklist

- Install with the NSIS setup executable.
- Complete first-run setup.
- Confirm Git missing messaging if practical.
- Connect to Axiom Team Workspace.
- Add a local test repo.
- Start a session with at least one lock target.
- Run `Sync Now`.
- Confirm Aidan sees Riley's session.
- Confirm Riley sees Aidan's session.
- Make a harmless dirty repo change and confirm the app explains it.
- Test full local app data reset.
- Report bugs and UX feedback through GitHub issues.

## Installer Filenames

```text
Axiom Workspace_0.1.0_x64-setup.exe
Axiom Workspace_0.1.0_x64_en-US.msi
```

Expected local output paths:

```text
src-tauri/target/release/bundle/nsis/Axiom Workspace_0.1.0_x64-setup.exe
src-tauri/target/release/bundle/msi/Axiom Workspace_0.1.0_x64_en-US.msi
```

## GitHub Release Prep Checklist

- Build installer with `npm run tauri build`.
- Attach NSIS `.exe`.
- Attach MSI.
- Tag `v0.1.0-beta`.
- Mark the GitHub release as pre-release/internal beta.
- Include a short note that this is for controlled Riley testing only.
- Do not upload release assets from an unsafe or unverified environment.
