---
title: API error codes
description: Every error the HTTP API can return — envelope, codes, and cause.
---

Grounded in [`crates/semd-core/src/error.rs::ErrorCode`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-core/src/error.rs) and [`crates/semd-api/src/error.rs::ApiError`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-api/src/error.rs) for `/api/v1/*`, and in [`crates/semd-manage/src/error.rs::ManageError`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-manage/src/error.rs) for `/manage/*`.

## Error envelope

There is no single shared envelope. `/api/v1/*` and `/manage/*` are two
independent crates with two independent error types, and the two land on
different wire shapes — both flat (neither wraps the body in an
`"error": {...}` object), but with different field names and different code
casing. Pick the right one for the endpoint you're calling.

### `/api/v1/*` — `ApiError` (semd-api)

```json
{
  "code": "RateLimited",
  "message": "Rate limit exceeded"
}
```

`code` is the `ErrorCode` variant's Rust name, produced via
`format!("{code:?}")` in `ErrorResponse::new` — **not** `ErrorCode`'s own
`SCREAMING_SNAKE_CASE` `Serialize` impl, which this path never calls. The
struct also has `request_id` and `details` fields, but no production
handler ever populates them (`with_request_id` / `with_details` are only
exercised by a unit test) — both are declared `skip_serializing_if =
"Option::is_none"`, so in practice they never appear on the wire. The
request id is on the `X-Request-Id` response header instead, not in the
body.

| Field | Always present | Meaning |
|---|---|---|
| `code` | yes | One of the eight `/api/v1/*` codes below, PascalCase |
| `message` | yes | Human-readable explanation |

### `/manage/*` — `ManageError` (semd-manage)

```json
{
  "error": "conflict",
  "message": "policy 'strict' already exists"
}
```

A different struct entirely: the code field is named `error`, not `code`,
and it holds a hand-written `snake_case` string
(`ManageError::error_code()`), not an enum's `Debug` name. There is no
`request_id` field on this struct at all.

| Field | Always present | Meaning |
|---|---|---|
| `error` | yes | One of the ten `/manage/*` codes below, `snake_case` |
| `message` | yes | Human-readable explanation |

## `/api/v1/*` error codes

Eight values, from `ErrorCode` via `ApiError::error_code()`:

| `code` | HTTP status | What it means | Typical fix |
|---|---|---|---|
| `InvalidRequest` | `400` | Body malformed, required field missing, query parameter invalid, **or** resource not found (this endpoint collapses 404s into `InvalidRequest`) | Inspect `message`; fix the request |
| `Unauthorized` | `401` | No `Authorization` / `X-API-Key` header, or the supplied key did not validate | Mint or rotate the key — see [Add and rotate API keys](../guides/add-and-rotate-api-keys.md) |
| `ApiKeyExpired` | `401` | The API key's `expires_at` has passed | Rotate or reissue the key |
| `Forbidden` | `403` | Authenticated but not permitted | Use a key with the right scope |
| `RateLimited` | `429` | Per-key rate limit exceeded | Raise the key's `rate_limit_rpm` if persistent — there is no `retry_after_ms` to key a backoff off; retry with your own |
| `PayloadTooLarge` | `413` | Body size exceeds `server.request_body_limit` | Send smaller messages or raise the limit ([Reference → config.toml](config-toml.md)) |
| `InternalError` | `500` | Unhandled exception, detector failure, or generic server-side error | Check the gateway logs; correlate with the `X-Request-Id` response header |
| `ServiceUnavailable` | `503` | Dependency (Postgres / Redis / model) unreachable, or the gateway is shutting down | Retry with backoff; check dependency health |

> The `ApiError` enum distinguishes more cases internally (e.g. `BadRequest` vs `NotFound`, `Timeout` vs `Unavailable`), but the wire layer maps them all into the eight codes above via [`ApiError::error_code()`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-api/src/error.rs).

## `/manage/*` error codes

Ten values, from `ManageError::error_code()` — a genuinely richer catalogue
than `/api/v1/*`'s, with a real `409 conflict` and a `502 bad_gateway` that
`/api/v1/*` has no equivalent for:

| `error` | HTTP status | What it means |
|---|---|---|
| `bad_request` | `400` | Malformed body or invalid JSON |
| `unauthorized` | `401` | No or invalid credential |
| `forbidden` | `403` | Authenticated but lacking the required capability |
| `not_found` | `404` | Resource doesn't exist |
| `conflict` | `409` | Resource already exists (duplicate name), or can't be deleted while in use |
| `validation_error` | `400` | Field-level validation failure |
| `database_error` | `500` | Underlying Postgres error |
| `internal_error` | `500` | Generic server-side error |
| `bad_gateway` | `502` | Upstream dependency unreachable or answered unusably |
| `service_unavailable` | `503` | Process not in a shape that can serve safely |

## Rate-limit response in detail

When a key exceeds `rate_limit_rpm` on `/api/v1/guard`:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "code": "RateLimited",
  "message": "Rate limit exceeded"
}
```

There is no `retry_after_ms` field and no `Retry-After` header —
`ApiError::RateLimited` carries no extra data, and the rate-limiter
middleware's own header-setting code runs only on the allowed path (the
limit-exceeded path returns before reaching it). Retry with your own
backoff. `/manage/*` has no rate limiting and no equivalent response.

## WebSocket close codes

`/manage/ws/events` (`crates/semd-manage/src/ws.rs`) is the one streaming
connection in the API; it uses standard WebSocket close codes, not the JSON
error envelope above. The server never sends a custom close code today: a
client disconnect or a `Close` frame from the client just ends the loop,
and a lagging client (falling behind the broadcast channel) is logged and
skipped, not disconnected. Expect ordinary `1000`/`1005` closures; do not
build logic around a specific non-default close code.

## What is **not** in this catalogue

For `/api/v1/*`:
- No `not_ready`, `pipeline_timeout`, `redis_unreachable`, `postgres_unreachable` distinct codes — all collapse to `InternalError` or `ServiceUnavailable`, with the distinguishing detail in `message`.
- No `key_disabled` / `key_revoked` distinction — both surface as `Unauthorized` with a more specific message.
- No 404 `*_not_found` code — the gateway returns HTTP 404 but the wire `code` is `InvalidRequest`. Read `message` to know which resource.
- No 409 conflict code — `ApiError` has no `Conflict` variant.

For `/manage/*`, a 409 `conflict` code genuinely exists (see above) — the
split into two tables above is exactly because the two subsystems disagree
on this and other cases.

These distinctions may be added (existing codes won't be renamed). Current
behaviour matches the tables above.

## Stability promise

The `/api/v1/*` `code` values (eight) and the `/manage/*` `error` values
(ten) are each stable within their own catalogue. New codes may be added to
either; existing codes will not be renamed or repurposed. Message strings
are **not** stable — parse on `code` / `error`, surface `message` for
humans.

## Related

- [HTTP API → Authentication](../api/authentication.md) — auth-error context.
- [Operations → Troubleshooting](../operations/troubleshooting.md) — runbook for 5xx responses.
- [HTTP API → Guard endpoint](../api/guard-endpoint.md) — request-validation errors.
