# Axiom Workspace Cloudflare Backend

This Worker is the v1.4.1 operational-state backend foundation. It stores workspace state only: users, devices, projects, sessions, locks, activity events, handoff notes, repo status snapshots, sync metadata, and settings.

It must not store source code, GitHub tokens, local filesystem contents, or real device tokens.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a D1 database:

```bash
npx wrangler d1 create axiom-workspace
```

3. Copy the returned database id into `wrangler.toml` locally. Do not commit real account ids, API tokens, or device tokens.

4. Apply the schema:

```bash
npm run db:migrate
```

For local development:

```bash
npm run db:migrate:local
npm run dev
```

5. Seed the first user before registering a device. Example:

```sql
INSERT INTO users (id, display_name, email, role)
VALUES ('aidan', 'Aidan', NULL, 'owner');
```

6. Generate a raw device token locally, then register the device:

```bash
curl -X POST https://<worker-host>/devices/register \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"aidan\",\"device_name\":\"Aidan Desktop\",\"token\":\"<raw-device-token>\"}"
```

The Worker stores only a SHA-256 hash of the token. The raw token should be saved only on the desktop device.

## Required Configuration

`wrangler.toml`:

- `AXIOM_DB`: D1 binding
- `API_VERSION`: `1.4.1`
- `ENVIRONMENT`: `production` or `development`

Local CLI environment:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Desktop app settings:

- Worker endpoint URL
- Raw device token for this desktop device

## Endpoints

- `GET /health`
- `GET /workspace/state`
- `GET /projects`
- `POST /projects`
- `PATCH /projects/:id`
- `POST /projects/:id/snapshot`
- `POST /sessions/start`
- `POST /sessions/:id/finish`
- `GET /activity`
- `GET /handoffs`
- `POST /handoffs`
- `POST /devices/register`
- `POST /sync/push`
- `GET /sync/pull`

All routes except `/health` and `/devices/register` require:

```text
Authorization: Bearer <raw-device-token>
```

## D1 Schema Notes

`schema.sql` creates tables for users, devices, projects, sessions, locks, activity events, handoff notes, repo snapshots, and settings. Indexes are included for common project, session, device, activity, handoff, and snapshot lookups.

`devices.token_hash` stores the SHA-256 hash of the raw token. Revoke devices by setting `revoked_at`.

## Security Notes

- Do not commit real Cloudflare ids or tokens.
- Do not commit raw device tokens.
- Do not send source code contents to the Worker.
- The desktop app must continue to launch in local mode if the Worker is not configured or is offline.
