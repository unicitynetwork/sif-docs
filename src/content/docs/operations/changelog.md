---
title: Changelog
description: Release notes and version history.
---

Each release entry documents what changed, with attention to anything an operator needs to do. Releases follow [Semantic Versioning](https://semver.org/) post-1.0.

> Pre-1.0 releases may include backwards-incompatible changes. They are called out at the top of the entry.

## Unreleased

Items in flight that have not yet shipped.

- **Helm chart** for Kubernetes deployment ([Deployment → Kubernetes](../deployment/kubernetes.md)).
- **Role-based dashboard auth** so operators can have read-only vs. admin access.
- **Per-class virtual keys** — a finer-grained alternative to the current shared-key model.

## v0.4.x — current

> **Schema migrations:** automatic on startup, additive only.

Release-by-release notes for the current series live here. Each entry should describe:

- **Added** — new capability.
- **Changed** — behaviour change for existing functionality. Read carefully.
- **Fixed** — bug fixes. Usually no operator action required.
- **Deprecated** — features still present but slated for removal.
- **Removed** — features that are gone. Lists the version where they were deprecated.

Example shape:

```
### v0.4.1 — 2026-05-15

**Added**
- `policies.short_circuit_threshold` — early-exit cut during detection.
- `/manage/keys/{id}/rotate` endpoint — issues a new secret with 24 h overlap.

**Changed**
- Dashboard route `/models` renamed to `/detectors`. The management
  endpoint `/manage/models` continues to work; the new endpoint
  `/manage/detectors` returns a superset.

**Fixed**
- WebSocket reconnection no longer floods the server when the consumer
  is slow — now respects 1009-close backoff.
```

## v0.3.x and earlier

Older releases are archived in the project's Git tags and the release notes attached to each tag. The summary here lists only milestones.

## Versioning policy

Semantic versioning applies post-1.0:

- **Major** — breaking API changes. Pre-announced in the previous minor release.
- **Minor** — new features. Always backwards-compatible.
- **Patch** — bug fixes. Always backwards-compatible.

Pre-1.0, minor versions may include breaking changes — read the release notes.

## Schema versioning

Schema changes are migrations applied automatically on startup. Migration files are numbered (`0001_initial.sql`, `0002_add_detections_index.sql`, …). The schema version is independent of the gateway version — many gateway versions can share a schema version.

When a gateway version requires a newer schema, the migration runs on the first startup of that version. There is no separate version-bump step.

## Where to subscribe

- **GitHub releases** — the canonical announcement.
- **Email / RSS** — when the project provides one.
- **Dashboard banner** — when a deployed gateway detects a newer version is available (planned).

## Related

- [Upgrades and migrations](upgrades-and-migrations.md) — how to apply a release.
- [Production checklist](../deployment/production-checklist.md) — what to verify after upgrading.
