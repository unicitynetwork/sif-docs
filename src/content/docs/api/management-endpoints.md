---
title: Management endpoints (beta)
description: The /manage/* API for rules, policies, detectors, keys, and audit.
---

> **Status: beta.** Used by the dashboard and by operator scripts. Shapes may evolve before 1.0.

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
curl http://localhost:8080/manage/rules \
  -H "Authorization: Bearer sk_admin_key"
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
| `GET` | `/manage/keys` | List keys (secrets are never returned) |
| `GET` | `/manage/keys/{id}` | Get one key's metadata |
| `POST` | `/manage/keys` | Create a new key. The secret is returned **only** in this response |
| `PATCH` | `/manage/keys/{id}` | Update name, policy binding, rate limit, expiry, or status |
| `POST` | `/manage/keys/{id}/rotate` | Issue a new secret with a 24-hour overlap |
| `POST` | `/manage/keys/{id}/disable` | Reject all future requests with `403 key_disabled` |
| `POST` | `/manage/keys/{id}/revoke` | Permanently invalidate |

```bash
curl -X POST http://localhost:8080/manage/keys \
  -H "Authorization: Bearer sk_admin_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "support-bot-prod",
    "policy": "default",
    "rate_limit_rpm": 60
  }'
```

Response (the only place the full secret appears):

```json
{
  "id": "key_a3f0c8e1",
  "name": "support-bot-prod",
  "secret": "sk_a3f0c8e1b2d97c4f6a8e2b1d3c5f7a9e",
  "policy": "default",
  "rate_limit_rpm": 60,
  "status": "active",
  "created_at": "2026-06-07T18:42:10.123Z"
}
```

## Audit

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/manage/audit/entries` | List audit rows, paginated |
| `GET` | `/manage/audit/entries/{request_id}` | Single audit row by ID |
| `GET` | `/manage/audit/stats/hourly` | Hourly bucket counts |

Query parameters for `/manage/audit/entries`:

| Parameter | Type | Notes |
|---|---|---|
| `action` | string | Filter by verdict action: `allow`, `block`, `flag`, `modify` |
| `key_prefix` | string | Filter by API key (the prefix shown in the dashboard) |
| `policy` | string | Filter by `policy_applied` |
| `category` | string | Filter to rows with at least one detection in this category |
| `since` | ISO-8601 | Lower bound on timestamp |
| `until` | ISO-8601 | Upper bound on timestamp |
| `page_size` | integer | 1–500. Default 50 |
| `cursor` | opaque | Opaque pagination cursor from the previous page |

Response:

```json
{
  "entries": [ { /* audit row */ } ],
  "next_cursor": "eyJ0c...="
}
```

When `next_cursor` is absent, the result set is exhausted.

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
