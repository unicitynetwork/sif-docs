---
title: API error codes
description: Every error the HTTP API can return — envelope, codes, and cause.
---

Grounded in [`crates/semd-core/src/error.rs::ErrorCode`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-core/src/error.rs) (the enum) and [`crates/semd-api/src/error.rs::ApiError`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-api/src/error.rs) (the per-variant HTTP status mapping).

## Error envelope

Every error response from `/api/v1/*` and `/manage/*` shares the same JSON shape:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded for this API key.",
    "request_id": "019ed01f-…",
    "retry_after_ms": 17000
  }
}
```

| Field | Always present | Meaning |
|---|---|---|
| `error.code` | yes | One of the seven values below |
| `error.message` | yes | Human-readable explanation |
| `error.request_id` | yes | Correlate with the audit log |
| `error.retry_after_ms` | only on `RATE_LIMITED` | How many ms to wait before retrying |

Two optional top-level fields appear only in specific cases:

| Field | When | Meaning |
|---|---|---|
| `action` | Fail-open responses | The gateway hit an internal error but chose to let the caller proceed. Value is `"allow"`. |
| `degraded` | Pipeline partial failure | `true` when part of the detection pipeline failed and the response is best-effort. |

Example of a fail-open error (typically returned with HTTP 200, **not** an HTTP error):

```json
{
  "error": { "code": "INTERNAL_ERROR", "message": "Detector inference failed", "request_id": "019ed01f-…" },
  "action": "allow",
  "degraded": true
}
```

## The seven error codes

Wire format is `SCREAMING_SNAKE_CASE`. Every error in every endpoint resolves to one of these:

| `error.code` | HTTP status | What it means | Typical fix |
|---|---|---|---|
| `INVALID_REQUEST` | `400` | Body malformed, required field missing, query parameter invalid, **or** resource not found (the API collapses 404s into `INVALID_REQUEST`) | Inspect `error.message`; fix the request |
| `UNAUTHORIZED` | `401` | No `Authorization` / `X-API-Key` header, or the supplied key did not validate | Mint or rotate the key — see [Add and rotate API keys](../guides/add-and-rotate-api-keys.md) |
| `FORBIDDEN` | `403` | Authenticated but not permitted (e.g. management endpoint called with a guard-only key) | Use a key / JWT with the right scope |
| `RATE_LIMITED` | `429` | Per-key rate limit exceeded | Honour `error.retry_after_ms`; raise the key's `rate_limit_rpm` if persistent |
| `PAYLOAD_TOO_LARGE` | `413` | Body size exceeds `server.request_body_limit` | Send smaller messages or raise the limit ([Reference → config.toml](config-toml.md)) |
| `INTERNAL_ERROR` | `500` | Unhandled exception, detector failure, or generic server-side error | Check the gateway logs; the `request_id` correlates with `tracing` output |
| `SERVICE_UNAVAILABLE` | `503` | Dependency (Postgres / Redis / model) unreachable, or the gateway is shutting down | Retry with backoff; check dependency health |

> The `ApiError` enum in `semd-api` distinguishes more cases internally (e.g. `BadRequest` vs `NotFound`, `Timeout` vs `Unavailable`), but the wire layer maps them all into the seven codes above via [`ApiError::error_code()`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-api/src/error.rs).

## Rate-limit response in detail

When a key exceeds `rate_limit_rpm`:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded for this API key.",
    "request_id": "019ed01f-…",
    "retry_after_ms": 17000
  }
}
```

`retry_after_ms` is in milliseconds. The standard HTTP `Retry-After` header may or may not be set; trust `error.retry_after_ms` first. SDK clients honour it automatically.

## WebSocket close codes

The streaming connection uses standard WebSocket close codes — these are not part of the JSON error envelope.

| Code | Meaning | Action |
|---|---|---|
| `1000` | Normal closure | None |
| `1009` | Message too big — server buffered too far ahead of a slow consumer | Reconnect; consume faster, or poll `/manage/audit` instead |
| `1011` | Server error on the broadcast side | Check gateway logs; reconnect |

Other 1xxx codes follow the WebSocket spec. The gateway does **not** issue custom 4xxx close codes today; auth failures happen during the HTTP upgrade and return 401 there.

## What is **not** in this catalogue

- No `not_ready`, `pipeline_timeout`, `redis_unreachable`, `postgres_unreachable` distinct error codes — all of those collapse to `INTERNAL_ERROR` or `SERVICE_UNAVAILABLE` on the wire, with the distinguishing detail in `error.message`.
- No `key_disabled` / `key_revoked` distinction — both surface as `UNAUTHORIZED` with a more specific message.
- No 404 `*_not_found` codes — the gateway returns 404 but the wire `error.code` is `INVALID_REQUEST`. Read `error.message` to know which resource.
- No 409 `policy_in_use` / `duplicate_name` codes — current behaviour collapses to `INVALID_REQUEST`.

These distinctions may be added (existing codes won't be renamed). Current alpha behaviour matches the table above.

## Stability promise

The seven `code` values are stable for the alpha. New codes may be added; existing codes will not be renamed or repurposed. Message strings are **not** stable — parse on `code`, surface `message` for humans.

## Related

- [HTTP API → Authentication](../api/authentication.md) — auth-error context.
- [Operations → Troubleshooting](../operations/troubleshooting.md) — runbook for 5xx responses.
- [HTTP API → Guard endpoint](../api/guard-endpoint.md) — request-validation errors.
