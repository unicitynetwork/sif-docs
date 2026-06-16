---
title: Management endpoints (beta)
description: The /manage/* API for rules, policies, detectors, keys, and audit.
---

> **Status: beta.** Used by the dashboard and by operator scripts. Shapes may evolve before 1.0.

:::caution[Admin scope required]
The `/manage/*` endpoints are the operator/SRE surface. During the hosted alpha, the API keys issued to design partners do **not** grant the `manage` scope — these calls will return `403 forbidden`. Use the [dashboard](../dashboard/settings-page.md) for the equivalent workflows, or wait for post-alpha self-hosting where you control scope.
:::

The `/manage/*` family is the admin surface — read and write the gateway's configuration, read the audit log. **The management API runs on a separate port** from the guard API (default `SEMANTICD_PORT + 1` — see [Health and status](health-and-status.md) for the three-port architecture). All non-auth endpoints require a JWT obtained from `/manage/auth/login`.

Grounded in [`crates/semd-manage/src/router.rs`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-manage/src/router.rs).

## Auth

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/manage/auth/login` | Exchange `{username, password}` for a 24 h JWT |
| `GET` | `/manage/auth/me` | Current user (requires JWT) |

```bash
curl -X POST https://<manage-host>/manage/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<your_password>"}'
```

Response:

```json
{
  "token": "<JWT>",
  "user": {"id": "<uuid>", "username": "admin", "email": "admin@localhost", "role": "admin"},
  "expires_at": "<ISO-8601>"
}
```

Send `Authorization: Bearer <token>` on every subsequent management call.

## Rulesets and rules

Rules don't live at the top level of `/manage/*` — they belong to a **ruleset**.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/rulesets` | List all rulesets |
| `POST` | `/manage/rulesets` | Create a ruleset |
| `GET` | `/manage/rulesets/{id}` | Get a ruleset |
| `PATCH` | `/manage/rulesets/{id}` | Update ruleset metadata |
| `DELETE` | `/manage/rulesets/{id}` | Delete a ruleset |
| `GET` | `/manage/rulesets/{ruleset_id}/rules` | List rules in a ruleset |
| `POST` | `/manage/rulesets/{ruleset_id}/rules` | Add a rule to a ruleset |
| `GET` | `/manage/rules/{id}` | Get a rule directly by ID |
| `PATCH` | `/manage/rules/{id}` | Update a rule |
| `DELETE` | `/manage/rules/{id}` | Delete a rule |
| `GET` | `/manage/rules/stats` | Aggregate rule statistics |

## Policies

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/policies` | List all policies |
| `POST` | `/manage/policies` | Create a new policy |
| `GET` | `/manage/policies/{id}` | Get one policy |
| `PATCH` | `/manage/policies/{id}` | Update a policy |
| `DELETE` | `/manage/policies/{id}` | Remove a policy |
| `POST` | `/manage/policies/{id}/set-default` | Mark a policy as the default for unbound keys |

Policy shape matches [Concepts → Policies](../concepts/policies.md).

## Detectors and models

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/detectors` | List currently-loaded pattern detectors (non-ML) |
| `GET` | `/manage/models` | List loaded ML models |

There is **no** reload / unload endpoint on the live router.

## API keys

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/api-keys` | List keys (secrets are never returned) |
| `POST` | `/manage/api-keys` | Create a new key. The secret is returned **only** in this response |
| `GET` | `/manage/api-keys/stats` | Aggregate key statistics |
| `GET` | `/manage/api-keys/{id}` | Get one key's metadata |
| `PATCH` | `/manage/api-keys/{id}` | Update name, policy binding, rate limit, expiry, etc. |
| `DELETE` | `/manage/api-keys/{id}` | Delete the key row |
| `POST` | `/manage/api-keys/{id}/revoke` | Permanently invalidate (audit history retained) |
| `POST` | `/manage/api-keys/{id}/suspend` | Suspend — reject future requests, reversible |
| `POST` | `/manage/api-keys/{id}/reactivate` | Re-enable a suspended key |

> There is **no** `/rotate` or `/disable` endpoint on the live router. To rotate, mint a new key with the same `name` + `policy_id`, deploy it, then `/revoke` the old one. "Suspend" is what other systems would call "disable" — reversible, audit-preserving.

```bash
curl -X POST https://sif.unicity.network/manage/api-keys \
  -H "Authorization: Bearer semd_admin_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "support-bot-prod"
  }'
```

Response (the only place the full secret appears):

```json
{
  "id": "b93f228d-23ae-45cb-a39b-490000889aea",
  "api_key": "semd_a3f0c8e1b2d97c4f6a8e2b1d3c5f7a9e",
  "key_prefix": "semd_a3f0c8e1",
  "name": "support-bot-prod",
  "created_at": "2026-06-07T18:42:10.123Z"
}
```

The full secret is the `api_key` field; `key_prefix` is the abbreviated form shown in lists, audit rows, and the dashboard. Policy binding, rate limit, expiry, and status default to the policy/key tenancy defaults and can be set with a follow-up `PATCH /manage/api-keys/{id}`. Optional create fields: `tier`, `rate_limit_rpm`, `policy_id`, `app_id`, `metadata`, `expires_at`.

## Users

A complete user-management surface (used by the dashboard for operator accounts). All require an admin JWT.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/users` | List users |
| `POST` | `/manage/users` | Create a user |
| `GET` | `/manage/users/stats` | Aggregate user stats |
| `GET` | `/manage/users/{id}` | Get a user |
| `PATCH` | `/manage/users/{id}` | Update a user |
| `DELETE` | `/manage/users/{id}` | Delete a user |
| `POST` | `/manage/users/{id}/change-password` | Set a new password |
| `POST` | `/manage/users/{id}/activate` | Reactivate a deactivated user |
| `POST` | `/manage/users/{id}/deactivate` | Deactivate — block login, retain history |

## Audit

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/audit` | List audit rows |
| `GET` | `/manage/audit/{id}` | Single audit row by internal `id` (UUID, **not** `request_id`) |
| `GET` | `/manage/audit/by-request/{request_id}` | Single audit row by `request_id` |
| `GET` | `/manage/audit/stats` | Aggregate audit stats |
| `GET` | `/manage/audit/stats/hourly` | Hourly bucket counts |
| `POST` | `/manage/audit/cleanup` | Purge old audit rows per retention policy |

Query parameters for `/manage/audit`:

| Parameter | Type | Notes |
|---|---|---|
| `action` | string | Filter by verdict action: `allow`, `block`, `flag`, `modify` |
| `key_prefix` | string | Filter by API key (the prefix shown in the dashboard) |
| `policy` | string | Filter by `policy_id` |
| `category` | string | Filter to rows with at least one detection in this category |
| `since` | ISO-8601 | Lower bound on timestamp |
| `until` | ISO-8601 | Upper bound on timestamp |
| `limit` | integer | 1–500. Default 50 |

Response:

```json
{
  "data": [ { /* audit row */ } ]
}
```

Audit row fields: `id`, `request_id`, `event_type`, `action`, `message_count`, `total_chars`, `latency_ms`, `risk_score`, `policy_id`, `api_key_id` (the `key_prefix`), `app_id`, `user_id`, `session_id`, `detections`, `degraded`, `client_ip`, `user_agent`, `ruleset_version`, `timestamp`.

## Stats

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/manage/stats/reset` | Reset in-memory counters across the management API. Affects `/status`-style metrics, not persisted audit history. |

## Errors

| Status | When |
|---|---|
| `400` | Invalid query parameters or request body |
| `401`/`403` | Auth — see [Authentication](authentication.md) |
| `404` | Resource not found |
| `409` | Conflict — e.g. deleting a policy still bound to keys |
| `429` | Rate limit |

## Related

- [Concepts → Rules](../concepts/rules.md), [Policies](../concepts/policies.md), [API keys](../concepts/api-keys-and-tenancy.md), [Threats and verdicts](../concepts/threats-and-verdicts.md) — the data model behind these endpoints.
- [Settings page](../dashboard/settings-page.md), [Policies page](../dashboard/policies-page.md), [Rules page](../dashboard/rules-page.md) — the dashboard UI on top of these endpoints.
