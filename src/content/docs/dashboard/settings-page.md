---
title: Settings page
description: Create, rotate, and revoke API keys.
---

The Settings page (`/settings`) is the API-key admin surface. Every request to `/api/v1/guard` must carry an API key, and every key is bound to a policy.

## What you see

### Key table

Backed by `GET /manage/keys`.

| Column | Meaning |
|---|---|
| **Name** | Operator-defined label (e.g. `support-bot-prod`) |
| **Key prefix** | The first 8 characters of the key (e.g. `semd_a3f0…`) — full key is only shown at creation |
| **Status** | `active`, `disabled`, or `revoked` |
| **Rate limit (rpm)** | Requests per minute allowed for this key |
| **Policy** | Which policy this key is bound to |
| **Created** | When the key was issued |
| **Last used** | Time of the most recent guard call (or `—` if never used) |

### Create-key form

| Field | Notes |
|---|---|
| **Name** | Free text. Use a stable label — it appears in audit rows and rate-limit alerts |
| **Policy** | Drop-down of existing policies. Use `default` if unsure |
| **Rate limit (rpm)** | Integer. `0` means unlimited |
| **Expiry** | Optional. After this date the key returns `401 expired` |

On submit the form POSTs `POST /manage/keys`. The full secret is shown once — on this screen — and never again. Copy it now or rotate the key later.

### Per-key actions

- **Rotate** — issue a new secret with the same name, policy, and rate limit; revoke the old secret after a 24-hour overlap window so callers can migrate without downtime.
- **Disable** — keep the key on file but reject all requests with `403 key disabled`. Useful for incident response.
- **Revoke** — permanently invalidate the key. The row stays in the audit history but the secret is destroyed.

## What this page does not do

User management — adding dashboard operators, role assignments — is not on this page. The backend supports it; the surface is on the roadmap. See [Operations → Auth and secrets](../operations/auth-and-secrets.md) for the current control path.

## Related pages

- [Policies page](policies-page.md) — every key is bound to exactly one policy; change verdict behaviour there, not here.
- [How-to → Add and rotate API keys](../guides/add-and-rotate-api-keys.md) — the operational recipe.
- [HTTP API → Authentication](../api/authentication.md) — header format, error codes.
