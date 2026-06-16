---
title: Environment variables
description: Every environment variable the gateway reads, with TOML cross-references.
---

Grounded in [`crates/semanticd/src/cli.rs`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semanticd/src/cli.rs) (CLI + per-flag env), [`crates/semanticd/src/main.rs`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semanticd/src/main.rs) (admin seeding + JWT secret), and the config-override layer in `semanticd/src/config.rs`.

## Headline variables (set these)

| Variable | What it controls | Default |
|---|---|---|
| `SEMANTICD_CONFIG` | Path to `config.toml` (global, takes precedence over CWD lookup) | `./config.toml` |
| `SEMANTICD_LOG_LEVEL` | Log verbosity — `trace` / `debug` / `info` / `warn` / `error` | `info` |
| `SEMANTICD_LOG_FORMAT` | `pretty` / `compact` / `json` | `pretty` |

The three above are global — usable with any subcommand.

## `serve` subcommand

These flags / env vars apply to `semanticd serve`. Each CLI flag also accepts the matching env var.

| Variable | CLI flag | Default | Notes |
|---|---|---|---|
| `SEMANTICD_HOST` | `--host` | from `config.toml` → `server.bind` host | Guard API bind host |
| `SEMANTICD_PORT` | `--port` | from `config.toml` → `server.bind` port | Guard API port |
| `SEMANTICD_MANAGE_PORT` | `--manage-port` | `SEMANTICD_PORT + 1` | Management API port |
| `SEMANTICD_METRICS_PORT` | `--metrics-port` | `SEMANTICD_PORT + 2` | Metrics scrape port |
| `SEMANTICD_DATABASE_URL` | `--database-url` | from `config.toml` → `database.url` | Postgres connection string |
| `SEMANTICD_REDIS_URL` | `--redis-url` | from `config.toml` → `redis.url` | Redis connection string |
| `SEMANTICD_RULES_DIR` | `--rules-dir` | from `config.toml` → `engine.rules.paths[0]` | Rule files directory |
| `SEMANTICD_DEV_MODE` | `--dev-mode` | `false` | Relaxed security + verbose logging |

The three-port split is real: a single `semanticd serve` process binds three distinct ports (Guard / Management / Metrics) — see [Health and status](../api/health-and-status.md).

## Admin seeding

Run at first boot to create the initial admin user. After that the user lives in Postgres and these vars are ignored.

| Variable | Default | Notes |
|---|---|---|
| `SEMANTICD_ADMIN_USERNAME` | `admin` | Initial admin username |
| `SEMANTICD_ADMIN_PASSWORD` | `admin` | **Change this in any non-dev deployment** |
| `SEMANTICD_ADMIN_EMAIL` | unset | Stored on the user row; informational |

If the admin user is created with the default password, the gateway logs a warning at startup. Rotate via the management API (`POST /manage/users/{id}/change-password`) or via the dashboard.

## JWT signing

| Variable | Default | Notes |
|---|---|---|
| `SIF_JWT_SECRET` | random per-boot (warning logged) | HMAC-SHA256 secret for management-API JWTs. **Required** for sessions to survive restarts. |

The `SIF_*` prefix here is legacy; the value is the JWT signing secret. Set a long random string in production (e.g. `head -c 32 /dev/urandom | base64`).

## `migrate` subcommand

| Variable | CLI flag | Notes |
|---|---|---|
| `DATABASE_URL` | `--database-url` | Connection string used by the standalone migration runner. **Not** `SEMANTICD_DATABASE_URL` here. |

## Generic config override (`SEMANTICD__*` — double underscore)

Any key in [`config.toml`](config-toml.md) can be overridden by an env var with **double-underscore segment separators**:

```
TOML key                         Env var
server.bind                  →   SEMANTICD__SERVER__BIND
server.cors_enabled          →   SEMANTICD__SERVER__CORS_ENABLED
server.cors_origins          →   SEMANTICD__SERVER__CORS_ORIGINS   # comma-separated list
database.url                 →   SEMANTICD__DATABASE__URL
database.max_connections     →   SEMANTICD__DATABASE__MAX_CONNECTIONS
engine.global_timeout_ms     →   SEMANTICD__ENGINE__GLOBAL_TIMEOUT_MS
telemetry.tracing.level      →   SEMANTICD__TELEMETRY__TRACING__LEVEL
```

Boolean values accept `true` / `false` / `1` / `0`. List values are comma-separated. The override layer can't introduce keys that don't exist in the schema — invalid keys are ignored with a warning.

## Precedence

When the same setting is provided in multiple places:

1. **CLI flag** — highest
2. **Dedicated env var** (e.g. `SEMANTICD_PORT`)
3. **Generic override** (e.g. `SEMANTICD__SERVER__BIND`)
4. **`config.toml`**
5. **Compiled default** — lowest

This lets you ship a baseline `config.toml` and override per-environment via env vars or per-invocation via CLI.

## What is **not** an env var

- **Policies, rules, API keys, users.** Managed via the dashboard / management API, persisted in Postgres. See [Management endpoints](../api/management-endpoints.md).
- **Per-policy thresholds.** Persisted with the policy row. Not in env vars or `config.toml`.

## Related

- [Reference → config.toml](config-toml.md) — the underlying schema.
- [HTTP API → Health and status](../api/health-and-status.md) — the three-port architecture set by `SEMANTICD_PORT` / `SEMANTICD_MANAGE_PORT` / `SEMANTICD_METRICS_PORT`.
- [Operations → Auth and secrets](../operations/auth-and-secrets.md) — secret management patterns for `SIF_JWT_SECRET` and `SEMANTICD_ADMIN_PASSWORD`.
