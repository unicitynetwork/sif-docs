---
title: Fleet › Keys
description: Create, rotate, suspend, revoke and delete the API keys that call the guard.
sidebar:
  order: 4
---

Fleet › Keys (`/fleet/keys`) is the credential surface. Every request to
`/api/v1/guard` must carry an API key, and every key is bound to exactly one
policy — so a key is both an identity and a choice of guardrails.

This screen was previously part of a single "Settings" page. Access control moved
to [Access › Users](access-users.md); health and version moved to
[Fleet › System](fleet-system.md).

## The table

| Column | Meaning |
|---|---|
| Name | What you called it |
| Prefix | The first characters of the key, enough to identify it in a log |
| Tier | The policy tier the key is bound to |
| Status | `active`, `suspended`, `expired` or `revoked` |
| Expires | When it stops working, if it is time-limited |
| Last used | When the guard last saw it |

The full key is shown **once**, when it is created or rotated. It is not
recoverable afterwards — the server stores a hash. Copy it then or rotate for a
new one.

## The lifecycle

Each row's `⋯` menu carries the verbs. They are not interchangeable:

| Verb | What it does | Reversible |
|---|---|---|
| **Suspend** | Stops the key working, keeps everything | Yes — Reactivate |
| **Reactivate** | Puts a suspended key back into service | — |
| **Rotate** | Issues a new secret for the same key record | The old secret stops working |
| **Revoke** | Stops the key permanently; the key record stays | No |
| **Delete** | Removes the key record | No |

**Revoke and Delete both keep existing audit history.** The difference is the key
*record*: Revoke keeps it, so a later investigation can still resolve the key that
made a call to a name. Delete removes it. If you might need to explain the calls
later, revoke.

Delete asks you to type the key's name before it will commit. It is the only
irreversible verb on this screen that cannot be undone by another verb.

## Acting on several keys

Tick the rows and the bulk bar appears. There is no bulk endpoint on the server,
so a bulk verb is a loop over the per-key calls — which means it is *not atomic*.

If the server refuses one, the run stops and names the key it stopped on. The keys
that already succeeded drop out of the selection, so retrying resumes rather than
re-issuing calls the server will refuse a second time.

The header checkbox selects the rows currently shown, honouring any active filter
— not every key in the tenant.

## Binding a key to an agent class

A key can carry an *agent class*, which is how the audit trail knows what kind of
software made a call. Bind one on [Fleet › Agents](fleet-agents.md).

## Handing a key to the tester

The row menu can send a key straight to [Guardrails › Tester](guardrails-tester.md).
The tester holds it in `sessionStorage` only, so a data-plane credential does not
outlive the browser tab or get inherited by the next person at a shared desk.

## Capabilities

Reading the list needs `apikey:read`; creating and the lifecycle verbs need
`apikey:manage`. Without the read capability the screen says the list could not be
read — it does not report an empty fleet.

See also: [Add and rotate API keys](../guides/add-and-rotate-api-keys.md).
