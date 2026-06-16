---
title: Threats and verdicts
description: What gets stored, how it's structured, and how to query it.
---

Every guard call produces an audit row. The row captures the request, the verdict, the detections, and the policy that was applied. This is the gateway's permanent record — the source of truth for compliance reviews, incident investigation, and dashboard charts.

## What a "threat" is

The term **threat** in the dashboard and the audit log refers to any non-`allow` verdict. `block`, `flag`, and `modify` are all threats; `allow` is not.

This is purely a UX convention — at the API level, an `allow` verdict is recorded the same way as a `block`. The [Threats page](../dashboard/threats-page.md) filters allows out for clarity.

## Audit row contents

A row stored against `manage.audit_entries` contains (live shape as returned by `GET /manage/audit`):

| Field | Notes |
|---|---|
| `id` | UUID of the audit row itself. Used to look up a single row via `GET /manage/audit/{id}` |
| `request_id` | UUIDv7 of the call. The correlation key surfaced in dashboards, logs, SIEM |
| `event_type` | `guard_request` for regular calls |
| `timestamp` | Server-side, UTC, millisecond precision |
| `api_key_id` | The `key_prefix` of the API key used (e.g. `semd_a3f0...`). Full secret never persisted |
| `policy_id` | The name of the policy used |
| `action` | `allow`, `flag`, `modify`, or `block` |
| `blocked` | (implied by `action == "block"`) |
| `risk_score` | The combined score, `[0, 1]` |
| `detections` | Array of `Detection` objects: `{category, confidence, description, rule_id}`. Currently empty on alpha builds (see [Verdict shapes](../reference/verdict-shapes.md)) |
| `message_count` | Number of messages in the request |
| `total_chars` | Total combined content length, in characters |
| `latency_ms` | Server-side latency of the call (mirrors the response's `processing_time_ms`) |
| `ruleset_version` | The rule revision in force when this call ran |
| `degraded` | `true` if part of the pipeline failed and the response was fail-open |
| `client_ip`, `user_agent` | Connection metadata |
| `app_id`, `user_id`, `session_id` | Optional caller-supplied trace identifiers |

The full request body is **not** persisted by default — only `message_count`, `total_chars`, and (when configured) a short snippet. To capture full bodies for compliance, enable `audit_full_body = true` on the policy (warning: storage cost). See [Reference → config.toml](../reference/config-toml.md).

## What's redacted

Even with full-body auditing on, the gateway redacts:

- Values from headers named `Authorization`, `Cookie`, `X-API-Key`.
- The `Set-Cookie` header in response paths.
- Any string that matches a PII rule, replaced with `[REDACTED]` markers.

These redactions happen before the row is written. They cannot be disabled — they are the privacy floor.

## Where the data lives

- **Postgres** — durable, queryable, indexed by `request_id`, `api_key_prefix`, `action`, `timestamp`.
- **WebSocket** — ephemeral fan-out, no persistence. Each event mirrors the audit row that was just written.

The two are kept consistent: the WebSocket event is published **after** the audit row commits. A subscriber that misses an event can re-query it via `GET /manage/audit?key_prefix=…&since=…`.

## Querying

Main entry points:

| Need | Use |
|---|---|
| Recent threats by action | `GET /manage/audit?action=block&limit=50` |
| Single audit row by `id` | `GET /manage/audit/{id}` (the row's UUID, **not** `request_id`) |
| Hourly volume buckets | `GET /manage/audit/stats/hourly` |
| All traffic for one key | `GET /manage/audit?key_prefix=semd_a3f0` |

The `since` and `until` parameters accept ISO-8601 timestamps. See [HTTP API → Management endpoints](../api/management-endpoints.md) for the full schema.

## Retention

Default retention is **90 days** for full-detail entries and **365 days** for hourly aggregates. Both are configured per policy (`audit_retention_days`, `aggregate_retention_days`). Older entries are purged by a background job that runs hourly.

For longer retention, mirror to your data warehouse via periodic `GET /manage/audit?since=<watermark>` queries.

## Related

- [The guard pipeline](the-guard-pipeline.md) — how the row gets written.
- [Threats page](../dashboard/threats-page.md) — the dashboard view.
- [How-to → Monitor production traffic](../guides/monitor-production-traffic.md) — using the data in alerting and dashboards.
- [HTTP API → Management endpoints](../api/management-endpoints.md) — the query surface.
