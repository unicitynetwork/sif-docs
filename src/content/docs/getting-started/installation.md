---
title: Installation
description: Prerequisites, building from source, and running locally with Docker.
sidebar:
  order: 4
---

:::caution[Self-hosting available post-alpha]
The installation path described on this page will be fully supported **after the alpha release**. While we're in alpha, please use the hosted instance at [sif.unicity.network/dashboard](https://sif.unicity.network/dashboard) with the credentials we sent you. The steps below are kept here as a preview of what self-hosting will look like.
:::

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

## Install path A — Docker (fastest)

```bash
docker run -p 8080:8080 -p 8081:8081 semantic-firewall/gateway:latest
```

Then call it:

```bash
curl -X POST http://localhost:8080/api/v1/guard \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer semd_test_key" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

The standalone image is fine for a smoke test. Anything more — persistence, the dashboard backed by real data, multiple workers — should use the full stack via Docker Compose (see [Deployment → Docker Compose](../deployment/docker-compose.md)).

## Install path B — Build from source

```bash
git clone <your-semantic-firewall-repo>
cd semantic-firewall

# Bring up Postgres and Redis
make dev

# Build the gateway and start serving
# (dashboard + YARA detection enabled; auth disabled for dev)
make run
```

The gateway listens on:

- **`http://localhost:8080`** — HTTP API
- **`http://localhost:8081/dashboard`** — operator web UI

In development mode authentication is off; if a login screen appears, the default credentials are `admin / admin`.

To include the ML detector pipeline:

```bash
make run-all
```

This requires ONNX Runtime on the host and is not supported on Intel Macs.

## Verify it works

```bash
curl http://localhost:8080/healthz
# → {"status":"ok"}

curl http://localhost:8080/version
# → {"version":"0.x.y","build":"..."}
```

Open `http://localhost:8081/dashboard` in a browser. You should see the [Overview page](../dashboard/overview-page.md) with no traffic yet.

## What's next

- [Quickstart](quickstart.md) — make your first guard call and see the verdict in the dashboard.
- [Architecture overview](architecture-overview.md) — understand what's happening end to end.
