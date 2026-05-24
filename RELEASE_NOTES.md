# Axiom Workspace v1.4.0 — Command Layer

Overview:
Axiom Workspace v1.4.0 moves the app from a repo/session dashboard into a daily internal command layer for Aidan and Riley.

Highlights:
- Cloudflare Worker + D1 backend foundation for operational state
- Local-first Project Registry with Cloudflare adapter boundaries
- Clone Latest flow for registered projects missing on a device
- Needs Attention system for sync, repo, teammate, stale session, and missing project signals
- Safe to Start / Review First project states
- Cleaner project quick actions with technical details hidden by default
- Ctrl+K command palette for common workspace actions
- Finish Work handoff notes saved locally and mirrored through the adapter when configured
- Improved Activity copy with readable handoff events
- Settings/Setup center with Profile, Cloud Sync, Automation, Diagnostics, and Advanced sections
- Stronger daily workflow while preserving tray icon, widget, and notifications

Backend notes:
- Worker endpoints use `{ ok, data }` / `{ ok, error }` envelopes.
- Device auth stores only SHA-256 token hashes in D1.
- Source code, GitHub tokens, and device tokens are not uploaded or committed.
- Cloudflare remains optional; the app opens in local/cache mode when the backend is unavailable.

Validation:
- Pending final verification for production build, tests, Rust check, and backend typecheck.

# Axiom Workspace v1.3.1 — Interface Precision & Daily Polish

Overview:
Axiom Workspace v1.3.1 refines the Lean Daily Workspace release with tighter composition, cleaner navigation, compact project cards, grouped activity, polished settings, and a darker native desktop frame.

This release focuses on making Workspace feel faster, calmer, and more useful for daily internal coordination between Aidan and Riley.

Highlights:
- Centered Today daily panel
- Normalized teammate display and duplicate session grouping
- Narrower, lighter sidebar
- Compact Projects layout
- Filesystem paths hidden by default
- Expandable project diagnostics
- Grouped chronological Activity timeline
- Reduced automated sync noise
- Polished Settings screen with custom toggles
- Advanced options moved behind disclosure
- Dark native Windows title bar
- Version updated to 1.3.1

Validation:
- Production frontend build passed
- TypeScript compilation passed
- 51 Vitest tests passed
- Existing tray/widget foundation preserved

v1.3.1 Daily Use QA Checklist:
- Open app and instantly understand current state
- Start Work is obvious
- Finish Work is obvious
- Riley status feels trustworthy
- Projects page is useful without being noisy
- Activity page is helpful and not spammy
- Tray widget still feels useful
- Nothing feels annoying after repeated use


# Axiom Workspace v1.3.0 — Lean Daily Workspace

Status: Product-level UX simplification and performance polish.

## New in v1.3.0

- **Today-first Layout**: A simplified daily status screen is now the default landing page. It focuses on the most critical operational questions: Are you working? Who else is active? Is the workspace healthy?
- **Simplified Navigation**: Consolidated navigation into four clear areas: Today, Projects, Activity, and Settings. Removed redundant screens like Board, Sessions, and Locks to reduce cognitive load.
- **Cleaner Projects View**: Refactored the repository overview into a streamlined Projects page. Project cards now use human-readable status language and hide technical Git noise by default.
- **Human-Readable Activity**: The activity feed now provides a quiet, readable timeline of meaningful events (e.g., "Riley started work") instead of raw technical logs.
- **Refined Settings**: Moved advanced configuration, diagnostics, and local reset controls into a secondary 'Advanced' area to keep the main settings interface focused on identity and automation.
- **Premium Dark Aesthetic**: Updated the visual design with a focus on hierarchy, whitespace, and refined typography. The UI now feels more like a high-end internal operations tool.
- **Performance Polish**: Reduced unnecessary re-renders and optimized the Today screen to be the fastest and lightest area of the app.
- **Preserved Foundation**: Maintained all v1.2.0 improvements to Tauri reliability, tray icon loading, widget positioning, and expanded permissions.

# Axiom Workspace v1.2.0

Status: Improved tray/widget foundation and Tauri reliability.

## New in v1.2.0

- **Tray Widget**: Added tray widget to Windows configuration for quick status access.
- **Expanded Permissions**: Updated Tauri permissions for window, event, tray, menu, and webview APIs.
- **Improved Icon Loading**: Tray icon loading now uses bundled runtime assets for better reliability.
- **Widget Positioning**: Improved widget positioning using primary monitor dimensions.
- **Resizable Widget**: The widget window is now resizable for better flexibility.
- **Version Alignment**: Version bumped to 1.2.0 across all configuration files.



Status: private internal release for Aidan and Riley.

## New in v1.0.0

- Premium desktop shell with a simplified Home / Work / Repos / Activity / Settings navigation model.
- Home command center focused on active work, team claims, sync health, repo attention, and safe next actions.
- Cleaner Start Work flow for claiming a repo area before work begins.
- Simpler Finish Work flow with optional change summary and handoff note.
- Polished Work, Repos, Activity, and Settings pages using the 1.0 visual system.
- Clearer no-upstream handling: missing remote branches are shown as setup/review state, not fatal app errors.
- Standalone private web companion scaffold in `web/` for `workspace.getaxiom.ca`.
- Web portal docs require Cloudflare Access before deployment.

## Private Web Companion

`workspace.getaxiom.ca` is a static/private companion portal for:

- desktop app downloads
- Riley setup instructions
- release notes
- privacy/safety explanation
- future deep-link documentation

It is not a hosted backend. It does not read the private sync repo, expose workspace state, store secrets, or replace the desktop app.

Recommended deployment status: block public deployment until Cloudflare Access allows only Aidan and Riley.

## Safety Guarantees

- Project repos remain read-only: Axiom only runs Git status and metadata commands there.
- Only the validated sync repo receives Git write commands for coordination state.
- Source code, project files, credentials, passwords, and tokens are not synced.
- No paid APIs, hosted databases, SQL migrations, Prisma, Supabase, Firebase, or SaaS backend were added.
- Web portal is static and must be protected before deployment.
- Auto-refresh prevents overlapping refreshes and uses a minimum timer.
- Auto-sync is debounced, prevents overlap, and keeps Manual Sync Now available.

## Installer Filenames

```text
Axiom Workspace_1.0.0_x64-setup.exe
Axiom Workspace_1.0.0_x64_en-US.msi
```

Expected local output paths after `npm run tauri build`:

```text
src-tauri/target/release/bundle/nsis/Axiom Workspace_1.0.0_x64-setup.exe
src-tauri/target/release/bundle/msi/Axiom Workspace_1.0.0_x64_en-US.msi
```

## Manual Release Checklist

- Fresh setup.
- Git installed / GitHub access validated.
- Connect to Axiom Team Workspace sync repo.
- Repo discovery.
- Add recommended repos.
- Auto-refresh on startup and focus.
- Dirty repo suggestion.
- No-upstream branch shown as review/setup state, not fatal error.
- Start Work claim.
- Finish Work handoff.
- Auto-sync after session start and session end.
- Manual Sync Now.
- No terminal windows.
- Responsive Home, Work, Repos, Activity, and Settings pages.
- Web portal build passes.
- Do not deploy `workspace.getaxiom.ca` without access protection.
