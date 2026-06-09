---
title: Backups and restore
description: Protecting and recovering the audit log.
---

Of all the gateway's state, the audit log is the most important to preserve — it's the compliance evidence and the historical record. This page covers how to back it up and how to restore it.

## What needs backing up

| Source | Priority | Notes |
|---|---|---|
| Postgres | **Critical** | Holds the audit log, policies, rules metadata, keys |
| Custom rules directory | High | Source-of-truth for operator-authored rules |
| `config.toml` | Medium | Easy to reconstruct, but cheap to back up |
| Redis | Skip | Ephemeral — re-warms automatically |
| Gateway binary | Skip | Re-pullable from the registry |

## Backup posture

Recommended for a typical production:

- **Postgres** — automated daily snapshots, point-in-time recovery to the last 7 days, weekly verification of restore.
- **Custom rules + `config.toml`** — version-controlled in Git, deployed via CI. Git history *is* the backup.

## Postgres backups

### Managed (AWS RDS, GCP Cloud SQL, Azure)

Use the provider's snapshot + PITR features. Verify by:

1. Restoring a recent snapshot to a temporary instance.
2. Pointing a non-production gateway at it.
3. Hitting `/readyz` (must return 200) and `GET /manage/audit/stats/hourly` (rows expected).

Schedule this verification quarterly.

### Self-hosted

For Postgres in Docker / on a VM, use `pg_basebackup` + WAL archiving:

```bash
# Daily full backup
pg_basebackup -h postgres -U postgres -D /backups/$(date +%F) -Fp -P -X stream

# Plus continuous WAL archiving via postgresql.conf:
#   wal_level = replica
#   archive_mode = on
#   archive_command = 'aws s3 cp %p s3://backups/wal/%f'
```

Or `pg_dump` for logical backups (slower, but portable):

```bash
pg_dump -h postgres -U postgres -F c -f /backups/$(date +%F).dump unicity
```

## Restore — recovery recipe

In an actual recovery scenario:

```bash
# 1. Stop the gateway so it doesn't write to the partial DB
docker compose stop gateway

# 2. Restore Postgres from the most recent good backup
pg_restore -h postgres -U postgres -d unicity --clean /backups/2026-06-07.dump

# 3. Run migrations (in case the backup predates a schema change)
unicity-migrate --database-url "$DATABASE_URL"

# 4. Start the gateway and verify
docker compose start gateway
curl -f http://localhost:8080/readyz
curl -f -H "Authorization: Bearer $TEST_KEY" \
     http://localhost:8080/manage/audit/stats/hourly
```

The Redis state will re-warm on its own — no action needed.

## Recovery objectives

The default deployment supports:

| Objective | Default | Notes |
|---|---|---|
| **RTO** (recovery time) | ~30 minutes | Limited by Postgres restore time |
| **RPO** (recoverable point) | 24 hours | With daily snapshots only |
| **RPO** with PITR | < 5 minutes | If WAL archiving is enabled |

Tightening these requires more frequent snapshots and/or streaming replication. See your Postgres provider's documentation.

## What you cannot back up

- **API key secrets**, by design. The hashes are in Postgres and survive any backup, but the raw secrets cannot be reconstructed. After a restore, calling applications continue to work — the keys they hold still verify against the restored hashes.
- **In-memory metrics** — the `/api/status` counters reset on restart. Use `/manage/audit/stats/hourly` for the historical view.

## Related

- [Postgres and Redis](../deployment/postgres-and-redis.md) — sizing and managed-service notes.
- [Upgrades and migrations](upgrades-and-migrations.md) — backup posture before upgrades.
- [Concepts → Threats and verdicts](../concepts/threats-and-verdicts.md) — what the audit log contains.
