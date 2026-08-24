---
title: Access › Identity
description: Configure enterprise SSO — OIDC issuer, client credentials, and group-to-role mapping.
sidebar:
  order: 15
---

Access › Identity (`/access/identity`) configures single sign-on, so people sign in
with your identity provider instead of a password held by SIF.

## What it needs

| Field | What it is |
|---|---|
| Issuer URL | Your OIDC provider's issuer |
| Client ID | The application registered with that provider |
| Client secret | Its secret |
| Redirect URL | Where the provider sends users back — register this with the provider too |
| Group claim | Which claim in the token carries group membership |

## Secrets are write-only

The API never returns a client secret. The screen shows whether one is *set*, not
what it is. There is no way to read a secret back out of SIF — if you have lost it,
issue a new one at the provider and set it again.

## Group to role mapping

Map a group from your provider onto a SIF role. Someone signing in gets the role
their group maps to.

Add a mapping per group you want to recognise. A group with no mapping grants
nothing — SSO authenticates, the mapping authorises, and an unmapped group is
authenticated but unprivileged.

## Rejected sign-ins

A sign-in the provider accepts but SIF cannot map is rejected. That is a 401, and it
is written to the audit log. If people report SSO "not working", look at
[Activity › Audit](activity-audit.md) filtered to control-plane events before
suspecting the provider — an unmapped group looks like a broken login from the
outside.

## Keep a way in

Configure SSO alongside at least one working local administrator, and consider a
break-glass account. An identity provider outage should not be a SIF outage. See
[Access › Users](access-users.md).

## Capabilities

Reaching the screen and changing configuration needs `sso:configure`. The server
enforces it on every read and write independently of the console.

See also: [Configure SSO](../guides/configure-sso.md),
[Auth and secrets](../operations/auth-and-secrets.md).
