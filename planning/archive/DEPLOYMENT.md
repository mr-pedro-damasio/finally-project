# FinAlly — Cloud Deployment Notes

This document covers optional cloud deployment for the FinAlly container. It is not required for local development or the core build.

## Container Compatibility

The single-container image produced by the Dockerfile is compatible with any platform that runs Docker containers:

- **AWS App Runner** — pull from ECR, set env vars, expose port 8000. SQLite must use an EFS volume mount for persistence (App Runner does not support named volumes natively).
- **Render** — Docker deploy from registry or GitHub; persistent disk for the `/app/db` path.
- **Fly.io** — `fly launch` with a volume for `/app/db`.
- Any VPS with Docker installed.

## SQLite and Persistence

SQLite works well for single-instance deployments. For cloud deployments, the `/app/db` directory must be backed by a persistent volume — an ephemeral container filesystem loses the database on every restart.

Multi-replica deployments are not supported (SQLite does not support concurrent writers from separate processes). If multi-user or high-availability is needed in the future, migrate to PostgreSQL.

## Environment Variables

Set these in the cloud platform's secret/env config (do not bake them into the image):

```
OPENROUTER_API_KEY=...
MASSIVE_API_KEY=...   # optional
LLM_MOCK=false
```

## Terraform (Stretch Goal)

A Terraform configuration for AWS App Runner may be added to `deploy/` as a stretch goal. It is not part of the core build and has no assigned owner or timeline.
