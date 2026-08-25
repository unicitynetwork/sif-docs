---
title: Management endpoints (beta)
description: The /manage/* API for rules, policies, detectors, keys, audit, and notifications.
---

> **Status: beta.** Used by the dashboard and by operator scripts. Shapes may evolve before 1.0.

:::caution[Admin scope required]
The `/manage/*` endpoints are the operator/SRE surface. On the hosted instance, API keys issued to design partners do **not** grant the `manage` scope — these calls will return `403 forbidden`. Use [Fleet › Keys](../dashboard/fleet-keys.md) for the equivalent workflows, or self-host where you control scope.
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

## Agent classes and enforcement

The registry of **agent classes** — the unit of policy for classed keys (see
[Concepts → Policies](../concepts/policies.md) and [Fleet ›
Agents](../dashboard/fleet-agents.md)). Reads need `registry:read` (viewer+);
writes need `registry:write` (operator+).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/registry/classes` | List this tenant's agent classes |
| `POST` | `/manage/registry/classes` | Register a new class. `slug`, `display_name`, `policy_id` required |
| `GET` | `/manage/registry/classes/{slug}` | Get one class |
| `PATCH` | `/manage/registry/classes/{slug}` | Change display name, description, owner, tags, or the **policy** — the edit this registry exists for |
| `POST` | `/manage/registry/classes/{slug}/retire` | Retire the class |
| `GET` | `/manage/registry/enforcement` | Read the tenant's class-policy enforcement dial: `off`, `flag`, or `block` |
| `PUT` | `/manage/registry/enforcement` | Move the dial. Body: `{"enforcement": "off" \| "flag" \| "block"}` |
| `GET` | `/manage/registry/observed` | Agent classes seen in the audit log, registered or not, with call counts |

There is **no** `DELETE` on `/manage/registry/classes/{slug}`. A class
retires instead of being deleted, so `audit_log.agent_class` stays joinable
against a class that is no longer active; its policy binding is untouched by
retirement, so keys already bound to it keep resolving through that policy.

```bash
curl -X PATCH https://<manage-host>/manage/registry/classes/eng%2Fcode-reviewer \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"policy_id": "strict"}'
```

See [Guard endpoint → Agent classes and `policy_id`](guard-endpoint.md#agent-classes-and-policy_id)
for what the dial actually gates, and [Rolling out
enforcement](guard-endpoint.md#rolling-out-enforcement) for the safe sequence
— including a restart caveat that matters.

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
| `POST` | `/manage/api-keys/{id}/rotate` | Issue a new secret for the same key record; the old secret stops working |
| `PUT` | `/manage/api-keys/{id}/agent-class` | Bind the key to an agent class: `{"agent_class_id": "eng/code-reviewer"}` |
| `DELETE` | `/manage/api-keys/{id}/agent-class` | Clear the binding — the key becomes caller-led |

> There is **no** `/disable` endpoint on the live router. "Suspend" is what other systems would call "disable" — reversible, audit-preserving. `/rotate` does exist (`crates/semd-manage/src/router.rs`) — see [Fleet › Keys](../dashboard/fleet-keys.md) for the dashboard flow.

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
| `DELETE` | `/manage/audit/cleanup` | Purge old audit rows per retention policy |

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

## Notifications

Operator notifications are conditions the gateway raises about the tenant's own configuration and clears itself when they end. The first kind, `rules.compile_failed`, fires when the tenant's saved rules stop compiling: the last good rule set stays enforced, the rulesets API reports `in_effect: false` with the compiler's `compile_error`, and the notification stands until a later save compiles. They are not alerts — an alert is a detection finding about something an endpoint did and can only be muted; a notification has a `resolved` state because its condition genuinely ends.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/notifications` | List notifications, newest change first |

Requires `audit:read`, which every role has — the same tier that already exposes the compiler's complaint through the audit log.

Query parameters:

| Parameter | Type | Notes |
|---|---|---|
| `state` | string | `active` or `resolved`. Absent means both |
| `kind` | string | Currently `rules.compile_failed`. Absent means all |
| `page` | integer | 1-indexed. Default 1 |
| `page_size` | integer | Default 50 |

An unknown `state` or `kind` is a `400` naming the field and the allowed values.

Response:

```json
{
  "data": [ { /* notification */ } ],
  "total": 1,
  "page": 1,
  "page_size": 50,
  "has_more": false
}
```

Notification fields: `id`, `kind`, `subject` (what the condition is about — empty for a per-tenant condition such as a compile failure), `state` (`active` or `resolved`), `detail` (the producer's message — for a compile failure the compiler's complaint, kept current if the complaint changes), `first_seen` (when this episode opened), `last_seen` (the last observed change of the condition, not the last check), `resolved_at` (when it cleared; `null` while active).

Each failure episode is its own row: recovery resolves the open row, and failing again later opens a new one, so the history of episodes is kept.

There are deliberately no triage verbs — no mute, acknowledge, or delete. The only way a notification leaves the active list is the condition clearing; for `rules.compile_failed` that means fixing the rule the `compile_error` names under [Rulesets and rules](#rulesets-and-rules).

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
- [Fleet › Agents](../dashboard/fleet-agents.md), [Fleet › Keys](../dashboard/fleet-keys.md), [Guardrails › Policies](../dashboard/guardrails-policies.md), [Guardrails › Rules](../dashboard/guardrails-rules.md) — the dashboard UI on top of these endpoints.
