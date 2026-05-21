# Deploying workspace.getaxiom.ca

## Status

Deployment target: `workspace.getaxiom.ca`

Recommended deployment status: blocked until Cloudflare Access is configured.

## Required privacy gate

Use Cloudflare Access in front of the static site.

Recommended policy:

- Application: `workspace.getaxiom.ca`
- Policy type: Allow
- Allowed identities: Aidan and Riley only
- Session duration: short or standard internal setting
- Login methods: configured on Axiom Cloudflare account

Do not deploy this portal publicly without access protection. The portal does not include custom authentication because Cloudflare Access is simpler and safer for this private internal page.

## Build

From the repository root:

```bash
cd web
npm run build
```

Output directory:

```text
web/dist
```

## Deployment options

Any static host is acceptable if protected by Cloudflare Access. Examples:

- Cloudflare Pages project pointed at `web/`
- Static bucket/site behind Cloudflare Access
- Existing Axiom static hosting behind Cloudflare Access

Cloudflare Pages settings:

```text
Project root: web
Build command: npm run build
Build output directory: dist
Production domain: workspace.getaxiom.ca
```

## Non-goals

Do not add any of the following to support this page:

- Next.js API routes in the desktop repo
- SQL migrations
- Prisma
- hosted database
- Supabase/Firebase
- live reads from the private Git sync repo
- source-code sync
- client-side secrets

## Future desktop connection

The page documents future protocol links only:

```text
axiom-workspace://open
axiom-workspace://sync
axiom-workspace://start-work
```

Do not enable protocol buttons until the Tauri app has reviewed and safely implemented protocol handlers.
