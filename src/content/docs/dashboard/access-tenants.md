---
title: Access › Tenants
description: Platform-operator administration of the tenants on this deployment.
sidebar:
  order: 15
---

Access › Tenants (`/access/tenants`) is the platform operator's screen: the
organisations on this deployment, and their lifecycle.

Most people will never see it. Reading the list needs `tenant:manage`, which only
the platform role holds — a tenant administrator gets a 403, and the screen says so
rather than reporting zero tenants.

## Creating a tenant

Creating a tenant provisions its **first administrator** at the same time — there is
no useful tenant without someone who can administer it.

| Field | Notes |
|---|---|
| Slug | The tenant's identifier. Lowercase, digits, `_` and `-`; must start with a letter or digit; 63 characters at most |
| Display name | What people see |
| First admin username | The account created with it |
| First admin email | That account's address |

The slug rule is enforced in three places — the browser, the server, and a database
constraint. The console validates first so a typo costs no round trip, but the
server is the authority.

## The password is shown once

The first administrator's password is generated and displayed **once**, on creation.
It is not recoverable. Hand it over through whatever channel you use for secrets,
and have them change it on first sign-in.

## Suspending

Suspending a tenant locks it out without deleting anything. Its data stays; its
people cannot sign in. It is the reversible answer to non-payment or an
investigation.

**The platform tenant cannot be suspended.** The server refuses — it would lock the
operators out of their own deployment — and the control says so rather than
offering a button that always fails.

## Rotating a tenant key

Rotate advances the tenant's key epoch. Use it when a tenant's credentials may have
been exposed.

## Statuses

`active`, `suspended`, and `deleting` — the last being a state the registry passes
through, not one you set.

## Capabilities

Everything here needs `tenant:manage`. On a single-tenant deployment the section is
of no interest and can be ignored.

See also: [API keys and tenancy](../concepts/api-keys-and-tenancy.md),
[Access control](../operations/access-control.md).
