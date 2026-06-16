---
title: Health and status
description: /healthz, /readyz, /version, /status — process introspection.
---

Health and metrics surface on **two ports**, not one. The split is part of the gateway's three-port architecture:

| Port | Bound by | Endpoints |
|---|---|---|
| **Guard API** (default `SEMANTICD_PORT`, e.g. 8080) | `semd-api` | `/healthz`, `/readyz`, `/version`, `/status` |
| **Management API** (default `SEMANTICD_PORT + 1`, e.g. 8081) | `semd-manage` | `/api/health`, `/api/version`, `/api/status` |
| **Metrics** (default `SEMANTICD_PORT + 2`, e.g. 8082) | `semd-telemetry` | Prometheus scrape endpoint |

The guard-side and management-side health endpoints answer for **different processes** in different feature-flag configurations — they aren't the same. The guard side is what your load balancer should probe; the management side is what the dashboard polls.

All health endpoints are unauthenticated and stable (not marked beta).

## `GET /healthz`

Liveness probe. Returns `200` if the process is running, regardless of whether it's actually serving traffic.

```bash
curl https://sif.unicity.network/healthz
```

```json
{ "status": "ok" }
```

Use this for:

- Kubernetes / Docker liveness probes
- Load-balancer liveness checks
- Cheap "is this thing alive" pings

Do **not** use it to decide whether to send traffic. Use `/readyz` for that.

## `GET /readyz`

Readiness probe. Returns `200` if the process is ready to serve guard requests — Postgres connection healthy, rules loaded, detectors initialised.

```json
{
  "status": "ready",
  "rules_loaded": 142,
  "detectors_loaded": 5,
  "models_loaded": 2,
  "postgres": "ok",
  "redis": "ok"
}
```

Returns `503` if any required dependency is failing:

```json
{
  "status": "not_ready",
  "postgres": "error: connection refused",
  "rules_loaded": 142,
  "detectors_loaded": 5
}
```

Use this for:

- Kubernetes readiness probes
- Load-balancer "should I add this replica to the pool?" checks

## `GET /version`

Build information. Stable identifier for a running gateway.

```json
{
  "version": "0.4.1",
  "commit": "a3f0c8e",
  "build_date": "2026-06-01T10:30:00Z",
  "features": ["dashboard", "yara", "ml"]
}
```

`features` lists the feature flags this binary was built with. Useful for verifying that ML / dashboard / YARA support is actually compiled in.

## `GET /api/status`

Detailed runtime status with metrics. Polled by the dashboard's Overview page every 5 seconds.

```json
{
  "status": "ok",
  "uptime_secs": 3672,
  "version": "0.4.1",
  "metrics": {
    "total_requests": 14852,
    "blocked_requests": 312,
    "flagged_requests": 88,
    "allowed_requests": 14452,
    "avg_latency_ms": 9.4,
    "p99_latency_ms": 24.1,
    "active_rules": 142,
    "detectors_loaded": 5,
    "active_models": 2
  },
  "ruleset_version": 42
}
```

| Field | Meaning |
|---|---|
| `uptime_secs` | Seconds since the process started |
| `metrics.total_requests` | In-memory counter; resets on restart |
| `metrics.*_requests` | Per-action counters, also in-memory |
| `metrics.avg_latency_ms` | Mean of all guard latencies since start |
| `metrics.p99_latency_ms` | 99th percentile, computed from a rolling window |
| `metrics.active_rules` | Rules currently enabled and loaded |
| `metrics.detectors_loaded` | Detector adapters initialised |
| `metrics.active_models` | ML models held in memory |
| `ruleset_version` | Incremented on every hot-reload |

The counters are **in-memory** and reset to zero on process restart. For historical request volume use `GET /manage/audit/stats/hourly`; for latency over time use APM (the values here are a snapshot).

## When to use which

| Need | Endpoint | Port |
|---|---|---|
| Is the guard process alive? | `/healthz` | Guard |
| Should I route traffic to it? | `/readyz` | Guard |
| What version is running? | `/version` (guard) or `/api/version` (manage) | Either |
| Current metrics + ruleset version | `/api/status` | Manage |
| Is the management API alive? | `/api/health` | Manage |
| Historical metrics | `/manage/audit/stats/hourly` | Manage |

## Related

- [Concepts → The guard pipeline](../concepts/the-guard-pipeline.md) — what `total_requests` counts.
- [Dashboard → Overview page](../dashboard/overview-page.md) — UI on top of `/api/status`.
- [Deployment → Observability](../deployment/observability.md) — scraping these endpoints in production.
