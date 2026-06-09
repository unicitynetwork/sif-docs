---
title: Kubernetes
description: Helm chart and manifests — currently a roadmap item.
---

> **Status: pending.** Unicity-AOS9 does not currently ship an official Helm chart or Kubernetes manifests. This page describes the intended approach for operators who want to deploy on Kubernetes today.

For Kubernetes deployments today, the path is:

1. Build the gateway image from source (see [Installation](../getting-started/installation.md)) or use a published image.
2. Write your own `Deployment` / `Service` / `ConfigMap` manifests. The shape is unsurprising — a stateless container, a `HorizontalPodAutoscaler`, and an `Ingress` in front. The [Docker Compose](docker-compose.md) reference is a good guide for env vars, ports, and dependencies.
3. Use a managed Postgres and Redis (RDS, Cloud SQL, ElastiCache, etc.) — see [Postgres and Redis](postgres-and-redis.md).
4. Mount `config.toml` from a `ConfigMap` and secrets from a `Secret`.

## Probe configuration

When you write your `Deployment`, point the probes at the [health endpoints](../api/health-and-status.md):

```yaml
livenessProbe:
  httpGet: { path: /healthz, port: 8080 }
  periodSeconds: 10
readinessProbe:
  httpGet: { path: /readyz, port: 8080 }
  periodSeconds: 5
  initialDelaySeconds: 10
```

The gateway needs ~10 seconds on cold start to load rules, initialise detectors, and warm any ML models. Increase `initialDelaySeconds` if the `ml` feature is enabled.

## Resource requirements

| Detectors enabled | Memory request | CPU request |
|---|---|---|
| Regex + YARA + PII | 256 MiB | 250 m |
| + ML (one model) | 768 MiB | 500 m |
| + ML (two models, both loaded) | 1.5 GiB | 1.0 |

These are starting points; profile your workload before pinning final values.

## What's on the roadmap

The intended Helm chart will bundle:

- `Deployment` + `Service` + `Ingress`
- `HorizontalPodAutoscaler` keyed on CPU
- `ConfigMap` for `config.toml`
- Optional sidecar for log forwarding
- A subchart for Postgres (off by default; assumes managed in production)

Track its arrival in the [Changelog](../operations/changelog.md).

## Related

- [Docker Compose](docker-compose.md) — the supported alternative for now.
- [Postgres and Redis](postgres-and-redis.md) — what to provision separately.
- [Observability](observability.md) — metrics, logs, traces in a cluster.
