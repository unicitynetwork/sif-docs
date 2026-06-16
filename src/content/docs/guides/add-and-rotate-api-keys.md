---
title: Add and rotate API keys
description: Operational lifecycle for the credentials your applications use.
---

Every call to `/api/v1/guard` carries an API key. This page is the operator-side recipe for creating, rotating, and revoking them.

## Create a key

1. Open the [Settings page](../dashboard/settings-page.md).
2. Click **Create key** and fill in:
   - **Name** — a stable label. It appears in audit rows and rate-limit alerts. Use something like `support-bot-prod`, `eng-experiments`, `incident-bot`.
   - **Policy** — which [policy](../dashboard/policies-page.md) governs the verdict thresholds. Use `default` unless you have a reason not to.
   - **Rate limit (rpm)** — requests per minute. `0` means unlimited. Start with a low value (60 rpm) for a new key; raise it once the calling app's traffic shape is known.
   - **Expiry** — optional. Set it for short-lived integrations (e.g. a 7-day demo key) so the credential auto-revokes.
3. Submit. The full secret is shown **once** on the success screen. Copy it now — it will never be shown again.

A key looks like `semd_live_<32 random characters>`. It is presented to the gateway in either of two headers:

```
Authorization: Bearer semd_live_a3f0...
```

or

```
X-API-Key: semd_live_a3f0...
```

The two are equivalent. The Python SDK uses `X-API-Key`.

## Rotate a key (mint-and-revoke pattern)

There is **no in-place `/rotate` endpoint** on the live router (the page title is historical; the operation is a documented pattern, not an API call). To rotate:

1. **Mint a new key** with the same `name` and `policy_id` as the old one — via the [Settings page](../dashboard/settings-page.md) or `POST /manage/api-keys`. Copy the secret from the success-screen `api_key` field.
2. **Deploy the new secret** into your application's secret store. Both old and new keys are now valid simultaneously — the audit log records which was used per request.
3. **Verify the new key is in use** by filtering audit by `key_prefix`. Once the old key has gone quiet for one full request cycle, move on.
4. **Revoke the old key** via the dashboard or `POST /manage/api-keys/{id}/revoke`. The audit history is retained; only the secret is invalidated.

There is no hard limit on how long both keys can coexist — the overlap window is whatever your deploy cadence requires.

## Suspend vs. revoke

The live API uses **suspend** (reversible) and **revoke** (permanent). There is no `/disable` endpoint.

- **Suspend** (`POST /manage/api-keys/{id}/suspend`) — reject all requests with `403`. Reversible via `POST /manage/api-keys/{id}/reactivate`. Use this for incident response, paused integrations, or anything you might want to bring back.
- **Revoke** (`POST /manage/api-keys/{id}/revoke`) — permanently invalidate. The row stays in the audit history but the secret is destroyed. Not reversible.

Rule of thumb: suspend first, revoke later, once you're certain the key isn't needed.

## Rate-limit response

When a key exceeds its rate limit:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 17
Content-Type: application/json

{ "error": "rate_limit_exceeded", "limit_rpm": 60 }
```

The `Retry-After` header is in seconds. SDK clients honour it automatically; bare HTTP clients should back off and retry. See [Reference → API error codes](../reference/api-error-codes.md).

## Audit the key usage

Every guard call is recorded against the key that authenticated it. Query the audit endpoints (or the [Threats page](../dashboard/threats-page.md)) by API key to see what a given key has been used for.

Useful queries:

| Question | How |
|---|---|
| "Who's calling with this key?" | Audit entries include the caller IP and user-agent |
| "What policies has this key produced verdicts under?" | The `policy_applied` field on each verdict |
| "Is this key being abused?" | Rate-limit-exceeded events surface as their own audit category |

## Related

- [Settings page](../dashboard/settings-page.md) — the editing surface.
- [HTTP API → Authentication](../api/authentication.md) — header format and error codes.
- [Operations → Auth and secrets](../operations/auth-and-secrets.md) — where the encrypted key store lives in production.
