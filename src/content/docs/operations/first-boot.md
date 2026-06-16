---
title: First-boot setup
description: Seed the admin user, get a JWT, mint your first API key.
---

The end-to-end recipe for the first time a `semanticd serve` process starts against a fresh database. Five steps:

1. Set the admin-seeding and JWT-secret env vars
2. Start `semanticd serve`
3. Log in via the dashboard or `POST /manage/auth/login`
4. Mint an API key for your application
5. Rotate the admin password

Grounded in [`crates/semanticd/src/main.rs`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semanticd/src/main.rs) (the admin-seeding block) and [`crates/semd-manage/src/handlers/auth.rs`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-manage/src/handlers/auth.rs) (login + JWT minting).

## 1 · Set the environment

```bash
# Seed the initial admin user. Read at first-boot only; ignored after the
# user row exists in Postgres.
export SEMANTICD_ADMIN_USERNAME=admin             # default: admin
export SEMANTICD_ADMIN_PASSWORD=$(openssl rand -base64 24)
export SEMANTICD_ADMIN_EMAIL=ops@example.com

# JWT signing secret. Without this, every restart invalidates outstanding
# tokens. Use a long random string.
export SIF_JWT_SECRET=$(openssl rand -base64 32)

# Database — used both by `migrate` and by `serve`.
export SEMANTICD_DATABASE_URL=postgres://semanticd:semanticd@localhost/semanticd
export SEMANTICD_REDIS_URL=redis://localhost:6379
```

Notes:
- `SIF_JWT_SECRET` uses the legacy `SIF_` prefix (the variable name pre-dates the rename to `semanticd`). It is the only `SIF_*` env var the gateway still reads.
- The defaults if you skip the admin vars are `admin / admin` — the gateway will log a warning at startup if you leave it that way.

The full env-var catalogue is at [Reference → Environment variables](../reference/environment-variables.md).

## 2 · Migrate + serve

```bash
semanticd migrate                                      # apply pending Postgres migrations
semanticd serve --config /etc/semanticd/config.toml    # or --dev-mode for a relaxed local stack
```

`serve` binds three ports — Guard API, Management API, Metrics — see [Health and status](../api/health-and-status.md). On first boot, the gateway reads the `SEMANTICD_ADMIN_*` env vars, creates the admin user row in Postgres, and logs:

```
INFO Created admin user from SEMANTICD_ADMIN_* env username=admin
```

If the default `admin / admin` was used, a separate warning is logged.

## 3 · Get a JWT

### Via the dashboard

Open `http://<manage-host>:<manage-port>/dashboard` (default `:8081`). Sign in with the credentials you just seeded. The dashboard stores the JWT in browser storage and uses it for every subsequent call.

### Via curl

```bash
TOKEN=$(curl -s -X POST http://<manage-host>:<manage-port>/manage/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$SEMANTICD_ADMIN_USERNAME\",\"password\":\"$SEMANTICD_ADMIN_PASSWORD\"}" \
  | jq -r .token)
```

Response (from `LoginResponse` in source):

```json
{
  "token": "<JWT>",
  "user": {
    "id": "<uuid>",
    "username": "admin",
    "email": "ops@example.com",
    "role": "admin"
  },
  "expires_at": "2026-06-17T11:10:14.574Z"
}
```

**JWT lifetime is 24 hours**, hardcoded. After expiry, re-log in. The JWT carries the user UUID in `sub`, the username, the role, and the standard `exp` / `iat` claims — nothing else. There is no refresh-token flow today.

## 4 · Mint an API key

```bash
curl -s -X POST http://<manage-host>:<manage-port>/manage/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"support-bot-prod","policy_id":"default"}'
```

Response:

```json
{
  "id": "b93f228d-23ae-45cb-a39b-490000889aea",
  "api_key": "semd_live_a3f0c8e1b2d97c4f6a8e2b1d3c5f7a9e",
  "key_prefix": "semd_live_a3f0c8e1",
  "name": "support-bot-prod",
  "created_at": "2026-06-16T11:10:14.574Z"
}
```

The full `api_key` is returned **once** — store it in your application's secret manager immediately. After this response, only `key_prefix` is retrievable.

Optional create-time fields on the body: `rate_limit_rpm`, `tier`, `expires_at`, `app_id`, `metadata`. They can also be set after the fact with `PATCH /manage/api-keys/{id}`. See [Management endpoints → API keys](../api/management-endpoints.md#api-keys).

## 5 · Rotate the admin password

If you used the seeding defaults (`admin / admin`), change the password before the gateway is reachable from outside the host:

```bash
ADMIN_ID=$(curl -s http://<manage-host>:<manage-port>/manage/users \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.[] | select(.username=="admin") | .id')

curl -X POST http://<manage-host>:<manage-port>/manage/users/$ADMIN_ID/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"new_password\":\"$(openssl rand -base64 24)\"}"
```

The new password takes effect on the next login; existing JWTs continue to work until they expire (24 h ceiling).

## What this does not cover

- **Policy authoring.** First boot installs a `default` policy with permissive thresholds. Tune per-category thresholds via the [Policies page](../dashboard/policies-page.md) or `PATCH /manage/policies/{id}` before bringing real traffic onto the gateway.
- **Multi-operator setup.** The seeded admin is the only user. Add more via `POST /manage/users` from an admin JWT. See [Management endpoints → Users](../api/management-endpoints.md#users).
- **Production hardening.** TLS, secrets management, backups, multi-replica deploys — see [Deployment](../deployment/) and [Operations → Auth and secrets](auth-and-secrets.md).

## Related

- [Reference → Environment variables](../reference/environment-variables.md) — every variable named here, plus the generic config-override layer.
- [HTTP API → Management endpoints](../api/management-endpoints.md) — the full route surface a JWT unlocks.
- [Concepts → API keys and tenancy](../concepts/api-keys-and-tenancy.md) — the mental model behind key + policy bindings.
- [How-to → Add and rotate API keys](../guides/add-and-rotate-api-keys.md) — the mint-and-revoke pattern for ongoing key lifecycle.
