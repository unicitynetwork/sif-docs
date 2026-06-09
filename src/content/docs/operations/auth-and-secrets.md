---
title: Auth and secrets
description: Where credentials live and how to rotate them.
---

A production gateway has four kinds of credentials:

| Credential | What it is | Storage |
|---|---|---|
| **API keys** | `ps_…` secrets that clients present | Hashed in Postgres; raw secret never persisted |
| **Database URL** | Postgres connection string with password | Env var / secret manager |
| **Redis URL** | Redis connection string | Env var / secret manager |
| **Encryption key** | 32-byte key for at-rest encryption of audit detail | Env var / secret manager |

## API keys

Lifecycle is covered in [How-to → Add and rotate API keys](../guides/add-and-rotate-api-keys.md). Operational notes:

- The raw secret is shown **once** at creation. The dashboard cannot re-display it later — only the hash is stored.
- Lost keys cannot be recovered, only rotated.
- The hash function is Argon2id with a per-key salt. Verification is constant-time.

## Database and Redis URLs

Treat these like any other production secret. The standard places:

| Platform | Mechanism |
|---|---|
| Docker Compose | Docker secrets (`docker secret create`) |
| Kubernetes | `Secret` objects mounted as files or env vars |
| Cloud-native | AWS Secrets Manager, GCP Secret Manager, Azure Key Vault |
| Self-hosted | HashiCorp Vault, sops-encrypted files in VCS |

Reference them by file rather than env var when possible:

```env
DATABASE_URL_FILE=/run/secrets/database_url
REDIS_URL_FILE=/run/secrets/redis_url
```

This avoids credentials appearing in `docker inspect` and process lists.

## Encryption key

When `audit_full_body = true` (see [Concepts → Threats and verdicts](../concepts/threats-and-verdicts.md)), the gateway encrypts the persisted request body with a 32-byte AEAD key:

```env
ENCRYPTION_KEY_FILE=/run/secrets/encryption_key
```

Generate with:

```bash
openssl rand -hex 32
```

**Rotating the encryption key invalidates the historical audit detail** — encrypted entries written with the old key cannot be decrypted by the new key. Plan rotation as a maintenance window: decrypt with the old key, re-encrypt with the new, swap.

For short-retention audit data (90 days default), the simpler path is to wait the retention window before rotating.

## Operator access

There is currently no per-operator role separation for the dashboard. Anyone with an API key whose policy grants the `manage` scope can edit any rule, policy, or key.

Practical mitigations:

1. **Issue separate manage-scope keys** to each operator, named after the operator (`ops-alice`, `ops-bob`). Audit rows will then show who did what.
2. **Restrict the dashboard's port** at the network layer to a bastion or VPN.
3. **Use the audit log** to detect unexpected management activity — query `/manage/audit/entries` for activity outside expected hours or from unexpected source IPs.

Role-based dashboard auth is on the roadmap. Track its arrival in the [Changelog](changelog.md).

## Related

- [Settings page](../dashboard/settings-page.md) — operator UI for API keys.
- [How-to → Add and rotate API keys](../guides/add-and-rotate-api-keys.md) — the rotation recipe.
- [Production checklist](../deployment/production-checklist.md) — security items to verify.
