---
title: Upgrades and migrations
description: Safely moving from one gateway version to the next.
---

Unicity-AOS9 follows additive schema migrations: a new release never removes or renames an existing column without a multi-release deprecation window. This means upgrades are forwards-compatible and rolling deploys are safe.

## The upgrade path

For a single-replica deployment:

```bash
# 1. Pull the new image
docker compose pull gateway

# 2. Restart — migrations run on startup
docker compose up -d gateway

# 3. Verify
curl -f http://localhost:8080/version    # confirm the new version is serving
curl -f http://localhost:8080/readyz     # confirm everything came up
```

For multi-replica deployments behind a load balancer:

1. Drain one replica (LB stops sending it traffic; in-flight requests complete).
2. Pull and start the new version on that replica.
3. Wait for `/readyz` to return 200.
4. Re-add to the LB pool.
5. Repeat for each replica.

Mixed-version states (new replicas + old replicas serving simultaneously) are explicitly supported during the rollout window.

## Migrations

Run automatically on startup. Tracked in `unicity_migrations`. Idempotent: re-running has no effect once applied.

To run by hand (useful on a maintenance window before the rolling deploy):

```bash
unicity-migrate --database-url "$DATABASE_URL"
```

The migrator prints which migrations it applied, or `no pending migrations` if up to date.

## Pre-upgrade checks

Before any upgrade:

- [ ] **Read the release notes** in [Changelog](changelog.md). Look for any explicit breaking change or required action.
- [ ] **Snapshot Postgres.** Even with safe migrations, having a recoverable snapshot is cheap insurance.
- [ ] **Confirm `/readyz` returns 200** on all current replicas before starting the rollout.

## Backwards-compatibility window

Migrations are written to be safe across **two adjacent versions** — `v0.4 → v0.5` is always direct. Skipping versions (`v0.3 → v0.5`) is also supported but less tested; if possible, upgrade through intermediate versions.

After v1.0, the project commits to a longer compatibility window (3 versions). This page will be updated when that takes effect.

## Rolling back

The gateway supports running an older binary against a newer schema — additive migrations guarantee this. So rollback is simply:

```bash
# 1. Re-deploy the previous image
docker compose pull gateway:0.4.0
docker compose up -d gateway

# 2. Schema stays where it is — no migration rollback needed
```

The "extra" columns added by the new schema are ignored by the old code.

If a release ever requires a destructive migration, it will be explicit in the [Changelog](changelog.md) and a rollback playbook will be provided with that release.

## Custom rules and policies

Schema migrations do not touch your operator-authored rules or policies. They live in:

- **Rules** — files under the rules directory (no DB representation beyond metadata)
- **Policies** — rows in Postgres, schema additive across versions

No action is needed during an upgrade unless the release notes call out a new policy field that you want to set explicitly. New fields are always optional with sane defaults.

## When a release adds a feature flag

Occasionally a feature lands in a flagged-off state. Release notes call this out:

```
[v0.5.0] Added: `policies.short_circuit_threshold` (default: 1.0)
```

`default: 1.0` here means short-circuit is effectively off for existing policies — opt in by setting a lower value.

## Related

- [Changelog](changelog.md) — what changed in each release.
- [Production checklist](../deployment/production-checklist.md) — items to re-verify after upgrade.
- [Backups and restore](backups-and-restore.md) — what to do if an upgrade goes wrong.
