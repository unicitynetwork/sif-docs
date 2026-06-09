---
title: Threats and verdicts
description: What gets stored, how it's structured, and how to query it.
---

Every guard call produces an audit row. The row captures the request, the verdict, the detections, and the policy that was applied. This is the gateway's permanent record — the source of truth for compliance reviews, incident investigation, and dashboard charts.

## What a "threat" is

The term **threat** in the dashboard and the audit log refers to any non-`allow` verdict. `block`, `flag`, and `modify` are all threats; `allow` is not.

This is purely a UX convention — at the API level, an `allow` verdict is recorded the same way as a `block`. The [Threats page](../dashboard/threats-page.md) filters allows out for clarity.

## Audit row contents

A row stored against `manage.audit_entries` contains:

| Field | Notes |
|---|---|
| `request_id` | Unique per call. Surfaces in dashboards, logs, SIEM. The correlation key |
| `timestamp` | Server-side, UTC, millisecond precision |
| `api_key_prefix` | First 8 characters of the key. Full secret never persisted |
| `policy_applied` | The name of the policy used |
| `action` | `allow`, `flag`, `modify`, or `block` |
| `risk_score` | The combined score, `[0, 1]` |
| `detections` | JSONB array of `{category, confidence, rule_id, evidence, span}` |
| `message_count` | Number of messages in the request |
| `latency_ms` | Wall-clock latency of the guard call |
| `ruleset_version` | The rule revision in force when this call ran |
| `modified_messages` | Present only for `action = modify` |
| `error` | Non-null when a detector errored or timed out |

The full request body is **not** persisted by default — only `message_count` and an optional short snippet. To capture full bodies for compliance, enable `audit_full_body = true` on the policy (warning: storage cost). See [Reference → config.toml](../reference/config-toml.md).

## What's redacted

Even with full-body auditing on, the gateway redacts:

- Values from headers named `Authorization`, `Cookie`, `X-API-Key`.
- The `Set-Cookie` header in response paths.
- Any string that matches a PII rule, replaced with `[REDACTED]` markers.

These redactions happen before the row is written. They cannot be disabled — they are the privacy floor.

## Where the data lives

- **Postgres** — durable, queryable, indexed by `request_id`, `api_key_prefix`, `action`, `timestamp`.
- **WebSocket** — ephemeral fan-out, no persistence. Each event mirrors the audit row that was just written.

The two are kept consistent: the WebSocket event is published **after** the audit row commits. A subscriber that misses an event can re-query it via `GET /manage/audit/entries?request_id=…`.

## Querying

Main entry points:

| Need | Use |
|---|---|
| Recent threats by action | `GET /manage/audit/entries?action=block&page_size=50` |
| Single verdict by ID | `GET /manage/audit/entries?request_id=req_b7d4e9f2` |
| Hourly volume buckets | `GET /manage/audit/stats/hourly` |
| All traffic for one key | `GET /manage/audit/entries?key_prefix=ps_a3f0` |

The `since` and `until` parameters accept ISO-8601 timestamps. See [HTTP API → Management endpoints](../api/management-endpoints.md) for the full schema.

## Retention

Default retention is **90 days** for full-detail entries and **365 days** for hourly aggregates. Both are configured per policy (`audit_retention_days`, `aggregate_retention_days`). Older entries are purged by a background job that runs hourly.

For longer retention, mirror to your data warehouse via periodic `GET /manage/audit/entries?since=<watermark>` queries.

## Related

- [The guard pipeline](the-guard-pipeline.md) — how the row gets written.
- [Threats page](../dashboard/threats-page.md) — the dashboard view.
- [How-to → Monitor production traffic](../guides/monitor-production-traffic.md) — using the data in alerting and dashboards.
- [HTTP API → Management endpoints](../api/management-endpoints.md) — the query surface.
