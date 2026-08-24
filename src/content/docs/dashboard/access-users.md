---
title: Access › Users
description: Who can use this console, what they can do, and the trail behind it.
sidebar:
  order: 14
---

Access › Users (`/access/users`) administers the people with console accounts:
their roles, whether their account is active, and break-glass designation.

RBAC has been enforced end to end since the beginning; this screen is what made it
administrable without the API.

## The gates here are convenience, not security

Every action on this screen is independently re-checked by the server before it
takes effect. A refusal is a 403 that is itself written to the audit log as
`authz.denied`.

Removing a `disabled` attribute in your browser grants nothing. The console shows
disabled controls with a tooltip naming the capability so the screen stays legible
to a viewer — not because the disabling is what stops you.

## Roles

A role is a bundle of capabilities. The console reads the catalogue from the server
(`GET /manage/authz/catalogue`) rather than hard-coding it, so what you see is what
the running build enforces.

See [Access control](../operations/access-control.md) for the roles and what each
one carries.

## You cannot lock yourself out

Two guards, both enforced server-side:

- **The last active admin cannot be demoted, deactivated or deleted.** A deployment
  that can no longer be administered is not a state the server will let you reach.
- **You cannot change your own role, deactivate yourself, or delete yourself.**
  Another administrator has to do it.

The console reflects both: those controls are disabled on your own row, and say why.

## Activating and deactivating

Deactivating an account stops it signing in and **revokes its live sessions** — it
does not wait for a token to expire.

Active state is changed through its own actions, not by editing the account. This
is deliberate: the change has a side effect on sessions, and it deserves its own
verb.

## Break-glass

An account can be designated break-glass — an emergency access path, expected to be
unused and noticed when it is used. Its use is audited like anything else.

See [Auth and secrets](../operations/auth-and-secrets.md).

## Passwords

Users change their own password from the account menu in the top bar — it is not an
administrator action. Administrators can provision an account; they do not set an
ongoing password for someone else.

## The trail

**View access-control audit trail** opens [Activity › Audit](activity-audit.md)
filtered to control-plane events. **See refused actions** filters to `authz.denied`
— the fastest way to find someone hitting a wall they should not be, or someone
probing.

Each user row links to that user's own trail.

## Capabilities

Reading needs `user:read`; changing roles, active state and break-glass needs
`user:manage`.

See also: [Manage users and roles](../guides/manage-users-and-roles.md),
[Access control](../operations/access-control.md).
