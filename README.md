# Axiom Workspace

Windows desktop application for managing Git repositories, sessions, and file locks across teams. Built with Tauri v2, React, and TypeScript.

## Status

**Pre-alpha** — UI scaffold complete, no live Git integration yet.

## Development

```bash
# Install dependencies
npm install

# Start development (launches Vite + Tauri)
npm run tauri dev

# Type check
npx tsc --noEmit
```

## Build

```bash
# Production build
npm run tauri build
```

## Architecture

```
src/                    # React frontend
  components/           # Reusable UI components
  pages/                # Page-level views
  lib/                  # Utilities and constants
  types/                # TypeScript type definitions
src-tauri/              # Rust backend
  src/
    commands/           # Tauri command modules
    lib.rs              # App entry point
    main.rs             # Windows entry point
  capabilities/         # Permission scoping
  tauri.conf.json       # App configuration
```

## Tech Stack

- **Framework:** Tauri v2
- **Frontend:** React 19, TypeScript, Tailwind CSS v4
- **Backend:** Rust
- **Icons:** Lucide React
