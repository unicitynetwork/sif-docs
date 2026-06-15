---
title: Management endpoints (beta)
description: The /manage/* API for rules, policies, detectors, keys, and audit.
---

> **Status: beta.** Used by the dashboard and by operator scripts. Shapes may evolve before 1.0.

:::caution[Admin scope required]
The `/manage/*` endpoints are the operator/SRE surface. During the hosted alpha, the API keys issued to design partners do **not** grant the `manage` scope — these calls will return `403 forbidden`. Use the [dashboard](../dashboard/settings-page.md) for the equivalent workflows, or wait for post-alpha self-hosting where you control scope.
:::

The `/manage/*` family is the admin surface — read and write the gateway's configuration, read the audit log. All endpoints require an API key whose policy grants the `manage` scope (or `--dev-mode`).

## Rules

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/rules` | List all loaded rules |
| `GET` | `/manage/rules/{id}` | Get one rule, including its source |
| `PATCH` | `/manage/rules/{id}` | Update metadata (`enabled`, `severity`, `notes`) |
| `POST` | `/manage/rules` | Upload a new custom rule file |
| `DELETE` | `/manage/rules/{id}` | Remove a custom rule file |

```bash
curl https://sif.unicity.network/manage/rules \
  -H "Authorization: Bearer semd_admin_key"
```

Response:

```json
{
  "rules": [
    {
      "id": "jb_dan_mode",
      "name": "DAN mode invocation",
      "category": "jailbreak",
      "severity": "high",
      "enabled": true,
      "source": "builtin"
    }
  ],
  "ruleset_version": 42
}
```

## Policies

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/policies` | List all policies |
| `GET` | `/manage/policies/{name}` | Get one policy |
| `PUT` | `/manage/policies/{name}` | Replace a policy's body |
| `POST` | `/manage/policies` | Create a new policy |
| `DELETE` | `/manage/policies/{name}` | Remove a policy (rejected if any key references it) |

Policy shape matches [Concepts → Policies](../concepts/policies.md).

## Detectors and models

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/detectors` | List loaded detectors and their state |
| `POST` | `/manage/detectors/{name}/reload` | Force a detector reload |
| `GET` | `/manage/models` | List loaded ML models |
| `POST` | `/manage/models/{name}/unload` | Free a model from memory |

## API keys

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/api-keys` | List keys (secrets are never returned) |
| `GET` | `/manage/api-keys/{id}` | Get one key's metadata |
| `POST` | `/manage/api-keys` | Create a new key. The secret is returned **only** in this response |
| `PATCH` | `/manage/api-keys/{id}` | Update name, policy binding, rate limit, expiry, or status |
| `POST` | `/manage/api-keys/{id}/rotate` | Issue a new secret with a 24-hour overlap |
| `POST` | `/manage/api-keys/{id}/disable` | Reject all future requests with `403 key_disabled` |
| `POST` | `/manage/api-keys/{id}/revoke` | Permanently invalidate |

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

The full secret is the `api_key` field; `key_prefix` is the abbreviated form shown in lists, audit rows, and the dashboard. Policy binding, rate limit, expiry, and status default to the policy/key tenancy defaults and can be set with a follow-up `PATCH /manage/api-keys/{id}`.

## Audit

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/audit` | List audit rows |
| `GET` | `/manage/audit/{id}` | Single audit row by internal `id` (UUID, **not** `request_id`) |
| `GET` | `/manage/audit/stats/hourly` | Hourly bucket counts |

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
