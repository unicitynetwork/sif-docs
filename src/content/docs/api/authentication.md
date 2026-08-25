---
title: Authentication
description: How to authenticate REST and WebSocket calls.
---

All calls to the gateway require an API key. Two header forms are accepted; both are equivalent.

## Headers

```http
Authorization: Bearer semd_a3f0c8e1b2d97c4f6a8e2b1d3c5f7a9e
```

or

```http
X-API-Key: semd_a3f0c8e1b2d97c4f6a8e2b1d3c5f7a9e
```

The Python SDK uses `X-API-Key`. Most curl examples use `Authorization: Bearer`. There is no difference in semantics.

## Key shape

Keys are `semd_` followed by 32 random alphanumeric characters. They are case-sensitive. The full secret is shown only at creation — see [Fleet › Keys](../dashboard/fleet-keys.md) for the lifecycle.

## Error responses

Every `/api/v1/*` error is a flat JSON object with exactly two fields:

```json
{ "code": "Unauthorized", "message": "Invalid API key" }
```

`code` is PascalCase. The request id is returned on the `X-Request-Id`
response header, not in the body. See
[Reference → API error codes](../reference/api-error-codes.md) for the full
envelope and every code — including `/manage/*`, which uses a **different**
shape (`error`, not `code`, and `snake_case` values).

| Status | `code` | Cause |
|---|---|---|
| `401` | `Unauthorized` | No `Authorization` or `X-API-Key` header; or the key is unknown, disabled, revoked, or belongs to a suspended tenant |
| `401` | `ApiKeyExpired` | The key is valid and active but past its `expires_at` |
| `403` | `Forbidden` | The key authenticated but lacks the permission this endpoint needs (for example `guard`) |
| `429` | `RateLimited` | Per-key rate limit exceeded — honour the `Retry-After` header, in seconds |

### Why a disabled key looks exactly like a wrong one

There is deliberately **no distinct code for disabled, revoked, or
suspended-tenant keys.** All four cases — unknown secret, non-active
status, suspended tenant, and no credentials at all — return the same
`401 Unauthorized`. Only the `message` differs, and you should not parse it.

That is a security property, not an oversight: distinguishing "this key
does not exist" from "this key exists but is switched off" tells an
attacker which of their guesses are real keys. If you need to know why a
specific key stopped working, look it up in
[Fleet › Keys](../dashboard/fleet-keys.md) or the audit log — not from the
error the caller receives.

Expiry is the single exception, and only because a caller can act on it:
`ApiKeyExpired` tells a well-behaved client to go and rotate rather than
retry. It is only returned for a key that is otherwise valid and active.

## Dev mode

When the gateway is started with `--dev-mode`, authentication is bypassed entirely. All endpoints respond as if a permissive key with the `default` policy were in use. **For local development only.**

The dashboard surfaces a banner when the gateway is in dev mode.

## WebSocket

`/ws/events` uses the same header authentication as REST endpoints. Pass the key in the upgrade headers:

```http
GET /ws/events HTTP/1.1
Host: gateway.example.com
Upgrade: websocket
Connection: Upgrade
Authorization: Bearer semd_...
```

Browsers cannot set arbitrary headers on a WebSocket upgrade. For browser clients, the gateway also accepts the key as a query parameter:

```
wss://gateway.example.com/ws/events?api_key=semd_...
```

Query-parameter auth has the usual downside — keys may end up in proxy logs. Prefer header auth for non-browser clients.

## Related

- [Concepts → API keys and tenancy](../concepts/api-keys-and-tenancy.md) — the model behind keys.
- [Fleet › Keys](../dashboard/fleet-keys.md) — operator UI for managing keys.
- [Reference → API error codes](../reference/api-error-codes.md) — exhaustive error reference.
