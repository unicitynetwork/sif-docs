---
title: Health and status
description: /healthz, /readyz, /version, /status — process introspection.
---

Four endpoints for health and metrics. Unlike `/api/v1/*` and `/manage/*`, the health endpoints are unauthenticated and stable (not marked beta).

## `GET /healthz`

Liveness probe. Returns `200` if the process is running, regardless of whether it's actually serving traffic.

```bash
curl http://localhost:8080/healthz
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

| Need | Endpoint |
|---|---|
| Is the process alive? | `/healthz` |
| Should I send it traffic? | `/readyz` |
| What version is running? | `/version` |
| Current metrics + ruleset version | `/api/status` |
| Historical metrics | `/manage/audit/stats/hourly` |

## Related

- [Concepts → The guard pipeline](../concepts/the-guard-pipeline.md) — what `total_requests` counts.
- [Dashboard → Overview page](../dashboard/overview-page.md) — UI on top of `/api/status`.
- [Deployment → Observability](../deployment/observability.md) — scraping these endpoints in production.
