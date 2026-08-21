---
title: Manage users and roles
description: Create operators and viewers, assign roles, and deprovision access.
---

The seeded `admin` is the only account after [first boot](../operations/first-boot.md). This page is the operator recipe for adding people, giving them the right role, and removing access when they leave. For the model behind roles and capabilities, see [Access control (RBAC)](../operations/access-control.md).

Everything here needs an **admin** access token — user management is `admin`-only.

## Get an admin token

```bash
TOKEN=$(curl -s -X POST http://<manage-host>:8081/manage/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"…"}' | jq -r .access_token)
```

The token is a short-lived (15-minute) access token — mint a fresh one when it expires, or exchange the `refresh_token` at `POST /manage/auth/refresh`. See [Access control → Authentication and sessions](../operations/access-control.md#authentication-and-sessions).

## Create a user

Pick the least-privileged role that lets them do their job — `viewer` for read-only, `operator` for day-to-day security operations, `admin` only for people who administer accounts.

```bash
curl -s -X POST http://<manage-host>:8081/manage/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "username": "alice",
        "email": "alice@example.com",
        "password": "a-strong-initial-password",
        "role": "operator"
      }'
```

Rules the request must satisfy:

| Field | Requirement |
|---|---|
| `username` | ≥ 3 characters, unique |
| `email` | contains `@` and `.`, unique |
| `password` | ≥ 8 characters |
| `role` | one of `viewer`, `operator`, `admin` |

The user changes this initial password themselves at first sign-in (below).

## Change a user's role

Find the user's `id` (`GET /manage/users`), then `PATCH` it. Role changes take effect on their next request.

```bash
curl -s -X PATCH http://<manage-host>:8081/manage/users/$USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}'
```

You cannot demote the **last** `admin` who can still sign in — the gateway refuses it with `403` so you can't lock everyone out. Deactivated admins don't count, so the protection holds even when other `admin` accounts exist on paper.

`PATCH` changes `role`, `is_active` and `is_break_glass`. It does **not** change `email`: sending an `email` field is rejected with `400`, because for SSO-provisioned accounts the address belongs to your identity provider.

## Deprovision access (deactivate)

Deactivating is the fast, reversible way to cut someone off. It blocks new logins **and revokes their existing sessions immediately** — they are logged out on their next request, not whenever their token would have expired.

```bash
# Cut off access now:
curl -s -X POST http://<manage-host>:8081/manage/users/$USER_ID/deactivate \
  -H "Authorization: Bearer $TOKEN"

# Restore it later:
curl -s -X POST http://<manage-host>:8081/manage/users/$USER_ID/activate \
  -H "Authorization: Bearer $TOKEN"
```

Use **deactivate** for someone on leave, an account under investigation, or anyone you might reinstate. Use **delete** (`DELETE /manage/users/{id}`) only when the account should be gone for good. As with roles, you cannot delete **or deactivate** the last `admin` who can still sign in — both are refused with `403`. Reactivating is never blocked: it can only ever give you more admins, not fewer.

## Change your own password

Any user can rotate their own password. This needs the current password and the new one; there is no admin token involved.

```bash
curl -s -X POST http://<manage-host>:8081/manage/users/$MY_ID/change-password \
  -H "Authorization: Bearer $MY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"old","new_password":"a-new-strong-password"}'
```

New passwords must be ≥ 8 characters. For a user who has forgotten theirs, the practical reset is to deactivate the account and issue a fresh one — treat lost credentials like any other lost secret.

## Log out

`POST /manage/auth/logout` (with the access token) revokes the current session. The dashboard's **Sign out** button does the same. Because sessions are server-side, a logout is effective immediately — the token cannot be replayed afterwards.

## Choosing a role

| If they need to… | Give them |
|---|---|
| Watch dashboards, review threats and the audit log, read policies | `viewer` |
| Tune policies and rules, mint and rotate API keys, run day-to-day ops | `operator` |
| Add/remove operators, assign roles, purge audit history, [configure SSO](configure-sso.md) | `admin` |

When in doubt, start with `viewer` and promote — it's the least-privilege default.

## Related

- [Access control (RBAC)](../operations/access-control.md) — roles, the capability matrix, and how enforcement works.
- [Configure SSO](configure-sso.md) — OIDC sign-in, SCIM provisioning, and designating break-glass accounts under SSO enforcement.
- [First-boot setup](../operations/first-boot.md) — seed the admin and get your first token.
- [HTTP API → Management endpoints](../api/management-endpoints.md) — the exact request/response shapes for every route used here.
