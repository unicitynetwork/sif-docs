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
| `GET` | `/manage/rulesets/{id}/policies` | The policies that attach this ruleset |
| `GET` | `/manage/rulesets/{ruleset_id}/rules` | List rules in a ruleset |
| `POST` | `/manage/rulesets/{ruleset_id}/rules` | Add a rule to a ruleset |
| `GET` | `/manage/rules/{id}` | Get a rule directly by ID |
| `PATCH` | `/manage/rules/{id}` | Update a rule |
| `DELETE` | `/manage/rules/{id}` | Delete a rule |
| `GET` | `/manage/rules/stats` | Aggregate rule statistics |

### Which policies use a ruleset

`GET /manage/rulesets/{id}/policies` answers "who depends on this?" — and it is
the list you need when a `DELETE` is refused, because a ruleset a policy still
attaches is never cascaded (see [Errors](#errors)). The delete's `409` message
already names the policies; this endpoint is how you check *before* trying, or
after a refusal you no longer have in front of you.

It needs **`policy:read`**, not `rules:read` — what it discloses is policy
identities, not rule content. A ruleset this tenant cannot see is a `404`,
never an empty list: "used by nothing" and "not yours" are different answers.

The response is a bare JSON array, ordered by `policy_id`, with one object per
attaching policy:

```json
[
  {"id": "9f4c1b02-6d3a-4e18-8c77-2b5a90ef1d44", "policy_id": "customer-support"},
  {"id": "c1a77e63-0b92-4d51-9f28-6e30ab44c907", "policy_id": "strict"}
]
```

`id` is the policy's UUID (what the other `/manage/policies/{id}` routes take);
`policy_id` is its string id. An empty array means no policy attaches this
ruleset, so a `DELETE` would succeed. Nothing else is returned — no policy name,
description, or position.

## Policies

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/policies` | List all policies |
| `POST` | `/manage/policies` | Create a new policy |
| `GET` | `/manage/policies/{id}` | Get one policy |
| `PATCH` | `/manage/policies/{id}` | Update a policy |
| `DELETE` | `/manage/policies/{id}` | Remove a policy |
| `GET` | `/manage/policies/{id}/rulesets` | The rulesets this policy runs, in flatten order |
| `PUT` | `/manage/policies/{id}/rulesets` | Replace that list, ordered |
| `GET` | `/manage/policies/{id}/flattened` | The rules the policy actually runs, after merging |
| `POST` | `/manage/policies/{id}/set-default` | Mark a policy as the default for unbound keys |

Policy shape matches [Concepts → Policies](../concepts/policies.md).

### Which rulesets a policy runs

Reads need `policy:read`; the `PUT` needs `policy:write`. A policy this tenant
cannot see is a 404, never an empty list — the two mean different things.

`GET` returns one object per attached ruleset — `position`, `id`, `ruleset_id`,
`version`, `description`, `enabled`, `is_builtin` — ordered by `position`
ascending. Gaps in `position` are legal: detaching a ruleset leaves the
survivors where they were.

`PUT` takes the whole list, because the order *is* the payload:

```json
{ "ruleset_ids": ["<uuid>", "<uuid>"] }
```

First in the array flattens first. An empty array detaches everything, which is
a legal state and a deliberate one. A ruleset named twice is refused (a ruleset
holds one position), as is one this tenant cannot see — both checked before
anything is written. The response is the same shape as `GET`.

### What the policy actually checks

`GET /manage/policies/{id}/flattened` merges every attached ruleset into the one
rule list the guard runs, so it is the answer to "what does this policy check?".
Summing the per-ruleset lists instead double-counts every rule id that appears in
more than one.

```json
{
  "attached_count": 42,
  "flattened_count": 40,
  "enabled_count": 38,
  "rules": [
    {
      "rule_id": "pii-fin-002",
      "score": 0.95,
      "severity": "critical",
      "action": null,
      "enabled": true,
      "defined_by": "pii-detection",
      "tightened_by": ["acme-tighten"]
    }
  ]
}
```

`attached_count` counts rule rows across every attached ruleset, repeats
included; `flattened_count` counts distinct rules after the merge. The two
differing is how you find an overlap. `enabled_count` is how many of those
actually run — the guard drops the rest, but they stay in `rules` with
`enabled: false`, because a rule that is attached and not firing is a different
fact from one that is absent.

`defined_by` names the ruleset the rule's pattern came from; `tightened_by`
names, in attachment order, those whose copy of the id made it stricter, and is
empty in the common case. `action` is `null` for every rule stored in the
database — the `rules` table has no `action` column, so there is nothing for the
merge to take a maximum of.

## Agent classes and enforcement

The registry of **agent classes** — the unit of policy for classed keys (see
[Concepts → Policies](../concepts/policies.md) and [Fleet ›
Agents](../dashboard/fleet-agents.md)). Reads need `registry:read` (viewer+);
writes need `registry:write` (operator+).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/registry/classes` | List this tenant's agent classes |
| `POST` | `/manage/registry/classes` | Register a new class. `slug` and `display_name` required; `policy_ids` optional |
| `GET` | `/manage/registry/classes/{*slug}` | Get one class; the catch-all preserves path-like slugs such as `eng/code-reviewer` |
| `PATCH` | `/manage/registry/classes/{*slug}` | Change display name, description, owner, tags, or the attached **`policy_ids`** — the edit this registry exists for |
| `POST` | `/manage/registry/retire/{*slug}` | Retire the class |
| `DELETE` | `/manage/registry/classes/{*slug}` | Delete the class and release its policy attachments |
| `GET` | `/manage/registry/enforcement` | Read the tenant's class-policy enforcement dial: `off`, `flag`, or `block` |
| `PUT` | `/manage/registry/enforcement` | Move the dial. Body: `{"enforcement": "off" \| "flag" \| "block"}` |
| `GET` | `/manage/registry/observed` | Agent classes seen in the audit log, registered or not, with call counts |

Retiring and deleting answer different questions. Retirement is the lifecycle
state: the row, its attachments and its audit joins stay, and keys already
bound to the class keep resolving through its policies. `DELETE` is the
cleanup path — it removes the class and cascades away its
`agent_class_policies` rows, so a policy whose last class this was becomes
archivable immediately afterwards. It **refuses with `409` while any live API
key still carries the class** (through `api_key_classes` membership or the
key's `agent_class_id`); move those keys to another class or to none first.
Revoked keys do not count — they cannot call again, so they never hold a class
back. Audit history is untouched by either: `audit_log.agent_class` records
the slug as text with no foreign key.

```bash
curl -X PATCH https://<manage-host>/manage/registry/classes/eng/code-reviewer \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"policy_ids": ["strict"]}'
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
| `PATCH` | `/manage/api-keys/{id}` | Update `name`, `rate_limit_rpm`, `metadata`, `expires_at`. **Not** a policy — a key holds none; see `/agent-class` below |
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

The full secret is the `api_key` field; `key_prefix` is the abbreviated form shown in lists, audit rows, and the dashboard. Rate limit, expiry, and status default to the key tenancy defaults and can be set with a follow-up `PATCH /manage/api-keys/{id}`. A key holds no policy of its own — bind it to an agent class with `PUT /manage/api-keys/{id}/agent-class`. Optional create fields: `tier`, `rate_limit_rpm`, `metadata`, `expires_at`.

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
| `event_type` | string | Filter by event type, `snake_case` |
| `policy_id` | string | Filter by policy |
| `api_key_id` | string | Filter by API key |
| `agent_class` | string | Filter by agent class |
| `user_id` | string | Filter by user |
| `session_id` | string | Filter by session |
| `degraded_only` | boolean | Only rows where the response was served degraded. Default `false` |
| `start_date` | ISO-8601 | Lower bound on timestamp |
| `end_date` | ISO-8601 | Upper bound on timestamp |
| `page` | integer | 1-indexed. Default 1 |
| `page_size` | integer | Rows per page. Default 50 |

**An unrecognised parameter is ignored, not rejected.** Misspell one — or reach
for a filter this table does not list — and the call succeeds, returning rows
that were never narrowed. On an audit log that reads as "there were no such
events", so check the name against this table before trusting an empty result.

Response:

```json
{
  "data": [ { /* audit row */ } ],
  "total": 128,
  "page": 1,
  "page_size": 50,
  "has_more": true
}
```

Audit row fields: `id`, `request_id`, `event_type`, `action`, `message_count`, `total_chars`, `latency_ms`, `risk_score`, `policy_id`, `api_key_id` (the `key_prefix`), `app_id`, `user_id`, `session_id`, `detections`, `degraded`, `client_ip`, `user_agent`, `ruleset_version`, `timestamp`.

`app_id` is historical: it was copied from the calling key's own `app_id`, an attribute removed in favour of agent classes. Rows written before the removal keep their value and still render it; rows written since carry `null`. There is no longer a filter for it — use `agent_class`.

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
