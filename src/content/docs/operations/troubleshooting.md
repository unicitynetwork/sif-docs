---
title: Troubleshooting
description: Common failure modes and how to fix them.
---

A runbook for the alerts and symptoms that operators encounter most often.

## Gateway returns 503 or 504 for guard calls

There is no distinct `pipeline_timeout` or `degraded` error code — see
[Reference → API error codes](../reference/api-error-codes.md). Everything
below arrives as the standard two-field envelope, and the **`message` is
what tells the causes apart**:

```json
{ "code": "ServiceUnavailable", "message": "…" }
```

### Detection timed out — HTTP `504`

A detector exceeded `global_timeout_ms`. Note the mismatch: the status is
`504 Gateway Timeout` but the wire `code` is `ServiceUnavailable`, because
`ApiError::Timeout` maps to that code. Match on the status, not the code, if
you need to single out timeouts.

Identify the slow detector:

```bash
curl http://localhost:8080/manage/detectors -H "Authorization: ..." \
  | jq '.detectors[] | {name, p99_latency_ms, status}'
```

Fixes:

1. Raise `global_timeout_ms` on the policy (cheap, but loses the latency guarantee).
2. Disable the slow detector for this policy (acceptable if it's optional).
3. Provision more CPU; ML detectors are CPU-bound.

### A detector is degraded — usually **not** an error at all

`degraded` is not an error code and does not appear in an error body. It is
a field on a **successful `200` guard response**:

```json
{ "action": "allow", "blocked": false, "degraded": true }
```

That is the fail-open direction, and the field is the only sign of it — the
request was served without being screened the way the policy asked. Alert on
`degraded: true`, and use `AuditQuery { degraded_only: true }` to find past
occurrences. A caller reading `action` alone will treat unscreened content
as safe.

A detector in a bad state can also surface as a `500` with code
`InternalError` when the pipeline itself errors rather than degrading.

Check which detector is unhealthy:

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
  -H "Authorization: Bearer semd_dashboard_key"
```

If wscat fails to upgrade, the key is invalid or revoked. Check `/manage/api-keys` and the dashboard's configuration.

In `--dev-mode` no auth is required, so the feed should always work — if it doesn't, the dashboard process is not reaching the gateway. Check Docker network connectivity and confirm port 8081 is reachable.

## Rule file fails to load

The Guardrails › Rules shows a rule as `error`, or `/api/status` shows a stalled `ruleset_version`. Inspect the gateway logs:

```bash
docker compose logs gateway | grep -i 'rule_error\|parse'
```

Typical causes:

- YARA syntax error (`syntax error near token 'condition'`)
- Duplicate rule ID with an existing rule
- File permissions (the gateway can't read the file)

Fix the file. The watcher reloads automatically; no restart needed.

## A rule is in the corpus but never fires

> **A known, unfixed defect.** Screening is silently reduced: a match is found
> and then discarded, and the response says nothing.

**The symptom.** A rule exists, is enabled, is in a ruleset the policy attaches,
and demonstrably matches the text — yet the guard returns `200` with the rule
absent from `detections`. Nothing in the response says anything was dropped.
The request was screened against less than the operator attached, and the only
sign of it is at boot, hours earlier.

**Why it happens.** The gateway holds two views of the same rules from two
different sources, joined by rule id. The patterns the engine actually matches
against are compiled from the rule **files**; the list of rule ids a policy is
allowed to use is built from the **`rules` table**. Boot-time sync is what keeps
them in step. When the sync leaves a file rule with no database row, the engine
still matches it and the policy's selection then discards the match — a hit is
found and thrown away, with no error and no field on the response.

**The two triggers the boot sync itself can produce:**

1. **A tenant ruleset squatting a shipped pack's id.** The sync refuses to write
   pack content into a tenant-owned row, so it skips the whole pack. Every rule
   in that pack is then in the corpus and in no policy's selection.
2. **A single failed rule-row insert.** The pack's ruleset row exists and is
   attached; it is missing exactly that one rule. No squat needed.

**How to spot it.** The boot log names both, and is the only place either is
reported:

```bash
# Trigger 1 — logged at ERROR, names the pack in `ruleset_id`:
docker compose logs gateway | grep 'shadows this shipped pack id'

# Trigger 2 — logged at WARN, names the rule in `rule_id`:
docker compose logs gateway | grep 'Failed to sync rule to database'
```

If neither appears in the logs of the current process's startup, this is not
your cause — check [Rule file fails to load](#rule-file-fails-to-load) instead.

**Status: known and unfixed, by decision.** Every candidate fix changes
behaviour — refusing to boot on a squat, making the drop loud at request time,
or building selections from the composed corpus so the two sources cannot
diverge — and none has been chosen. There is an executable repro pinned in the
test suite (`crates/semanticd/tests/a_squatted_pack_id_silently_stops_screening.rs`),
which asserts the broken behaviour deliberately so the defect stays findable.

**What you can do now.** For trigger 1, rename or delete the custom ruleset
whose `ruleset_id` collides with the shipped pack and restart; the pack then
syncs and its rules enter selections. For trigger 2, fix whatever the `error`
field on the `warn` names (usually a constraint violation on the rule row) and
restart. In both cases the boot log going quiet is the confirmation.

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
# The management API is on port 8081, not 8080, and takes a JWT from
# POST /manage/auth/login. `api_key_id` is the key's public prefix.
curl "http://localhost:8081/manage/audit?api_key_id=semd_a3f0&start_date=2026-06-01T09:00:00Z" \
  -H "Authorization: Bearer ${JWT}" \
  | jq '.total'
```

If the volume is legitimate, raise the key's `rate_limit_rpm`. If not, suspend the key with `POST /manage/api-keys/{id}/suspend` and investigate why a client is hammering the gateway.

## Block rate suddenly spikes

Common causes:

- A new rule started firing (compare `ruleset_version` in `/api/status` against an hour ago).
- A policy threshold change (check Guardrails › Policies edit history).
- A real attack.

Roll back the most recent rule or policy change first. The block rate normalising is confirmation that's where the issue was.

## Where logs and metrics live

| For | Where |
|---|---|
| Live process logs | `docker compose logs -f gateway` |
| Structured logs (production) | Your log aggregator (Loki, Cloudwatch, Datadog) |
| Metrics | `/metrics` Prometheus endpoint |
| Current state snapshot | `/api/status` |
| Historical verdicts | `/manage/audit` |

## Related

- [Deployment → Observability](../deployment/observability.md) — metrics, logs, traces in detail.
- [How-to → Monitor production traffic](../guides/monitor-production-traffic.md) — alert thresholds.
- [Production checklist](../deployment/production-checklist.md) — the sanity tests after each deploy.
