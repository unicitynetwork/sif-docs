---
title: API keys and tenancy
description: The auth model — keys, policy binding, rate limits, and tenant separation.
---

Every call to the gateway is authenticated with an API key. The key is the entry point to everything else: it identifies the caller, determines which policy applies, sets the rate limit, and attributes audit rows.

## What a key is

A key is a random 32-character secret with the prefix `semd_live_`:

```
semd_live_a3f0c8e1b2d97c4f6a8e2b1d3c5f7a9e
```

The full secret is shown once — at creation, in the `api_key` field of the response — and stored hashed in Postgres. A lost secret cannot be recovered; the operator has to issue a new one, either in place with `POST /manage/api-keys/{id}/rotate` (same key record, new secret) or by minting a new key and revoking the old one — see [How-to → Add and rotate API keys](../guides/add-and-rotate-api-keys.md).

## How it's presented

The gateway accepts the key in either of two headers:

```
Authorization: Bearer semd_a3f0...
X-API-Key:     semd_a3f0...
```

Both are equivalent. The Python SDK uses `X-API-Key`. Most curl examples use `Authorization: Bearer` because it composes with existing tooling.

## Key → policy binding

Every key is bound to a policy in one of two ways, depending on whether the
key carries an **agent class**:

- **Class-led** — the key is bound to a class (`PUT /manage/api-keys/{id}/agent-class`,
  or the **Edit…** action on [Fleet › Keys](../dashboard/fleet-keys.md)). The
  class's policy is the only source. The key's own `policy_id` — set at
  creation or via `PATCH /manage/api-keys/{id}` — is **deprecated**: the
  column still exists and still holds whatever value it had, but it is no
  longer consulted for a classed key. Change the policy on the class instead
  (see [Fleet › Agents](../dashboard/fleet-agents.md)); every key bound to
  the class follows in one write.
- **Caller-led** — the key carries no class. Its own `policy_id` (or an
  explicit `policy_id` on the request, which wins) is what applies, falling
  back to the tenant default if neither is set.

See [Concepts → Policies](policies.md#how-a-requests-policy-is-chosen) for
the full resolution order and [Guard endpoint → Agent classes and
`policy_id`](../api/guard-endpoint.md#agent-classes-and-policy_id) for the
wire-level rule, including the rollout dial that phases this in without
breaking existing callers.

Multiple keys can share a policy, whether bound directly or through a shared
class. This is the recommended pattern for multi-application deployments:

- One policy per **risk tier** (e.g. `default`, `strict`, `permissive-internal`).
- Many keys bound to each policy or class, one per calling application.

## Rate limits

Each key has a `rate_limit_rpm` (requests per minute). The limit is enforced per key, not per source IP. When exceeded:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "code": "RateLimited",
  "message": "Rate limit exceeded"
}
```

No `Retry-After` header and no other field to key a backoff off of — retry
with your own. See [Reference → API error codes](../reference/api-error-codes.md).

A limit of `0` means unlimited. Use unlimited only for keys whose calling application has its own rate limit.

## Audit attribution

Every audit row records the key prefix (`semd_a3f0…`, never the full secret) and the request metadata. This drives:

- The "Last used" column on [Fleet › Keys](../dashboard/fleet-keys.md).
- Per-key filtering on `GET /manage/audit?key_prefix=semd_live_a3f0`.
- Anomaly detection (e.g. a key suddenly producing 100× its baseline volume).

Suspended and revoked keys retain their audit history; rows are not purged when the key is revoked.

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
- [Fleet › Keys](../dashboard/fleet-keys.md) — the operator UI.
- [Fleet › Agents](../dashboard/fleet-agents.md) — agent classes, the unit of policy for classed keys.
- [How-to → Add and rotate API keys](../guides/add-and-rotate-api-keys.md) — the operational lifecycle.
