---
title: Troubleshooting
description: Common failure modes and how to fix them.
---

A runbook for the alerts and symptoms that operators encounter most often.

## Gateway returns 503 for guard calls

### `pipeline_timeout`

```json
{ "error": "pipeline_timeout" }
```

A detector exceeded `global_timeout_ms`. Identify the slow detector:

```bash
curl http://localhost:8080/manage/detectors -H "Authorization: ..." \
  | jq '.detectors[] | {name, p99_latency_ms, status}'
```

Fixes:

1. Raise `global_timeout_ms` on the policy (cheap, but loses the latency guarantee).
2. Disable the slow detector for this policy (acceptable if it's optional).
3. Provision more CPU; ML detectors are CPU-bound.

### `degraded`

```json
{ "error": "degraded", "detector": "prompt_injection_ml" }
```

A required detector is in a degraded state. Check which:

```bash
curl http://localhost:8080/manage/detectors -H "Authorization: ..." \
  | jq '.detectors[] | select(.status != "active")'
```

Common causes: ML model file missing or unreadable, Redis pool exhausted (for detectors that consult Redis), upstream vendor outage (for SaaS detectors).

## Dashboard shows zero traffic after a restart

The Overview KPIs (`total_requests`, etc.) are in-memory counters; they reset to zero when the process restarts.

This is **expected** and not a fault. For the historical view, use the hourly chart on the same page (sourced from Postgres) or query `/manage/audit/stats/hourly` directly.

## WebSocket feed stuck on "connecting"

Most often: the API key the dashboard is using lacks valid auth.

```bash
# From the host where the dashboard runs:
wscat -c "ws://localhost:8081/ws/events" \
  -H "Authorization: Bearer sk_dashboard_key"
```

If wscat fails to upgrade, the key is invalid or revoked. Check `/manage/keys` and the dashboard's configuration.

In `--dev-mode` no auth is required, so the feed should always work — if it doesn't, the dashboard process is not reaching the gateway. Check Docker network connectivity and confirm port 8081 is reachable.

## Rule file fails to load

The Rules page shows a rule as `error`, or `/api/status` shows a stalled `ruleset_version`. Inspect the gateway logs:

```bash
docker compose logs gateway | grep -i 'rule_error\|parse'
```

Typical causes:

- YARA syntax error (`syntax error near token 'condition'`)
- Duplicate rule ID with an existing rule
- File permissions (the gateway can't read the file)

Fix the file. The watcher reloads automatically; no restart needed.

## Postgres connection failures at startup

```
ERROR Failed to connect to database: connection refused
```

Order of investigation:

1. Postgres is up (`docker compose ps postgres`).
2. `DATABASE_URL` is correctly set in the gateway's environment (`docker compose exec gateway env | grep DATABASE`).
3. The credentials are correct (try connecting manually: `psql "$DATABASE_URL"`).
4. The network between gateway and postgres exists (Docker network, security group, etc.).
5. Postgres `max_connections` is sufficient (`SHOW max_connections;`). Out-of-connection errors look different (`too many clients already`) — see below.

## "Too many clients already"

The Postgres `max_connections` is exhausted. Causes:

- Too many gateway replicas × `DATABASE_MAX_CONNECTIONS` per replica.
- Long-held connections from another service sharing the database.

Fix: raise `max_connections` on Postgres, lower `DATABASE_MAX_CONNECTIONS` per gateway replica, or put a connection pooler (PgBouncer) in front.

## Rate-limit floods

A single key is producing many `429`s. Triage:

```bash
curl "http://localhost:8080/manage/audit/entries?key_prefix=ps_a3f0&since=1h" \
  -H "Authorization: ..." \
  | jq '.entries | length'
```

If the volume is legitimate, raise the key's `rate_limit_rpm`. If not, disable the key with `POST /manage/keys/{id}/disable` and investigate why a client is hammering the gateway.

## Block rate suddenly spikes

Common causes:

- A new rule started firing (compare `ruleset_version` in `/api/status` against an hour ago).
- A policy threshold change (check the Policies page edit history).
- A real attack.

Roll back the most recent rule or policy change first. The block rate normalising is confirmation that's where the issue was.

## Where logs and metrics live

| For | Where |
|---|---|
| Live process logs | `docker compose logs -f gateway` |
| Structured logs (production) | Your log aggregator (Loki, Cloudwatch, Datadog) |
| Metrics | `/metrics` Prometheus endpoint |
| Current state snapshot | `/api/status` |
| Historical verdicts | `/manage/audit/entries` |

## Related

- [Deployment → Observability](../deployment/observability.md) — metrics, logs, traces in detail.
- [How-to → Monitor production traffic](../guides/monitor-production-traffic.md) — alert thresholds.
- [Production checklist](../deployment/production-checklist.md) — the sanity tests after each deploy.
