---
title: Authentication
description: How to authenticate REST and WebSocket calls.
---

All calls to the gateway require an API key. Two header forms are accepted; both are equivalent.

## Headers

```http
Authorization: Bearer ps_a3f0c8e1b2d97c4f6a8e2b1d3c5f7a9e
```

or

```http
X-API-Key: ps_a3f0c8e1b2d97c4f6a8e2b1d3c5f7a9e
```

The Python SDK uses `X-API-Key`. Most curl examples use `Authorization: Bearer`. There is no difference in semantics.

## Key shape

Keys are `ps_` followed by 32 random alphanumeric characters. They are case-sensitive. The full secret is shown only at creation — see the [Settings page](../dashboard/settings-page.md) for the lifecycle.

## Error responses

| Status | `error` value | Meaning |
|---|---|---|
| `401` | `missing_credentials` | No `Authorization` or `X-API-Key` header |
| `401` | `invalid_key` | Key does not match any registered secret |
| `401` | `expired` | Key was valid but its expiry has passed |
| `403` | `key_disabled` | Key is on file but disabled — see [Add and rotate API keys](../guides/add-and-rotate-api-keys.md) |
| `403` | `key_revoked` | Key is on file but permanently revoked |
| `429` | `rate_limit_exceeded` | Per-key rate limit exceeded; honour `Retry-After` |

All error responses are JSON:

```json
{ "error": "rate_limit_exceeded", "limit_rpm": 60 }
```

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
Authorization: Bearer ps_...
```

Browsers cannot set arbitrary headers on a WebSocket upgrade. For browser clients, the gateway also accepts the key as a query parameter:

```
wss://gateway.example.com/ws/events?api_key=ps_...
```

Query-parameter auth has the usual downside — keys may end up in proxy logs. Prefer header auth for non-browser clients.

## Related

- [Concepts → API keys and tenancy](../concepts/api-keys-and-tenancy.md) — the model behind keys.
- [Settings page](../dashboard/settings-page.md) — operator UI for managing keys.
- [Reference → API error codes](../reference/api-error-codes.md) — exhaustive error reference.
