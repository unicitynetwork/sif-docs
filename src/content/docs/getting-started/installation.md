---
title: Installation
description: Prerequisites, building from source, and running locally with Docker.
sidebar:
  order: 4
---

This page covers running Semantic Firewall locally for development or evaluation. For production deployment see [Deployment](../deployment/).

## Prerequisites

| Tool | Why | Install |
|---|---|---|
| Rust 1.75+ | Build the gateway from source | [rustup.rs](https://rustup.rs) |
| Docker | Postgres + Redis for dev | [docker.com](https://docker.com) |
| `make` | Convenience targets | system package |
| Node 20+ | Bundled dashboard build (optional) | `nvm install 20` |

Optional, for the ML detection feature:

| Tool | Why |
|---|---|
| ONNX Runtime (ORT) | Required when building with the `ml` feature flag (not supported on Intel Mac) |

## Three ports — one process, three listeners

`semanticd serve` binds **three** ports out of one process:

| Listener | Default port | Configured by |
|---|---|---|
| Guard API (`/api/v1/guard`, `/healthz`, `/readyz`, `/version`, `/status`) | `8080` | `SEMANTICD_PORT` / `--port` |
| Management API (`/manage/*`, `/api/health`, `/ws/events`, dashboard SPA) | `8081` | `SEMANTICD_MANAGE_PORT` / `--manage-port` (defaults to `port + 1`) |
| Metrics (Prometheus scrape) | `8082` | `SEMANTICD_METRICS_PORT` / `--metrics-port` (defaults to `port + 2`) |

If you map ports in Docker or a reverse proxy, expose all three. See [Health and status](../api/health-and-status.md) for what answers on which port.

## Install path A — Docker (fastest)

```bash
docker run \
  -p 8080:8080 -p 8081:8081 -p 8082:8082 \
  -e SEMANTICD_ADMIN_PASSWORD=$(openssl rand -base64 24) \
  -e SIF_JWT_SECRET=$(openssl rand -base64 32) \
  semanticd:latest
```

Smoke-test the guard endpoint (after minting a key via the management API or dashboard — see [Quickstart](quickstart.md) step 1):

```bash
curl -X POST http://localhost:8080/api/v1/guard \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_API_KEY>" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

The standalone image is fine for a smoke test. Anything more — persistence, the dashboard backed by real data, multiple workers — should use the full stack via Docker Compose (see [Deployment → Docker Compose](../deployment/docker-compose.md)).

## Install path B — Build from source

```bash
git clone https://github.com/unicitynetwork/semanticd
cd semanticd

# Build the binary
cargo build --release --bin semanticd

# Generate a starter config.toml in the cwd
./target/release/semanticd init

# Run migrations against your Postgres
./target/release/semanticd migrate --database-url postgres://…

# Serve
./target/release/semanticd serve --dev-mode
```

`semanticd serve` reads `./config.toml` by default (override with `--config <path>` or `SEMANTICD_CONFIG=<path>`). The full set of CLI flags and env vars is at [Reference → Environment variables](../reference/environment-variables.md); the TOML schema is at [Reference → config.toml](../reference/config-toml.md).

In `--dev-mode` admin auth uses a permissive default (`admin / admin` for the seeded user — override at first boot via `SEMANTICD_ADMIN_USERNAME` / `SEMANTICD_ADMIN_PASSWORD` / `SEMANTICD_ADMIN_EMAIL`).

## CLI subcommands

```
semanticd [--config <path>] [--log-level <l>] [--log-format <f>] <subcommand>
```

| Subcommand | Purpose |
|---|---|
| `serve` | Start the gateway (binds the three ports above) |
| `migrate` | Apply pending Postgres migrations. Reads `DATABASE_URL` env var |
| `init` | Write a starter `config.toml` |
| `check-policies` | Validate a directory of policy YAML files against the schema |

Global flags (`--config`, `--log-level`, `--log-format`) accept `SEMANTICD_*` env-var equivalents — see the env-var reference.

## Verify it works

```bash
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
curl http://localhost:8080/version
```

`/healthz` returns 200 once the process is up; `/readyz` returns 200 once Postgres + the rule loader are healthy; `/version` reports the build's version, commit, build date, and active feature flags.

The dashboard SPA lives on the **management port**:

```
http://localhost:8081/dashboard
```

Default seeded admin: `admin` / whatever you set via `SEMANTICD_ADMIN_PASSWORD` (or `admin / admin` if you didn't — change it at first login).

## What's next

- [Quickstart](quickstart.md) — make your first guard call and see the verdict in the dashboard.
- [Architecture overview](architecture-overview.md) — understand what's happening end to end.
