---
title: Deployment
description: Going from a laptop install to a production deployment. Covers Docker, Kubernetes, Postgres, Redis, TLS, and observability.
---

:::caution[Self-hosting available post-alpha]
The deployment paths described in this section will be fully supported **after the alpha release**. While we're in alpha, please use the hosted instance at [sif.unicity.network/dashboard](https://sif.unicity.network/dashboard) with the credentials we sent you. The pages here are kept as a preview of what self-hosting will look like.
:::

Going from a laptop install to a production deployment. Covers Docker, Kubernetes, Postgres, Redis, TLS, and observability.

## Pages in this section

| Page | What it covers |
|---|---|
| [Docker Compose](docker-compose.md) | The reference stack |
| [Kubernetes](kubernetes.md) | Helm chart and manifests (stub — pending official manifests) |
| [Postgres and Redis](postgres-and-redis.md) | Persistence and ephemeral state |
| [TLS and reverse proxy](tls-and-reverse-proxy.md) | nginx, Caddy, or a load balancer in front |
| [Observability](observability.md) | Metrics, logs, traces |
| [Production checklist](production-checklist.md) | What to verify before going live |
