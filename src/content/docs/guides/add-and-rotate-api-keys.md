---
title: Add and rotate API keys
description: Operational lifecycle for the credentials your applications use.
---

Every call to `/api/v1/guard` carries an API key. This page is the operator-side recipe for creating, rotating, and revoking them.

## Create a key

1. Open [Fleet › Keys](../dashboard/fleet-keys.md).
2. Click **Create key** and fill in:
   - **Name** — a stable label. It appears in audit rows and rate-limit alerts. Use something like `support-bot-prod`, `eng-experiments`, `incident-bot`.
   - **Rate limit (rpm)** — requests per minute. `0` means unlimited. Start with a low value (60 rpm) for a new key; raise it once the calling app's traffic shape is known.
   - **Expiry** — optional. Set it for short-lived integrations (e.g. a 7-day demo key) so the credential auto-revokes.
3. Submit. The full secret is shown **once** on the success screen. Copy it now — it will never be shown again.

**There is no policy field on this form, and there must not be one.** A key
carries no policy of its own. Put the key in an agent class and the class picks
the policies ([Fleet › Agents](../dashboard/fleet-agents.md), or `PUT
/manage/api-keys/{id}/agent-class`); leave it in none and it is caller-led, so
every call must name a `policy_id`. See [Guardrails ›
Policies](../dashboard/guardrails-policies.md) for what a policy holds.

A key looks like `semd_live_<32 random characters>`. It is presented to the gateway in either of two headers:

```
Authorization: Bearer semd_live_a3f0...
```

or

```
X-API-Key: semd_live_a3f0...
```

The two are equivalent. The Python SDK uses `X-API-Key`.

## Rotate a key

`POST /manage/api-keys/{id}/rotate` (`crates/semd-manage/src/router.rs`)
issues a new secret for the same logical key in one call. It carries the
old key's `name`, rate limit, `metadata` and **class membership** forward
onto a new row, and keeps the **old** secret working
for a grace period (`grace_period_seconds`, default `3600` seconds / 1
hour, max 30 days; `0` means immediate cutover) before that old row's own
`expires_at` catches up and it stops authenticating.

```bash
curl -X POST https://sif.unicity.network/manage/api-keys/b93f228d-23ae-45cb-a39b-490000889aea/rotate \
  -H "Authorization: Bearer semd_admin_key" \
  -H "Content-Type: application/json" \
  -d '{"grace_period_seconds": 3600}'
```

Response — the new secret, shown once, plus when the old one stops working:

```json
{
  "id": "c04a339e-34bf-56dc-b4ac-5a1111990bfb",
  "api_key": "semd_b4a1d9f2c3e08d5g7b9f3c2e4d6g8b0f",
  "key_prefix": "semd_b4a1d9f2",
  "name": "support-bot-prod",
  "created_at": "2026-08-24T18:42:10.123Z",
  "rotated_from": "b93f228d-23ae-45cb-a39b-490000889aea",
  "old_key_expires_at": "2026-08-24T19:42:10.123Z"
}
```

Deploy the new `api_key` before `old_key_expires_at`; both secrets
authenticate until then.

**A key holds no policy of its own**, so there is no policy binding for
rotation to carry: what decides the policies is the agent classes the key is
in. Rotation preserves that membership, and therefore the policies that follow
from it — a class-led key stays class-led, resolving the same policies, and a
caller-led key stays caller-led. Rotating is not a way to change which policy
applies; to do that, change the key's classes
(`PUT`/`DELETE /manage/api-keys/{id}/agent-class`) or the policies the class
attaches (`PATCH /manage/registry/classes/{*slug}`).

### Watching traffic move over before cutting the old key off

`/rotate`'s grace period is a fixed timer set at rotation time. If you'd
rather confirm the new key is actually in use before the old one stops
working — an open-ended wait, not a timer — use the manual pattern
instead:

1. **Mint a new key** with the same `name` and agent class as the old one — via [Fleet › Keys](../dashboard/fleet-keys.md) or `POST /manage/api-keys`. Copy the secret from the success-screen `api_key` field.
2. **Deploy the new secret** into your application's secret store. Both old and new keys are now valid simultaneously — the audit log records which was used per request.
3. **Verify the new key is in use** by filtering audit by `key_prefix`. Once the old key has gone quiet for one full request cycle, move on.
4. **Revoke the old key** via the dashboard or `POST /manage/api-keys/{id}/revoke`. The audit history is retained; only the secret is invalidated.

There is no hard limit on how long both keys can coexist this way — the overlap window is whatever your deploy cadence requires.

## Suspend vs. revoke

The live API uses **suspend** (reversible) and **revoke** (permanent). There is no `/disable` endpoint.

- **Suspend** (`POST /manage/api-keys/{id}/suspend`) — reject all requests with `403`. Reversible via `POST /manage/api-keys/{id}/reactivate`. Use this for incident response, paused integrations, or anything you might want to bring back.
- **Revoke** (`POST /manage/api-keys/{id}/revoke`) — permanently invalidate. The row stays in the audit history but the secret is destroyed. Not reversible.

Rule of thumb: suspend first, revoke later, once you're certain the key isn't needed.

## Rate-limit response

When a key exceeds its rate limit, `/api/v1/guard` returns:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "code": "RateLimited",
  "message": "Rate limit exceeded"
}
```

No `Retry-After` header, no `retry_after_ms`, no `limit_rpm` — there is
nothing else in this response to key a backoff off of. Retry with your own
backoff. See [Reference → API error codes](../reference/api-error-codes.md).

## Audit the key usage

Every guard call is recorded against the key that authenticated it. Query the audit endpoints (or [Activity › Audit](../dashboard/activity-audit.md), which filters by API key) to see what a given key has been used for.

Useful queries:

| Question | How |
|---|---|
| "Who's calling with this key?" | Audit entries include the caller IP and user-agent |
| "What policies has this key produced verdicts under?" | The `policy_applied` field on each verdict |
| "Is this key being abused?" | Rate-limit-exceeded events surface as their own audit category |

## Related

- [Fleet › Keys](../dashboard/fleet-keys.md) — the editing surface.
- [HTTP API → Authentication](../api/authentication.md) — header format and error codes.
- [Operations → Auth and secrets](../operations/auth-and-secrets.md) — where the encrypted key store lives in production.
