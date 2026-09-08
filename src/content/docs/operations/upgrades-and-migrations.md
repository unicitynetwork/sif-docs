---
title: Upgrades and migrations
description: Safely moving from one gateway version to the next.
---

Semantic Firewall follows additive schema migrations: a new release never removes or renames an existing column without a multi-release deprecation window. This means upgrades are forwards-compatible and rolling deploys are safe.

## Rolling production

Production is rolled by the **Deploy** workflow
(`.github/workflows/deploy.yml`), dispatched by hand from the Actions tab or
the CLI. There is no automatic deploy on merge; the Docker workflow only
*builds* an image for every push to `main`.

```bash
gh workflow run deploy.yml \
  --ref main \
  -f ref=<full 40-character commit SHA> \
  -f image_tag=sha-<first 7 characters of that SHA>
```

The workflow syncs `docker-compose.prod.yml` and `deploy/alloy/` to
`/opt/semanticd`, pins `SEMANTICD_IMAGE` in the server's `.env`, pulls, brings
the stack up, waits for `/healthz`, and finishes by running
`deploy/e2e-smoke.sh --expected-product sif` against the live stack. A failure
in any of those fails the job.

Three things about the inputs are worth knowing before you dispatch, because
each has cost a deploy:

- **`ref` must be a full 40-character SHA**, a branch, or a tag. A *short* SHA
  fails: `actions/checkout` treats anything that is not a full SHA as a ref
  name, fetches `refs/heads/<what you typed>*`, matches nothing and exits 1.
  It fails on the first step, so nothing is synced and nothing is rolled —
  production is untouched — but the deploy does not happen.
- **`ref` and `image_tag` must name the same commit.** `ref` supplies the
  compose and alloy config, `image_tag` supplies the binary. Nothing checks
  that they agree.
- **The defaults are stale.** They are pinned to an old release, so overwrite
  both every time rather than accepting what the form offers.

Confirm the image tag exists before dispatching:

```bash
gh api "/orgs/unicitynetwork/packages/container/unicity-semanticd/versions?per_page=5" \
  --jq '.[].metadata.container.tags'
```

### Rolling by hand on the server

If the workflow is unavailable, the same roll from `/opt/semanticd`:

```bash
# The image is pinned in .env; edit SEMANTICD_IMAGE there first.
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

The compose service is `semanticd`. Leaving `SEMANTICD_IMAGE` unset falls back
to `semanticd:latest`, which is an unqualified *local* name and not a GHCR
reference — so an unpinned `docker compose up` rolls to a stale local image
rather than the one you meant.

## Verifying a roll

The Guard API and the Management API are different ports with different
health surfaces:

```bash
curl -f http://localhost:8080/healthz      # Guard API — liveness
curl -f http://localhost:8080/readyz       # Guard API — readiness, with rule counts
curl -f http://localhost:8081/api/version  # Management API — the version now serving
```

`/api/health`, `/api/version` and `/api/status` live on the **management**
router, not the guard. There is no `/version` on 8080.

`/readyz` reports the loaded corpus (`rule_count`, `ruleset_count`), which is
the quickest way to see that a roll did not quietly come up with nothing
loaded.

## Rolling deploys

For multi-replica deployments behind a load balancer:

1. Drain one replica (LB stops sending it traffic; in-flight requests complete).
2. Pull and start the new version on that replica.
3. Wait for `/readyz` to return 200.
4. Re-add to the LB pool.
5. Repeat for each replica.

Mixed-version states (new replicas + old replicas serving simultaneously) are explicitly supported during the rollout window.

## Migrations

Run automatically on startup when `database.run_migrations` is set. Tracked in
sqlx's `_sqlx_migrations` table. Idempotent: re-running has no effect once
applied.

To run by hand (useful on a maintenance window before the rolling deploy):

```bash
semanticd migrate --database-url "$DATABASE_URL"
```

Migrations are **scoped to the product**. SIF and Codewall share a database
crate but not a migration set, so a SIF deployment applies the SIF set and
nothing else.

### Migration files are immutable once published

A migration's checksum covers its whole file, comments included. Editing an
applied migration — even to correct a stale path in a comment — makes its
checksum disagree with the row already in `_sqlx_migrations`, and the next
boot against that database fails. If a comment in a shipped migration is
wrong, correct it somewhere that is not the migration file.

### Rehearsing a large jump

`scripts/db/dry-run-upgrade.sh` restores the nightly dump into a throwaway
Postgres and runs the new image's migrations against it. CI only proves
migrations apply to an *empty* database; this proves they apply to
production's rows, which is a different question whenever a migration drops a
column or builds a unique index.

It is worth the time when a roll carries migrations that have never met real
data. It is not needed when a roll carries none — compare the migration
directory between the deployed commit and the target:

```bash
git diff --stat <deployed-sha> <target-sha> -- crates/semd-db/src/migrations/
```

Empty output means no schema change, and the roll is a binary swap.

## Pre-upgrade checks

Before any upgrade:

- [ ] **Read the release notes** in [Changelog](changelog.md). Look for any explicit breaking change or required action.
- [ ] **Check whether the roll carries migrations** (the `git diff` above). If it does, and the jump is large, rehearse it.
- [ ] **Snapshot Postgres.** Even with safe migrations, having a recoverable snapshot is cheap insurance. The compose stack runs `postgres-backup` on a daily cron; a roll carrying migrations deserves a fresh dump rather than last night's.
- [ ] **Confirm `/readyz` returns 200** on all current replicas before starting the rollout.

## Backwards-compatibility window

Migrations are written to be safe across **two adjacent versions** — `v0.4 → v0.5` is always direct. Skipping versions (`v0.3 → v0.5`) is also supported but less tested; if possible, upgrade through intermediate versions.

After v1.0, the project commits to a longer compatibility window (3 versions). This page will be updated when that takes effect.

## Rolling back

The gateway supports running an older binary against a newer schema — additive migrations guarantee this. So a rollback is the same dispatch with the previous pair:

```bash
gh workflow run deploy.yml \
  --ref main \
  -f ref=<previous full SHA> \
  -f image_tag=sha-<previous short SHA>
```

The schema stays where it is; no migration rollback is needed, and the "extra" columns added by the new schema are ignored by the old code.

To find what production was running before, read the pinned image out of the
last successful deploy:

```bash
gh run list --workflow deploy.yml --limit 5
```

The roll step logs `==> .env pinned to ghcr.io/...:sha-<short>`, which is the
authoritative record of what is deployed.

If a release ever requires a destructive migration, it will be explicit in the [Changelog](changelog.md) and a rollback playbook will be provided with that release.

## Custom rules and policies

Schema migrations do not touch your operator-authored rules or policies. Where they live:

- **Rules** — rows in Postgres. The YAML packs under the rules directory are
  how default rules are shipped *into* the database, and they are read at boot
  to conform it; a policy then selects rules from the database. A rules
  directory configured with no database is a startup error, because rules
  compiled without one belong to no policy's selection and would screen
  nothing.
- **Policies** — rows in Postgres, schema additive across versions.

Because packs are mirrored at boot rather than on the reload tick, a pattern
fix edited in a YAML file needs a restart to reach the database.

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
