# Workspace Improvement Log

Date: 2026-05-24

## Changes Made

- Sharpened private workspace language across onboarding, Home, Projects, Activity, and Settings.
- Added Home summary cards for ready projects, review items, and private coordination scope.
- Improved Home project launcher responsiveness so rows collapse cleanly on narrow viewports.
- Added Projects summary counts for safe, review, active, and missing installs.
- Improved Projects empty state to clarify that Workspace tracks coordination state, not source code.
- Tightened shared page header spacing and responsive behavior.
- Updated sidebar brand from generic "Axiom" to "Axiom Workspace" with a private marker.
- Replaced raw browser-only Tauri invoke errors with a clear native desktop service message.
- Guarded Tauri tray and widget APIs so browser preview stays error-free.
- Updated private web companion release version copy and removed decorative orb backgrounds.
- Aligned root app, package, backend, Cargo, and Tauri versions to `1.5.2`.
- Removed stale web companion references to `v1.0.0` and `v1.6.0`.

## Files Touched

- `src/components/PageHeader.tsx`
- `src/components/Sidebar.tsx`
- `src/App.tsx`
- `src/lib/tray.ts`
- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `backend/package.json`
- `backend/package-lock.json`
- `src/pages/ActivityPage.tsx`
- `src/pages/OnboardingPage.tsx`
- `src/pages/ProjectsPage.tsx`
- `src/pages/SettingsPage.tsx`
- `src/pages/TodayPage.tsx`
- `web/src/App.tsx`
- `web/src/index.css`
- `package.json`
- `package-lock.json`
- `RELEASE_NOTES.md`
- `WORKSPACE_IMPROVEMENT_LOG.md`

## Validation Results

- `npm run build` passed.
- `npm run test` passed: 7 test files, 58 tests.
- `cd web && npm run build` passed.
- No `lint` or separate `typecheck` script exists in root `package.json`.
- No `lint` or separate `typecheck` script exists in `web/package.json`.
- Backend package has no build, test, lint, or typecheck script.
- `git diff --check` passed.

## Browser Smoke Check

- Root app opened at `http://127.0.0.1:5173/`.
- Onboarding rendered private Axiom Workspace copy.
- Re-check interaction returned the clear browser-preview native service message.
- Root app console had no errors or warnings during smoke.
- Root onboarding mobile viewport had no horizontal overflow at 390 px.
- Playwright fallback seeded setup-complete local state after Browser blocked direct storage seeding.
- Home, Projects, Activity, and Settings rendered expected labels and empty states.
- Home, Projects, Activity, and Settings had no console or page errors after Tauri guards.
- Home, Projects, Activity, and Settings had no horizontal overflow at desktop width.
- Settings mobile viewport had no horizontal overflow at 390 px.
- Private web companion opened at `http://127.0.0.1:5174/`.
- Web companion showed `v1.5.2`, Cloudflare Access warning, and no-custom-auth copy.
- Web companion console had no errors or warnings during smoke.
- Web companion mobile viewport had no horizontal overflow at 390 px.

## Remaining Issues

- Root app still needs Tauri-shell QA for setup, tray, and native opener commands.
- Private web companion must remain behind Cloudflare Access before deployment.
- Browser plugin blocked direct storage seeding; Playwright fallback covered setup-gated routes without adding dependencies.
