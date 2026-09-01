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

Every key gets its policies in one of two ways, depending on whether the
key carries an **agent class**:

- **Class-led** — the key is bound to a class (`PUT /manage/api-keys/{id}/agent-class`,
  or the **Edit…** action on [Fleet › Keys](../dashboard/fleet-keys.md)). The
  policies its classes attach are the only source — any number of them, and
  possibly none, in which case nothing is checked. The key holds no
  `policy_id` of its own: migration `120260828231927` dropped the column.
  Change the policies on the class instead
  (see [Fleet › Agents](../dashboard/fleet-agents.md)); every key bound to
  the class follows in one write.
- **Caller-led** — the key carries no class. The `policy_id` on the request is
  what applies, falling back to the tenant default only where the tenant's
  enforcement setting still allows it.

See [Concepts → Policies](policies.md#how-a-requests-policy-is-chosen) for
the full resolution order and [Guard endpoint → Agent classes and
`policy_id`](../api/guard-endpoint.md#agent-classes-and-policy_id) for the
wire-level rule, including the rollout dial — which ships at `block` since
migration 036, so the refusals are live unless a tenant moves it back.

Multiple keys can share a policy, whether through a shared class or by naming
it on the request. This is the recommended pattern for multi-application
deployments:

- One policy per **risk tier** (e.g. `default`, `strict`, `permissive-internal`).
- Many keys in each class, one per calling application.

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
- Per-key filtering on `GET /manage/audit?api_key_id=semd_live_a3f0` — the audit row's `api_key_id` *is* that prefix.
- Anomaly detection (e.g. a key suddenly producing 100× its baseline volume).

Suspended and revoked keys retain their audit history; rows are not purged when the key is revoked.

## Tenant separation

A tenant is a row in `tenants`, and every tenant-owned table carries a
`tenant_id`. Key, policy, ruleset, rule, agent class, audit row, receipt and
captured payload all belong to exactly one tenant.

### The boundary is in the database

Postgres row-level security enforces it, not application code. Every
tenant-owned table has `FORCE ROW LEVEL SECURITY` and a policy keyed on the
`app.tenant_id` setting the gateway sets per connection.

Three consequences worth knowing:

- **A forgotten `WHERE tenant_id = …` returns nothing, not somebody else's
  rows.** With no tenant set, every such table reads as empty and refuses
  every write. That is the point: the failure mode of a missing filter is a
  blank screen, not a leak.
- **`FORCE` includes the table owner.** The application role cannot read past
  its own tenant even though it owns the schema.
- **Shipped content is the one exception, and it is deliberate.** Built-in
  rulesets, rules and their revision snapshots carry `tenant_id IS NULL` and
  are readable by every tenant — they are content we ship, not anyone's data.

### What is still yours to get right

- One **API key** per (tenant, application), so a compromised credential is
  bounded.
- Use the key's **name** to say what it is for: `support-bot`,
  `agent-runner`. The tenant is a column now, so it does not belong in the
  name.
- Separate gateway instances with separate databases remain the strongest
  isolation available, and are the right answer where a shared database is
  unacceptable regardless of what enforces the boundary inside it. See
  [Deployment → Docker Compose](../deployment/docker-compose.md).

## What this model does not provide

- **End-user identity.** The gateway has no concept of "the human behind the request". If you need per-user verdicts, propagate user ID in the request body (e.g. as a `meta` field) and surface it in audit queries.
- **Role-based dashboard auth.** Dashboard operators currently authenticate with the same API key system. Role separation is on the roadmap.
- **OAuth / SAML / OIDC.** Not supported. Authentication is API key only.

## Related

- [HTTP API → Authentication](../api/authentication.md) — the wire-level reference.
- [Fleet › Keys](../dashboard/fleet-keys.md) — the operator UI.
- [Fleet › Agents](../dashboard/fleet-agents.md) — agent classes, the unit of policy for classed keys.
- [How-to → Add and rotate API keys](../guides/add-and-rotate-api-keys.md) — the operational lifecycle.
