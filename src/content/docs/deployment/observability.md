---
title: Observability
description: Metrics, logs, and traces for a production gateway.
---

The gateway exposes three observability surfaces. This page describes what's emitted and how to scrape it.

## Metrics

### Prometheus endpoint

`GET /metrics` returns Prometheus-format metrics on the API port. Scrape every 15 s.

Key metrics:

| Metric | Type | Labels |
|---|---|---|
| `unicity_guard_requests_total` | counter | `action`, `policy` |
| `unicity_guard_duration_ms` | histogram | `action`, `policy` |
| `unicity_detector_duration_ms` | histogram | `detector` |
| `unicity_detector_errors_total` | counter | `detector`, `error_kind` |
| `unicity_audit_writes_total` | counter | `result` |
| `unicity_websocket_connections` | gauge | |
| `unicity_websocket_events_sent_total` | counter | `type` |
| `unicity_rules_loaded` | gauge | |
| `unicity_redis_pool_idle` | gauge | |
| `unicity_postgres_pool_idle` | gauge | |

Useful derivations:

- **Request rate** — `rate(unicity_guard_requests_total[1m])`
- **Block rate** — `sum(rate(unicity_guard_requests_total{action="block"}[5m])) / sum(rate(unicity_guard_requests_total[5m]))`
- **Latency p99** — `histogram_quantile(0.99, sum(rate(unicity_guard_duration_ms_bucket[5m])) by (le))`
- **Detector slowness** — same but `by (detector, le)`

### `/api/status`

Lower-cardinality, in-memory view of the same data. Useful for the dashboard and for cheap health checks. See [HTTP API → Health and status](../api/health-and-status.md).

## Logs

The gateway writes structured logs to stdout in JSON:

```json
{
  "ts": "2026-06-07T18:42:10.123Z",
  "level": "info",
  "target": "semanticd::pipeline",
  "request_id": "req_b7d4e9f2",
  "message": "verdict: block",
  "policy": "default",
  "risk_score": 0.91,
  "latency_ms": 12
}
```

Ship to your log aggregator with whatever sidecar / agent your platform provides (Fluent Bit, Vector, Cloudwatch Agent, etc.). Key fields:

| Field | Meaning |
|---|---|
| `request_id` | Joins logs to audit rows |
| `level` | `info` / `warn` / `error` |
| `target` | Rust module path — useful for filtering |

Control verbosity with the `RUST_LOG` env var. `info` is the default; `debug` triples log volume; `trace` is per-message detail (do not enable in production).

## Traces

The gateway emits OpenTelemetry traces when configured. Set:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://collector.example.com:4317
OTEL_SERVICE_NAME=semantic-firewall
OTEL_TRACES_SAMPLER_ARG=0.1
```

A typical span tree for a guard call:

```
POST /api/v1/guard
├── auth.validate_key
├── policy.lookup
├── pipeline.run
│   ├── detector.regex
│   ├── detector.yara
│   ├── detector.pii_scanner
│   └── detector.prompt_injection_ml
├── combiner.aggregate
└── audit.write
```

Each detector gets its own span; this is where slow detectors surface during incident debugging.

## Health endpoints

| Endpoint | For |
|---|---|
| `/healthz` | LB / container liveness |
| `/readyz` | LB / container readiness |
| `/version` | Cluster fleet introspection |
| `/api/status` | Dashboard + cheap status pages |

See [HTTP API → Health and status](../api/health-and-status.md) for response shapes.

## Recommended dashboards

See [How-to → Monitor production traffic](../guides/monitor-production-traffic.md) for the curated set.

## Related

- [How-to → Monitor production traffic](../guides/monitor-production-traffic.md) — operator-facing view.
- [Production checklist](production-checklist.md) — observability items to verify before launch.
- [HTTP API → Events WebSocket](../api/events-websocket.md) — push-based alternative to scraping.
