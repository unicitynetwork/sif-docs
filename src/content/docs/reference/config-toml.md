---
title: config.toml
description: Every key in the gateway's configuration file.
---

The gateway reads its configuration from a single TOML file. Path defaults to `/etc/unicity/config.toml`; override with `--config <path>`.

Every key is optional unless marked otherwise. Defaults are listed.

## `[server]`

```toml
[server]
api_port = 8080            # HTTP API listener
dashboard_port = 8081      # Dashboard listener; ignored without the dashboard feature
bind_address = "0.0.0.0"
request_body_max_bytes = 1048576   # 1 MiB
```

## `[database]`

```toml
[database]
url = "postgres://user:pass@host/db"   # required
max_connections = 20
statement_timeout_ms = 5000
migration_timeout_ms = 60000
```

`url` is required. The other fields are tunables for high-throughput deployments.

## `[redis]`

```toml
[redis]
url = "redis://host:6379"   # required
pool_size = 10
```

## `[rules]`

```toml
[rules]
directory = "/etc/unicity/rules"
watch = true
reload_debounce_ms = 500
```

`watch = false` disables hot reload. Useful for deployments where the rules directory is immutable.

## `[detectors]`

Per-detector configuration. Only the keys differ per detector.

```toml
[detectors.regex]
enabled = true

[detectors.yara]
enabled = true
recursion_limit = 1000

[detectors.pii_scanner]
enabled = true
redact = true              # rewrite messages with [REDACTED] markers

[detectors.prompt_injection_ml]
enabled = false            # requires the ml feature flag
model_path = "/etc/unicity/models/prompt-injection-v3.onnx"
threshold_floor = 0.3

[detectors.jailbreak_ml]
enabled = false
model_path = "/etc/unicity/models/jailbreak-v2.onnx"
threshold_floor = 0.3
```

## `[[policies]]`

One block per policy. See [Concepts → Policies](../concepts/policies.md) for the model.

```toml
[[policies]]
name = "default"
is_default = true
fail_mode = "allow"           # "allow" | "flag" | "block"
global_timeout_ms = 200
short_circuit = true
short_circuit_threshold = 0.95
aggregation_mode = "max"      # "max" | "weighted_sum"
audit_full_body = false
audit_retention_days = 90
aggregate_retention_days = 365

[policies.thresholds]
prompt_injection  = { flag = 0.5, block = 0.8  }
jailbreak         = { flag = 0.5, block = 0.85 }
pii               = { flag = 0.7, block = 0.95 }
data_exfiltration = { flag = 0.6, block = 0.85 }

[policies.detectors]
regex               = { enabled = true,  weight = 1.0 }
yara                = { enabled = true,  weight = 1.0 }
pii_scanner         = { enabled = true,  weight = 1.0 }
prompt_injection_ml = { enabled = false, weight = 1.2 }
```

## `[logging]`

```toml
[logging]
level = "info"             # "trace" | "debug" | "info" | "warn" | "error"
format = "json"            # "json" | "pretty"
```

`pretty` is human-readable; use it only in development. `json` is what production log aggregators expect.

## `[telemetry]`

```toml
[telemetry]
metrics_enabled = true
metrics_path = "/metrics"
traces_enabled = false
traces_endpoint = "https://collector.example.com:4317"
traces_sample_rate = 0.1
```

## `[security]`

```toml
[security]
encryption_key = "..."     # 32-byte hex; required when audit_full_body = true
encryption_key_file = "/run/secrets/encryption_key"   # alternative to inline
```

Use `encryption_key_file` in production. Inline `encryption_key` is for dev only.

## Environment variable override

Any key can be overridden by an env var. The naming convention:

```
TOML key:   server.api_port
Env var:    UNICITY_SERVER_API_PORT
```

Nested arrays (like `[[policies]]`) cannot be overridden via env vars — edit the file.

## Validation

The gateway validates the config on startup. Errors print to stderr and the process exits without serving. Validate without starting the server:

```bash
semantic-firewall validate-config --config /path/to/config.toml
```

## Related

- [Reference → environment variables](environment-variables.md) — full list of env-var overrides.
- [Concepts → Policies](../concepts/policies.md) — the model behind `[[policies]]`.
- [Deployment → Docker Compose](../deployment/docker-compose.md) — how the file is mounted in the reference stack.
