---
title: Environment variables
description: Runtime overrides for every config.toml key.
---

Any key in `config.toml` can be overridden by an environment variable. This page lists the most common ones explicitly; the general convention is at the bottom.

## Common variables

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | (required) | Full Postgres connection string |
| `DATABASE_URL_FILE` | unset | Path to a file containing the URL; takes precedence over `DATABASE_URL` |
| `REDIS_URL` | (required) | Full Redis connection string |
| `REDIS_URL_FILE` | unset | Path to a file containing the URL |
| `RUST_LOG` | `info` | Log level; supports per-module overrides, e.g. `info,semanticd::pipeline=debug` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset | Enables OTLP trace export when set |
| `OTEL_SERVICE_NAME` | `semantic-firewall` | Service name for traces |
| `OTEL_TRACES_SAMPLER_ARG` | `0.0` | Sample rate `[0, 1]` |

## Server

| Variable | TOML key | Default |
|---|---|---|
| `UNICITY_SERVER_API_PORT` | `server.api_port` | `8080` |
| `UNICITY_SERVER_DASHBOARD_PORT` | `server.dashboard_port` | `8081` |
| `UNICITY_SERVER_BIND_ADDRESS` | `server.bind_address` | `0.0.0.0` |

## Database

| Variable | TOML key | Default |
|---|---|---|
| `UNICITY_DATABASE_URL` (alias `DATABASE_URL`) | `database.url` | — |
| `UNICITY_DATABASE_MAX_CONNECTIONS` | `database.max_connections` | `20` |
| `UNICITY_DATABASE_STATEMENT_TIMEOUT_MS` | `database.statement_timeout_ms` | `5000` |

## Redis

| Variable | TOML key | Default |
|---|---|---|
| `UNICITY_REDIS_URL` (alias `REDIS_URL`) | `redis.url` | — |
| `UNICITY_REDIS_POOL_SIZE` | `redis.pool_size` | `10` |

## Rules

| Variable | TOML key | Default |
|---|---|---|
| `UNICITY_RULES_DIRECTORY` | `rules.directory` | `/etc/unicity/rules` |
| `UNICITY_RULES_WATCH` | `rules.watch` | `true` |

## Security

| Variable | TOML key | Default |
|---|---|---|
| `UNICITY_SECURITY_ENCRYPTION_KEY` | `security.encryption_key` | — |
| `UNICITY_SECURITY_ENCRYPTION_KEY_FILE` | `security.encryption_key_file` | — |

## Telemetry

| Variable | TOML key | Default |
|---|---|---|
| `UNICITY_TELEMETRY_METRICS_ENABLED` | `telemetry.metrics_enabled` | `true` |
| `UNICITY_TELEMETRY_TRACES_ENABLED` | `telemetry.traces_enabled` | `false` |
| `UNICITY_TELEMETRY_TRACES_ENDPOINT` | `telemetry.traces_endpoint` | — |

## Naming convention for unlisted keys

For any TOML key not listed above:

```
TOML key:    foo.bar_baz
Env var:     UNICITY_FOO_BAR_BAZ
```

Uppercase, replace dots with underscores, prefix with `UNICITY_`. Boolean values accept `true`/`false`/`1`/`0`.

## Precedence

When the same setting is provided in multiple places, precedence is:

1. **Environment variable** — highest
2. **`config.toml`**
3. **Compiled default** — lowest

This lets you commit a baseline `config.toml` to VCS and override per-environment values via the env.

## What env vars cannot set

Nested arrays (`[[policies]]`, the per-detector blocks, the threshold maps inside policies). Edit `config.toml` for those.

## Related

- [Reference → config.toml](config-toml.md) — every TOML key.
- [Operations → Auth and secrets](../operations/auth-and-secrets.md) — file-based secret injection.
