# Axiom Workspace Private Portal

Private companion portal for Axiom Workspace at `workspace.getaxiom.ca`.

This is not the desktop app backend and does not replace the Tauri app. It is a static/private web companion for:

- desktop app downloads
- Riley setup instructions
- release notes links
- safety/privacy explanation
- future desktop app deep-link documentation

## Architecture

- Standalone Vite + React + TypeScript app under `web/`
- Static build output in `web/dist/`
- No Next.js routes
- No server API
- No Prisma
- No SQL migrations
- No hosted database
- No source-code sync
- No live private sync repo reads

## Privacy

Deploy only behind access protection. Recommended: Cloudflare Access with an allowlist for Aidan and Riley.

The app includes `noindex,nofollow`, but that is not authentication. Do not use it as privacy control.

## Commands

```bash
cd web
npm run build
npm run preview
```

The root desktop build is separate and remains:

```bash
npm run build
npm run tauri build
```
