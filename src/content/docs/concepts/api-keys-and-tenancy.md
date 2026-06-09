---
title: API keys and tenancy
description: The auth model — keys, policy binding, rate limits, and tenant separation.
---

Every call to the gateway is authenticated with an API key. The key is the entry point to everything else: it identifies the caller, determines which policy applies, sets the rate limit, and attributes audit rows.

## What a key is

A key is a random 32-character secret with the prefix `ps_`:

```
ps_a3f0c8e1b2d97c4f6a8e2b1d3c5f7a9e
```

The full secret is shown once — at creation — and stored hashed in Postgres. Lost keys cannot be recovered, only rotated.

## How it's presented

The gateway accepts the key in either of two headers:

```
Authorization: Bearer ps_a3f0...
X-API-Key:     ps_a3f0...
```

Both are equivalent. The Python SDK uses `X-API-Key`. Most curl examples use `Authorization: Bearer` because it composes with existing tooling.

## Key → policy binding

Every key is bound to exactly one policy when it is created. The binding is the *only* way a policy affects a request: there is no way to override the policy per-call.

To change a key's policy, edit the key on the [Settings page](../dashboard/settings-page.md) or via `PATCH /manage/keys/{id}`.

Multiple keys can share a policy. This is the recommended pattern for multi-application deployments:

- One policy per **risk tier** (e.g. `default`, `strict`, `permissive-internal`).
- Many keys bound to each policy, one per calling application.

## Rate limits

Each key has a `rate_limit_rpm` (requests per minute). The limit is enforced per key, not per source IP. When exceeded:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 17
Content-Type: application/json

{ "error": "rate_limit_exceeded", "limit_rpm": 60 }
```

`Retry-After` is in seconds. SDK clients honour it automatically.

A limit of `0` means unlimited. Use unlimited only for keys whose calling application has its own rate limit.

## Audit attribution

Every audit row records the key prefix (`ps_a3f0…`, never the full secret) and the request metadata. This drives:

- The "Last used" column on the [Settings page](../dashboard/settings-page.md).
- Per-key filtering on `GET /manage/audit/entries?key_prefix=ps_a3f0`.
- Anomaly detection (e.g. a key suddenly producing 100× its baseline volume).

Disabled and revoked keys retain their audit history; rows are not purged when the key is revoked.

## Tenant separation

For multi-tenant deployments (one gateway, many customer apps), the recommended pattern is:

- One **policy** per tenant if their risk requirements differ.
- One **API key** per (tenant, application).
- Use the **name** field on the key to encode tenant ownership: `acme/support-bot`, `acme/agent-runner`, `globex/ingest`.

There is no enforced tenant boundary at the storage layer — audit data is global within the gateway instance. Tenant separation is operational, achieved via key naming and per-tenant queries.

For stronger isolation, run separate gateway instances per tenant with separate Postgres databases. See [Deployment → Docker Compose](../deployment/docker-compose.md) for the multi-instance pattern.

## What this model does not provide

- **End-user identity.** The gateway has no concept of "the human behind the request". If you need per-user verdicts, propagate user ID in the request body (e.g. as a `meta` field) and surface it in audit queries.
- **Role-based dashboard auth.** Dashboard operators currently authenticate with the same API key system. Role separation is on the roadmap.
- **OAuth / SAML / OIDC.** Not supported. Authentication is API key only.

## Related

- [HTTP API → Authentication](../api/authentication.md) — the wire-level reference.
- [Settings page](../dashboard/settings-page.md) — the operator UI.
- [How-to → Add and rotate API keys](../guides/add-and-rotate-api-keys.md) — the operational lifecycle.
