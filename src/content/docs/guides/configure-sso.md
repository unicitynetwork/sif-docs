---
title: Configure SSO (OIDC + SCIM)
description: Wire SIF to your identity provider — OIDC sign-in, group-to-role mapping, SCIM provisioning, SSO enforcement, and break-glass.
---

SIF supports enterprise single sign-on end to end: **OIDC** for operator sign-in, **group-to-role mapping** so your IdP decides who is a `viewer`/`operator`/`admin`, **SCIM 2.0** for automatic provisioning and deprovisioning, and **SSO enforcement** with a **break-glass** local account so you can't lock yourself out. This is the operator recipe. For the roles-and-capabilities model behind it, see [Access control (RBAC)](../operations/access-control.md).

Every step here needs an **admin** access token — the IdP config API is behind the `sso:configure` capability, which only `admin` holds.

```bash
TOKEN=$(curl -s -X POST http://<manage-host>:8081/manage/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"…"}' | jq -r .access_token)
```

## 1. Set the encryption key

SIF encrypts the OIDC **client secret** at rest with AES-256-GCM. The key comes from `SEMANTICD_ENCRYPTION_KEY`, which must be a **32-byte value, base64- or hex-encoded**:

```bash
# either encoding works — pick one
openssl rand -base64 32   # e.g. 8Uu1…=
openssl rand -hex 32      # e.g. 3f9c…
```

Set it in the gateway's environment **before** you configure the IdP, and keep it stable — rotating it makes the stored client secret undecryptable, and you'd have to re-enter it via `PUT /manage/idp`.

> If `SEMANTICD_ENCRYPTION_KEY` is unset (or not a valid 32-byte base64/hex value), SIF logs a warning and derives a throwaway dev key from the JWT secret. That is fine for local testing but **not for production** — set a real key. See [Auth and secrets](../operations/auth-and-secrets.md).

## 2. Register SIF with your IdP

In your identity provider (Okta, Entra ID, Google Workspace, Keycloak, …), create an **OIDC web application** and note its **client ID** and **client secret**. Set the app's **redirect URI** (a.k.a. sign-in redirect / callback URL) to SIF's callback, reachable from the browser:

```
https://<manage-host>:8081/manage/auth/oidc/callback
```

Then configure the app to release a **groups claim** on the ID token — an array of group names (or a single string). You choose which claim name to read in the next step (`group_claim`, default `groups`). SIF uses the Authorization-Code flow with PKCE and runs OIDC discovery against `<issuer_url>/.well-known/openid-configuration`, so you only need the issuer URL, not individual endpoints.

## 3. Configure the IdP connection

Write the connection with `PUT /manage/idp`. This is a **partial update** — every field you send is stored; fields you omit keep their current value.

```bash
curl -s -X PUT http://<manage-host>:8081/manage/idp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "issuer_url": "https://idp.example.com",
        "client_id": "sif-gateway",
        "client_secret": "<secret from your IdP>",
        "redirect_url": "https://<manage-host>:8081/manage/auth/oidc/callback",
        "group_claim": "groups",
        "group_role_map": {
          "sif-admins": "admin",
          "sif-operators": "operator",
          "sif-viewers": "viewer"
        }
      }'
```

| Field | Required | Notes |
|---|---|---|
| `issuer_url` | yes | OIDC issuer; discovery runs at `<issuer_url>/.well-known/openid-configuration` |
| `client_id` | yes | The app's client ID from your IdP |
| `client_secret` | confidential clients | Encrypted at rest. Omit for a public (PKCE-only) client; omitting on a later `PUT` leaves the stored secret unchanged |
| `redirect_url` | yes | Must equal the callback registered in step 2 |
| `group_claim` | no | ID-token claim to read groups from (default `groups`); accepts an array of strings or a single string |
| `group_role_map` | no | `{ "<idp-group>": "<role>" }`; roles are `viewer`, `operator`, `admin` |
| `sso_enforced` | no | Leave `false` here — turn it on in step 6, after break-glass is set |

`GET /manage/idp` returns the config back **redacted** — it never echoes the client secret or SCIM token, only whether each is set:

```json
{
  "issuer_url": "https://idp.example.com",
  "client_id": "sif-gateway",
  "redirect_url": "https://<manage-host>:8081/manage/auth/oidc/callback",
  "group_claim": "groups",
  "group_role_map": { "sif-admins": "admin", "sif-operators": "operator", "sif-viewers": "viewer" },
  "sso_enforced": false,
  "client_secret_set": true,
  "scim_token_set": false
}
```

**How group-to-role resolution works.** On every login SIF reads the groups claim, looks each group up in `group_role_map`, and assigns the **highest** matched role. A user in no mapped group (or an unmapped group) gets `viewer` — the least-privilege default. The IdP is authoritative: the role is re-resolved and re-applied on **each** sign-in, so a group change in the IdP takes effect on the user's next login.

## 4. Verify and sign in

Confirm SIF sees the config with the public status probe (no auth required):

```bash
curl -s http://<manage-host>:8081/manage/auth/sso-status
```

```json
{ "sso_enabled": true, "sso_enforced": false }
```

`sso_enabled` flips to `true` once both `issuer_url` and `client_id` are set; the dashboard reads this to render its **Sign in with SSO** button.

The end-user flow is entirely browser-driven:

1. The user clicks **Sign in with SSO**, which sends them to `GET /manage/auth/oidc/login`.
2. SIF starts the Authorization-Code + PKCE flow and 302-redirects the browser to your IdP.
3. The user authenticates at the IdP, which redirects back to `GET /manage/auth/oidc/callback`.
4. SIF verifies the ID token, provisions or links the user, resolves their role from the groups claim, mints a SIF session, and redirects to `/dashboard#access_token=…&refresh_token=…`. The dashboard reads the tokens from the URL fragment and the user is signed in.

First sign-in creates a passwordless (external) SIF account for the user; later sign-ins reuse it. If an account with the same email already exists, SIF links it to the IdP identity rather than duplicating it.

## 5. Provision users with SCIM

SCIM lets your IdP push users and group membership into SIF (and pull them out) without anyone signing in first. It's a separate bearer-authenticated surface at `/scim/v2` — not under `/manage`, not using operator sessions.

Rotate a SCIM token (admin only). The plaintext is shown **once**; only its SHA-256 hash is stored:

```bash
curl -s -X POST http://<manage-host>:8081/manage/idp/scim-token \
  -H "Authorization: Bearer $TOKEN"
```

```json
{ "scim_token": "<opaque token — shown once>", "note": "shown once — store it in your IdP's SCIM config" }
```

Point your IdP's SCIM client at:

- **Base URL:** `https://<manage-host>:8081/scim/v2`
- **Bearer token:** the `scim_token` above (`Authorization: Bearer <scim_token>`)

The surface implements the SCIM 2.0 core:

| Operation | Route | Behaviour |
|---|---|---|
| List users | `GET /scim/v2/Users` | Optional `filter=userName eq "x"` |
| Provision user | `POST /scim/v2/Users` | Requires `externalId`; role resolved from pushed groups (default `viewer`); repeat `externalId` → `409` |
| Get user | `GET /scim/v2/Users/{id}` | |
| Replace user | `PUT /scim/v2/Users/{id}` | Applies `active`; re-resolves role when `groups` are present |
| Patch user | `PATCH /scim/v2/Users/{id}` | Applies `active` and/or `groups` PatchOps |
| Deprovision | `DELETE /scim/v2/Users/{id}` | Soft delete: deactivate + revoke sessions (`204`) |
| List groups | `GET /scim/v2/Groups` | Returns the `group_role_map` keys as SCIM Groups |

**Deactivation is immediate.** Setting a user `active: false` (via `PATCH`/`PUT`) or `DELETE`-ing them both deactivates the account **and revokes all of that user's sessions at once** — they are cut off on their next request, not when their token would have expired. The row is kept for audit continuity; the auth layer refuses inactive users.

Any bad SCIM credential — missing header, wrong token, or SCIM not yet configured — is a `401`. The token check fails closed.

## 6. Enforce SSO (and keep a break-glass account)

By default, local password login stays enabled alongside SSO. To require SSO for operators, set `sso_enforced`. **Do the break-glass step first**, or you can lock every admin out the moment enforcement turns on.

**Designate a break-glass account.** A break-glass user keeps its local password even under enforcement — it's your way back in if the IdP is unreachable. Flag an existing local admin with `PATCH /manage/users/{id}`:

```bash
curl -s -X PATCH http://<manage-host>:8081/manage/users/$BREAK_GLASS_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_break_glass": true}'
```

**Then turn on enforcement:**

```bash
curl -s -X PUT http://<manage-host>:8081/manage/idp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sso_enforced": true}'
```

With `sso_enforced: true`, local password login returns `403` (`local login disabled — use single sign-on`) for every account **except** those flagged `is_break_glass` — those still authenticate with username and password. The block is recorded in the audit log. Clear the flag by sending `{"is_break_glass": false}`.

## Security notes

- **Secrets don't sit in plaintext.** The OIDC client secret is AES-256-GCM-encrypted at rest under `SEMANTICD_ENCRYPTION_KEY`; the SCIM token is stored only as a SHA-256 hash. `GET /manage/idp` never returns either value — just `client_secret_set` / `scim_token_set` booleans.
- **The server is the enforcement point.** SSO enforcement, role resolution, and SCIM auth are all checked server-side on every request; the dashboard only reflects the state.
- **Break-glass discipline.** Keep exactly one (or very few) break-glass accounts, give each a long unique password stored in your secrets manager, and audit their use. They exist to survive an IdP outage — not for day-to-day login.
- **Least privilege by default.** Both OIDC and SCIM resolve an unmapped user to `viewer`. Grant `operator`/`admin` only via explicit `group_role_map` entries.

## Related

- [Access control (RBAC)](../operations/access-control.md) — roles, the capability matrix, and how enforcement works.
- [Manage users and roles](manage-users-and-roles.md) — the local-account recipe SSO builds on.
- [First-boot setup](../operations/first-boot.md) — seed the admin and get your first token.
- [Auth and secrets](../operations/auth-and-secrets.md) — where at-rest secrets and keys live in production.
- [HTTP API → Management endpoints](../api/management-endpoints.md) — the full route surface behind RBAC.
