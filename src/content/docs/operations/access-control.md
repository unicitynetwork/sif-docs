---
title: Access control (RBAC)
description: Roles, capabilities, and how the Management API and dashboard enforce who can do what.
---

The Management API (`/manage/*`) and the dashboard use **role-based access control**. Every user account has exactly one **role**; a role grants a fixed set of **capabilities**; and every management action requires a specific capability. Access is **default-deny** — an endpoint is unreachable without a valid session, and an action is refused without the capability it needs.

This page is the reference for the model. For the operator recipe (create users, assign roles, deprovision), see [How-to → Manage users and roles](../guides/manage-users-and-roles.md).

> Scope: RBAC governs the **Management API and dashboard** (human operators). The **Guard API** (`/api/v1/guard`) is authenticated separately, by API key — see [Authentication](../api/authentication.md) and [API keys and tenancy](../concepts/api-keys-and-tenancy.md).

## The three roles

There are exactly three roles. One is assigned per user.

| Role | For | In one line |
|---|---|---|
| **`viewer`** | Auditors, read-only observers, dashboards on a wall | Can read everything operational; can change nothing |
| **`operator`** | Day-to-day security operators | Everything `viewer` can, plus manage policies, rules, and API keys |
| **`admin`** | Account owners / platform admins | Everything `operator` can, plus manage users, roles, audit retention, and SSO |

Roles are **cumulative**: `operator` includes all `viewer` capabilities, and `admin` includes all `operator` capabilities.

## What each role can do

| Action | viewer | operator | admin |
|---|:--:|:--:|:--:|
| View policies, rules, detectors, models | ✓ | ✓ | ✓ |
| View the audit log | ✓ | ✓ | ✓ |
| Create / edit / delete policies and rules | | ✓ | ✓ |
| View and manage API keys (mint, suspend, revoke) | | ✓ | ✓ |
| Reset statistics | | ✓ | ✓ |
| View and manage users; assign roles | | | ✓ |
| Clean up / purge audit records | | | ✓ |
| Configure SSO | | | ✓ |
| Change **their own** password | ✓ | ✓ | ✓ |

A `viewer` deliberately cannot see API keys (they are credentials) or users. Minting an API key sits with `operator` because it is routine security-operations work; if your organisation treats key issuance as privileged, restrict day-to-day accounts to `viewer` and hand out `operator` narrowly.

## Capabilities

Under the hood, each route requires one capability, and each role holds a set of them. You never assign capabilities directly (roles are fixed in this release), but the names appear in the dashboard's `/auth/me` response and in denial messages, so they are worth knowing.

| Capability | Held by | Gates |
|---|---|---|
| `config:read` | viewer, operator, admin | Read models / detectors / config surfaces |
| `policy:read` / `policy:write` | read: all · write: operator, admin | Read vs. create/edit/delete policies |
| `rules:read` / `rules:write` | read: all · write: operator, admin | Read vs. toggle / delete rules and rulesets, create a ruleset |
| `rules:author` | operator, admin | Create rules, edit rule + ruleset content, clone rulesets (built-ins excepted: content is immutable for every role; their toggle and clone need the platform role) |
| `apikey:read` / `apikey:manage` | operator, admin | List vs. mint/suspend/revoke API keys |
| `audit:read` / `audit:manage` | read: all · manage: admin | Read the audit log vs. purge it |
| `user:read` / `user:manage` | admin | View users vs. create/edit/delete + assign roles |
| `stats:manage` | operator, admin | Reset statistics |
| `sso:configure` | admin | Configure single sign-on |

## How enforcement works

Two independent checks run before any handler:

1. **Authentication (default-deny).** Every `/manage/*` request must carry a valid session token. No token, an expired token, a revoked session, or a deactivated user → **`401 Unauthorized`**. There is no route you can reach un-authenticated except the login endpoint itself.
2. **Authorization (capability).** The handler requires a capability. If the caller's role does not hold it → **`403 Forbidden`**, with a message naming the missing capability.

The **server is the only enforcement point.** The dashboard hides or disables actions a user lacks the capability for — a `viewer` sees the "Create policy" button greyed out with a tooltip — but this is a convenience, not the boundary. Every action is re-checked server-side, so a crafted request from a low-privilege token is still refused with `403`.

## Authentication and sessions

Operators authenticate with a username and password and receive a short-lived token pair.

```bash
curl -s -X POST http://<manage-host>:8081/manage/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"…"}'
```

```json
{
  "access_token": "<JWT>",
  "refresh_token": "<opaque token>",
  "expires_at": "2026-07-18T14:05:00Z"
}
```

- **Access token** — a JWT, short-lived (**15 minutes**). Send it on every management call as `Authorization: Bearer <access_token>`.
- **Refresh token** — long-lived and single-use. Exchange it at `POST /manage/auth/refresh` for a fresh access token (and a rotated refresh token) without re-entering the password.
- **Sessions are server-side and revocable.** `POST /manage/auth/logout` revokes the current session immediately. Deactivating or deleting a user revokes **all** of that user's sessions at once — deprovisioning takes effect on the next request, not on token expiry.

`GET /manage/auth/me` returns the caller's identity and effective capabilities — the dashboard uses it to render least-privilege UI:

```json
{
  "id": "…", "username": "alice", "email": "alice@example.com",
  "role": "operator",
  "capabilities": ["apikey:manage", "apikey:read", "audit:read",
    "config:read", "policy:read", "policy:write", "rules:read",
    "rules:write", "stats:manage"]
}
```

## Dev mode and RBAC

`--dev-mode` relaxes the **Guard API** (it bypasses API-key auth on `/api/v1/guard`). It does **not** relax Management-API RBAC: management endpoints always require a valid session and the right capability, even in dev mode. So role behaviour on the dashboard is identical in dev and production.

## Security notes

- **Least privilege.** Give operators `operator`, auditors `viewer`, and reserve `admin` for the small number of people who genuinely administer accounts.
- **Rotate the seeded admin.** First boot creates `admin` with the password from `SEMANTICD_ADMIN_PASSWORD` (default `admin`, with a startup warning). Change it before the gateway is reachable — see [First-boot setup](first-boot.md).
- **The last admin is protected.** You cannot delete, demote **or deactivate** the last `admin` who can still sign in — all three are refused with `403`, so you can never lock yourself out. Deactivated admins don't count towards the tally, so parking every other `admin` leaves the remaining one protected rather than stranding you.
- **Deprovision by deactivating.** Setting a user inactive both blocks new logins and revokes existing sessions immediately.

## Single sign-on

SIF supports enterprise SSO, gated by the `sso:configure` capability (`admin` only):

- **OIDC sign-in.** Operators authenticate against your identity provider via the Authorization-Code + PKCE flow. On each login SIF maps the IdP's **groups claim** to a SIF role through an admin-configured map (`{ "<idp-group>": "<role>" }`), assigning the highest matched role and defaulting to `viewer`. The IdP is authoritative — the role is re-resolved on every sign-in.
- **SCIM 2.0 provisioning.** Your IdP can push users and group membership to SIF at `/scim/v2` (bearer-authenticated, separate from operator sessions). Deactivating a user there deactivates the account **and revokes their sessions immediately**.
- **SSO enforcement + break-glass.** With SSO enforced, local password login is refused (a uniform `401`) for everyone except accounts flagged **break-glass** — a deliberate local escape hatch so an IdP outage can't lock you out.

For the operator recipe — encryption key, IdP registration, group-to-role mapping, SCIM, and enforcement — see [How-to → Configure SSO](../guides/configure-sso.md).

## Related

- [How-to → Manage users and roles](../guides/manage-users-and-roles.md) — create operators and viewers, assign roles, deprovision.
- [How-to → Configure SSO](../guides/configure-sso.md) — OIDC sign-in, group-to-role mapping, SCIM, and SSO enforcement with break-glass.
- [First-boot setup](first-boot.md) — seed the admin, get a token, mint the first API key.
- [HTTP API → Management endpoints](../api/management-endpoints.md) — the full route surface behind RBAC.
- [Authentication](../api/authentication.md) — Guard-API (API-key) auth, which is separate from operator RBAC.
- [Reference → API error codes](../reference/api-error-codes.md) — the `401` / `403` shapes.
