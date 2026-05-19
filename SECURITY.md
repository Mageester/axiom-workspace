# Security

Axiom Workspace is an internal coordination tool for local development. It is designed to make team work visible without moving project source code into the sync layer.

## Data Boundaries

- Project repositories are read-only from Axiom Workspace except for normal Git status/sync commands used by the app.
- The sync repo stores coordination state only.
- Source code is not synced by Axiom Workspace.
- Project files are not copied into the sync repo.
- Credentials, passwords, and GitHub tokens are not stored by the app.
- GitHub authentication is handled by Git and Git Credential Manager.

## What Sync Contains

The sync repo may contain:

- Work sessions
- Soft locks
- Notes and coordination events
- Basic user/device metadata used for coordination

The sync repo should not contain:

- Source files
- Secrets
- `.env` files
- Access tokens
- Private keys
- Project build outputs

## Reporting Safety Issues

During internal beta, report safety concerns directly to Aidan. Include:

- What happened.
- What data you expected to stay local.
- Whether `Sync Now` was involved.
- Whether Git or GitHub authentication was involved.
- Screenshots or copied error text if safe to share.

Do not post credentials, tokens, private keys, or sensitive project source in an issue.
