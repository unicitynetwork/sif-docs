---
title: API error codes
description: Every error the HTTP API can return — cause and fix.
---

Every error response is JSON with an `error` field and optional context fields. Status codes follow HTTP conventions; the `error` string is the stable, machine-readable identifier.

```json
{ "error": "rate_limit_exceeded", "limit_rpm": 60 }
```

## Authentication errors (4xx)

| Status | `error` | Cause | Fix |
|---|---|---|---|
| `401` | `missing_credentials` | No `Authorization` / `X-API-Key` header | Add the header |
| `401` | `invalid_key` | Key does not match any registered secret | Re-issue the key |
| `401` | `expired` | Key was valid but past its expiry | Rotate via [Settings](../dashboard/settings-page.md) |
| `403` | `key_disabled` | Key is on file but disabled | Re-enable from [Settings](../dashboard/settings-page.md) |
| `403` | `key_revoked` | Key was revoked | Issue a new key |
| `403` | `insufficient_scope` | Key's policy does not grant the required scope (e.g. `manage` on `/manage/*`) | Use a key whose policy includes the scope |
| `429` | `rate_limit_exceeded` | Per-key rate limit exceeded | Wait per `Retry-After` header; raise the key's `rate_limit_rpm` if persistent |

## Request validation (4xx)

| Status | `error` | Cause | Fix |
|---|---|---|---|
| `400` | `invalid_messages` | `messages` missing, empty, or malformed | Send at least one message with `role` and `content` |
| `400` | `invalid_role` | Message `role` is not `system`/`user`/`assistant` | Use a recognised role |
| `400` | `too_many_messages` | Message count exceeds policy `max_messages` | Truncate the message list |
| `400` | `invalid_batch` | Batch `items` missing, empty, or > 100 | Send 1–100 items |
| `400` | `invalid_item` | A batch item is malformed | Fix the offending item; the batch is rejected as a whole |
| `400` | `invalid_policy` | `config.policy` references a non-existent policy | Use an existing policy name |
| `400` | `invalid_query` | Management endpoint received bad query parameters | See [Management endpoints](../api/management-endpoints.md) |
| `413` | `payload_too_large` | Total body size exceeds `request_body_max_bytes` | Send smaller messages or raise the limit |

## Server errors (5xx)

| Status | `error` | Cause | Fix |
|---|---|---|---|
| `500` | `internal_error` | Unhandled exception in the gateway | Check the gateway logs |
| `502` | `redis_unreachable` | Redis connection failed mid-request | Restart Redis; check the network |
| `503` | `not_ready` | Gateway started but not yet ready (rules still loading) | Wait; retry |
| `503` | `pipeline_timeout` | Detection pipeline exceeded `global_timeout_ms` | See [Troubleshooting](../operations/troubleshooting.md) |
| `503` | `degraded` | Required detector degraded and policy `fail_mode = block` | See [Troubleshooting](../operations/troubleshooting.md) |
| `503` | `postgres_unreachable` | Database connection failed | Check database health |

## Management-specific (4xx)

| Status | `error` | Endpoint | Cause |
|---|---|---|---|
| `404` | `rule_not_found` | `/manage/rules/{id}` | No rule with that ID |
| `404` | `policy_not_found` | `/manage/policies/{name}` | No policy with that name |
| `404` | `key_not_found` | `/manage/keys/{id}` | No key with that ID |
| `409` | `policy_in_use` | `DELETE /manage/policies/{name}` | At least one API key still references the policy |
| `409` | `duplicate_name` | `POST /manage/policies` or `/manage/keys` | A resource with that name already exists |
| `422` | `rule_parse_error` | `POST /manage/rules` | Uploaded rule failed to parse |

## WebSocket close codes

| Code | Meaning | Action |
|---|---|---|
| `1000` | Normal close | None |
| `1008` | Policy violation (invalid query parameters) | Fix the URL |
| `1009` | Message too big (backpressure) | Reconnect; consume faster, or use audit-poll instead |
| `1011` | Server error | Check gateway logs; reconnect |
| `4001` | Auth failed | Check the API key in the upgrade headers |
| `4029` | Rate limited | Honour the implicit backoff; reconnect after some seconds |

## Stability promise

The `error` strings above are stable. New error values may be added; existing values will not be renamed or repurposed without a deprecation window.

## Related

- [HTTP API → Authentication](../api/authentication.md) — auth-error context.
- [Operations → Troubleshooting](../operations/troubleshooting.md) — runbook for `5xx` responses.
- [HTTP API → Guard endpoint](../api/guard-endpoint.md) — request-validation errors.
