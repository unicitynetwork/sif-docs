---
title: Postgres and Redis
description: Persistence and ephemeral state — what the gateway needs.
---

Unicity-AOS9 depends on two stateful services. Both are operationally undemanding; the schema and access patterns are designed to fit standard managed offerings.

## Postgres

### Purpose

- Audit log (every guard call → one row)
- Policies, rules, and API keys
- Hourly aggregate roll-ups (background-rebuilt)

### Sizing

| Traffic | Storage / month | Connections | Suggested instance |
|---|---|---|---|
| Up to 1 M guard calls / day | ~1 GiB | 20 | `db.t3.medium` or similar |
| 10 M guard calls / day | ~10 GiB | 50 | `db.m6g.large` |
| 100 M guard calls / day | ~100 GiB | 100 | `db.m6g.xlarge` + read replica |

Full-body auditing inflates storage 10–30×. Plan accordingly.

### Version

PostgreSQL 14+ is required. PostgreSQL 16 is recommended. The schema uses `JSONB`, `BTREE` indexes on timestamp columns, and partial indexes on `action`. Nothing exotic.

### Managed services

| Provider | Service | Notes |
|---|---|---|
| AWS | RDS for PostgreSQL | Use `gp3` storage; enable enhanced monitoring |
| GCP | Cloud SQL for PostgreSQL | Set `cloudsql.iam_authentication = on` for IAM auth (optional) |
| Azure | Azure Database for PostgreSQL — Flexible Server | |
| Self-hosted | Plain Postgres in Docker / on a VM | Fine for low-traffic deployments |

### Configuration

```env
DATABASE_URL=postgres://user:pass@host:5432/unicity?sslmode=require
DATABASE_MAX_CONNECTIONS=20
DATABASE_STATEMENT_TIMEOUT_MS=5000
```

The connection pool is per gateway replica. Total connections in use = `replicas × DATABASE_MAX_CONNECTIONS` plus the migration runner. Size the Postgres `max_connections` accordingly.

### Migrations

Run on startup. Idempotent. Tracked in `unicity_migrations`. To run by hand:

```bash
unicity-migrate --database-url "$DATABASE_URL"
```

## Redis

### Purpose

- Per-key rate-limit counters (sliding window)
- Ephemeral session state for the dashboard
- Pub/sub channel for fanning out events between gateway replicas

### Sizing

Negligible — under 100 MiB even at high traffic. Any tier of any managed Redis offering is fine.

### Version

Redis 6+ is required. Redis 7+ is recommended. Both Redis and Valkey are tested.

### Managed services

| Provider | Service |
|---|---|
| AWS | ElastiCache for Redis |
| GCP | Memorystore for Redis |
| Azure | Azure Cache for Redis |

### Configuration

```env
REDIS_URL=redis://host:6379
REDIS_POOL_SIZE=10
```

### Persistence

Redis state is **ephemeral**. The gateway can be restarted with an empty Redis without any data loss — rate-limit counters re-warm within a minute, and dashboard sessions re-authenticate. Use Redis without persistence (AOF/RDB off) to reduce cost and maintenance.

## Network topology

The gateway initiates connections to both. Neither needs to be exposed beyond the gateway's VPC / security group. Open:

- `gateway → postgres:5432`
- `gateway → redis:6379`

No inbound exposure on either service is required.

## Backup posture

| | Postgres | Redis |
|---|---|---|
| Backup | Required (audit log is the compliance evidence) | Not required |
| RPO | 24 h with daily snapshots; lower with PITR | n/a |
| Restore | Standard provider mechanism | Just restart |

See [Operations → Backups and restore](../operations/backups-and-restore.md) for the recipes.

## Related

- [Docker Compose](docker-compose.md) — both services running in dev.
- [Operations → Auth and secrets](../operations/auth-and-secrets.md) — managing the credentials.
- [Reference → environment variables](../reference/environment-variables.md) — the exhaustive variable list.
