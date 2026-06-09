---
title: Compatibility matrix
description: Supported runtimes for Postgres, Redis, OS, and architectures.
---

What's tested and supported per gateway release. Anything not listed may work but is not part of the test matrix.

## Postgres

| Version | Status |
|---|---|
| 16.x | Supported (recommended) |
| 15.x | Supported |
| 14.x | Supported |
| 13.x | Best-effort — not in CI |
| ≤ 12.x | Not supported (schema uses features unavailable on 12) |

Cloud variants (AWS RDS, GCP Cloud SQL, Azure Database for PostgreSQL) are supported on any of the above. The gateway does not use vendor-specific extensions.

## Redis

| Version | Status |
|---|---|
| Redis 7.x | Supported (recommended) |
| Redis 6.x | Supported |
| Redis 5.x | Not supported |
| Valkey 7.x | Supported (Redis-compatible) |
| ElastiCache, Memorystore, Azure Cache | Supported |

Cluster mode is **not** required and **not** specifically tested. Single-node Redis is the supported topology.

## Operating system (for the gateway)

| OS | Status |
|---|---|
| Linux x86_64 (glibc 2.31+) | Supported (primary) |
| Linux x86_64 (musl) | Supported via the Alpine-based image |
| Linux aarch64 | Supported |
| macOS x86_64 | Build supported; ML feature requires CPU-only ONNX (slow) |
| macOS aarch64 (Apple Silicon) | Supported including ML |
| Windows | Not supported |

The Docker image is multi-arch (`amd64` + `arm64`).

## Build feature flags

| Feature | Default | What it adds |
|---|---|---|
| `dashboard` | on (in image) | Web UI binary + management endpoints |
| `yara` | on | YARA-X detector |
| `ml` | off | ONNX-backed ML detectors |
| `mock-llm` | off | Mock-upstream support for offline test environments |

Verify which flags are compiled in via `GET /version`:

```json
{ "version": "0.4.1", "features": ["dashboard", "yara", "ml"] }
```

## Python SDK

| Python | Status |
|---|---|
| 3.12 | Supported (primary) |
| 3.11 | Supported |
| 3.10 | Supported |
| 3.9 | Best-effort |
| 3.8 | End of life — not supported |

## Browsers (dashboard)

| Browser | Status |
|---|---|
| Chrome (latest) | Supported |
| Edge (latest) | Supported |
| Firefox (latest) | Supported |
| Safari (latest) | Supported |
| Internet Explorer | Not supported |

Older browser versions are not tested. The dashboard uses modern CSS and ES2020+ JavaScript.

## Versions of this matrix

This matrix reflects the **current release**. Older versions had different support windows; check the release notes in [Operations → Changelog](../operations/changelog.md) for historical specifics.

## Related

- [Installation](../getting-started/installation.md) — what to install on the supported runtimes.
- [Deployment → Postgres and Redis](../deployment/postgres-and-redis.md) — picking the right managed offering.
- [Operations → Upgrades and migrations](../operations/upgrades-and-migrations.md) — moving across versions.
