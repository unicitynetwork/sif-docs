---
title: Monitor production traffic
description: Dashboards, alerts, and SLOs for a deployed gateway.
---

Three sources of truth for "what is the gateway doing right now?":

| Source | What it's for | Latency | Persistence |
|---|---|---|---|
| `GET /api/status` | Per-process counters, health | Live | In-memory (resets on restart) |
| `GET /manage/audit/stats/hourly` | Volume trends over time | Hourly buckets | Postgres |
| `wss://…/ws/events` | Individual verdicts in real time | Live | None (subscribe-or-miss) |

Pick the right one for the job. The patterns below assume a managed deployment with multiple gateway replicas.

## Recommended dashboards

### Operational dashboard — what you check at 9am

Built against `GET /manage/audit/stats/hourly`, refreshed every 30 seconds:

| Panel | Query |
|---|---|
| Verdict volume by hour, last 24h, stacked by action | `hourly[hour].by_action.{allow,block,flag,modify}` |
| Block rate (block ÷ total), last 24h | computed from the same response |
| Flag rate (flag ÷ total) | computed |
| Top firing detectors, last 24h | `GET /manage/audit/entries?since=24h&aggregate=detector` |

Keep this dashboard narrow. The job is *catch-the-anomaly*, not deep analysis.

### Latency dashboard — what you check during incidents

Built against `GET /api/status` from each gateway replica (scrape every 15 s):

| Panel | Field |
|---|---|
| p99 latency per replica | `metrics.p99_latency_ms` |
| Average latency per replica | `metrics.avg_latency_ms` |
| Per-replica requests/sec | rate of `metrics.total_requests` |
| Detectors loaded per replica | `metrics.detectors_loaded` (alert if a replica drifts) |

Sum across replicas for the cluster view.

## Alerts that pay rent

Signal-to-noise threshold for paging alerts:

| Alert | Rule of thumb |
|---|---|
| **Gateway down** | `/healthz` returns non-200 for > 30s, any replica |
| **Block rate spike** | Block rate doubles over the trailing 6-hour baseline |
| **Detector degraded** | `detector_state` event with `state: degraded` on the WebSocket feed |
| **Rule load failure** | `rule_error` event on the WebSocket feed |
| **Latency p99 breach** | p99 latency over the SLO for 5 consecutive minutes |
| **Rate-limit floods** | More than N% of requests from one key returning 429 |

Lower-priority alerts (ticket, not page):

| Alert | Rule of thumb |
|---|---|
| **Flag rate drift** | Flag rate baseline shifts > 50% week-over-week |
| **Audit backlog** | Audit insert queue depth > some threshold |
| **API key idle** | A non-revoked key has been unused for > 30 days |

## SLOs to commit to

For an internal LLM-app deployment:

- **Availability** — `/api/v1/guard` returns 2xx within 1 second for ≥ 99.9% of requests over a 30-day window.
- **Latency** — p99 of the guard call ≤ 50 ms (regex + YARA + PII only) or ≤ 100 ms (with ML detectors enabled).
- **Throughput** — sustains ≥ 500 rps per gateway replica at the latency SLO.

Numbers vary by workload. The point is to have *numbers*, with an explicit error budget burn rate.

## Forwarding to external systems

| System | What to forward | How |
|---|---|---|
| **SIEM** | All `block` and `modify` verdicts | Subscribe to `/ws/events?actions=block,modify` |
| **APM (Datadog, New Relic, etc.)** | Latency and throughput from `/api/status` | Scrape per replica |
| **Log aggregator** | Gateway stdout/stderr | Standard container log collection |
| **Data warehouse** | Full audit log | Periodic `GET /manage/audit/entries?since=<watermark>` |

Avoid scraping `/manage/audit/entries` more often than once per minute — it's a database query, not a metrics endpoint.

## Related

- [Operations → Auth and secrets](../operations/auth-and-secrets.md) — where the credentials for the streams above are stored.
- [Operations → Troubleshooting](../operations/troubleshooting.md) — what to do when an alert fires.
- [Deployment → Observability](../deployment/observability.md) — the deploy-time setup for all of the above.
- [How-to → Stream detection events](stream-detection-events.md) — the WebSocket consumer pattern.
