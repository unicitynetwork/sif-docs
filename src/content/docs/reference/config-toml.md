---
title: config.toml
description: Every key in the gateway's configuration file.
---

Grounded in [`crates/semd-core/src/config.rs::AppConfig`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-core/src/config.rs). The names and defaults below match `serde` exactly.

The gateway reads its configuration from a single TOML file. Path defaults to `./config.toml` (relative to the working directory); override with `--config <path>` or `SEMANTICD_CONFIG=<path>`.

Every key has a default. The minimal valid `config.toml` is empty — the gateway boots on defaults.

## `[server]`

Guard API listener. The management API and metrics endpoint bind on `bind`'s host with port `+1` and `+2` respectively unless overridden — see [Health and status](../api/health-and-status.md) for the three-port architecture.

```toml
[server]
bind = "0.0.0.0:8080"        # host:port for the guard API
workers = 0                   # 0 = num_cpus
request_body_limit = "1MiB"   # accepts SI / IEC suffixes (KiB, MiB, GiB)
request_timeout_ms = 30000
cors_enabled = true
cors_origins = []             # empty = allow all when cors_enabled=true
```

### `[server.tls]`

```toml
[server.tls]
enabled = false
cert = "/etc/semanticd/tls/cert.pem"
key  = "/etc/semanticd/tls/key.pem"
```

## `[database]`

Postgres connection pool.

```toml
[database]
url = "postgres://semanticd:semanticd@localhost/semanticd"
max_connections = 20
min_connections = 1
acquire_timeout_secs = 30
idle_timeout_secs = 600
run_migrations = true         # apply pending migrations at startup
```

## `[redis]`

```toml
[redis]
url = "redis://localhost:6379"
pool_size = 16
connection_timeout_ms = 5000
```

## `[engine]`

Detection-pipeline tuning.

```toml
[engine]
global_timeout_ms = 5000               # whole-pipeline ceiling
short_circuit = false                  # stop pipeline once a detector hits short_circuit_threshold
short_circuit_threshold = 0.95
```

### `[engine.models]`

ONNX runtime + per-model artifacts.

```toml
[engine.models]
onnx_threads = 4
onnx_inter_threads = 1

[engine.models.prompt_injection]
model     = "/var/lib/semanticd/models/prompt-injection.onnx"
tokenizer = "/var/lib/semanticd/models/prompt-injection-tokenizer.json"
max_tokens = 512
window_overlap = 64

[engine.models.jailbreak]
model     = "/var/lib/semanticd/models/jailbreak.onnx"
tokenizer = "/var/lib/semanticd/models/jailbreak-tokenizer.json"
max_tokens = 512
window_overlap = 64

[engine.models.dlp_ner]
model     = "/var/lib/semanticd/models/dlp-ner.onnx"
tokenizer = "/var/lib/semanticd/models/dlp-ner-tokenizer.json"
max_tokens = 256
window_overlap = 32
```

The exact ML detectors that load depend on the cargo feature flags compiled into the binary; check `/version` for `features`.

### `[engine.rules]`

Where rule files are discovered and how reloads propagate.

```toml
[engine.rules]
paths = ["/etc/semanticd/rules"]
watch = true                                  # filesystem hot-reload
redis_channel = "semanticd:rules:updated"     # pub/sub channel for cluster-wide reload
```

`watch = false` disables hot reload; useful for immutable-rules deployments.

## `[telemetry]`

```toml
[telemetry]
prometheus_bind = "0.0.0.0:9090"
audit_log_batch_size = 100
audit_log_flush_interval_ms = 1000
```

### `[telemetry.tracing]`

```toml
[telemetry.tracing]
level = "info"      # "trace" | "debug" | "info" | "warn" | "error"
format = "pretty"   # "pretty" | "compact" | "json"
```

Use `format = "json"` for production aggregators; `pretty` for dev.

## `[dashboard]`

The embedded SPA. Only relevant if the binary was built with the `dashboard` feature.

```toml
[dashboard]
enabled = true
path = "/dashboard"
session_timeout_secs = 86400   # 24 h JWT lifetime
```

## What is **not** in the TOML

- **Policies, rules, API keys, users** — these are managed via the dashboard / management API, persisted in Postgres, not via `config.toml`. See [Management endpoints](../api/management-endpoints.md).
- **JWT signing secret** — currently read from `SIF_JWT_SECRET` env var only (no TOML key).
- **Admin seeding** — read from `SEMANTICD_ADMIN_USERNAME` / `_PASSWORD` / `_EMAIL` env vars at first boot, not from `config.toml`.

## Environment-variable overrides

Nested keys can be overridden via env vars in the form `SEMANTICD__SECTION__KEY` (double underscores between segments). The override layer accepts lists as comma-separated values:

```
SEMANTICD__SERVER__BIND=0.0.0.0:9080
SEMANTICD__SERVER__CORS_ENABLED=true
SEMANTICD__SERVER__CORS_ORIGINS=https://a.example.com,https://b.example.com
SEMANTICD__DATABASE__MAX_CONNECTIONS=50
```

For the simple "hostname / port / URL" cases, the dedicated env vars (`SEMANTICD_HOST`, `SEMANTICD_PORT`, `SEMANTICD_DATABASE_URL`, etc.) are easier — see [Environment variables](environment-variables.md).

## Validation

Validate a config without booting the server:

```bash
semanticd --config /path/to/config.toml init --output /tmp/out.toml   # writes a starter template
semanticd check-policies --path /path/to/policies                       # validates a policies directory
```

The serve subcommand validates `config.toml` at startup; errors print to stderr and the process exits without binding.

## Related

- [Reference → Environment variables](environment-variables.md) — the env-var override list.
- [HTTP API → Health and status](../api/health-and-status.md) — the three-port architecture this config drives.
- [Deployment → Docker Compose](../deployment/docker-compose.md) — how the file is mounted in the reference stack.
