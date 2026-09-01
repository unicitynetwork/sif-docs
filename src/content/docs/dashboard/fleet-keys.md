---
title: Fleet › Keys
description: Create, rotate, suspend, revoke and delete the API keys that call the guard.
sidebar:
  order: 4
---

Fleet › Keys (`/fleet/keys`) is the credential surface. Every request to
`/api/v1/guard` must carry an API key, and every key resolves to a set of
policies — through the [agent class](fleet-agents.md) it is in, or from the
`policy_id` it names on each call — so a key is both an identity and a choice
of guardrails.

This screen was previously part of a single "Settings" page. Access control moved
to [Access › Users](access-users.md); health and version moved to
[Fleet › System](fleet-system.md).

## The table

| Column | Meaning |
|---|---|
| Name | What you called it |
| Prefix | The first characters of the key, enough to identify it in a log |
| Tier | The key's request rate limit (`rate_limit_rpm`), e.g. `500/min`, or `unlimited` |
| Status | `active`, `suspended`, `expired` or `revoked` |
| Expires | When it stops working, if it is time-limited |
| Last used | When the guard last saw it |

**Tier** shows `rate_limit_rpm`, not the policy tier — despite the header
name, this column has nothing to do with policy resolution, and it stays
fully in force for a classed key exactly as for a caller-led one. There is
no per-key policy to show at all: `api_keys.policy_id` was dropped by
migration `120260828231927`, and neither the table nor the **Edit** dialog
offers a Policy select any more. **Edit** picks the key's [agent
class](fleet-agents.md) instead, and the policies that class attaches govern
every call the key makes. See [Concepts → API keys and
tenancy](../concepts/api-keys-and-tenancy.md#key--policy-binding).

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

A key can carry an *agent class* — the unit of policy (see [Fleet ›
Agents](fleet-agents.md)). Bind or clear one from a key's **Edit…** action on
this screen; the field sits in the same dialog as name, tier, and expiry.

The **Agent class** field is a dropdown over the registry, not free text —
a typo'd slug used to resolve to no class at all, silently falling the key
back to caller-led while the screen showed the typo as though it had
worked. **No class (caller-led)** is its own explicit option, so clearing a
binding is still one choice away. Only classes with an *active* lifecycle
are offered; a retired class drops out of the list (see [Fleet › Agents →
Retire, not delete](fleet-agents.md#retire-not-delete)).

A key can already carry a slug the dropdown would not otherwise list — one
retired since, or typed by hand before this dropdown existed and never
registered at all. Rather than silently resetting the field to "no class",
that slug shows as its own selected option labelled **`<slug>` (not
registered)**, with a hint explaining that picking anything else replaces
it. Hiding the mismatch would erase the one signal that the key is
misconfigured.

A key with **no** class is **caller-led**: it must name a `policy_id` on
every call to [`POST /api/v1/guard`](../api/guard-endpoint.md) once the
tenant's enforcement setting reaches `block` — see [Guard endpoint → Agent
classes and `policy_id`](../api/guard-endpoint.md#agent-classes-and-policy_id).
A key bound to a class is **class-led**: the class's policies govern every
call the key makes, and the class — not this screen — is where you change
them.

## Handing a key to the tester

The row menu can send a key straight to [Guardrails › Tester](guardrails-tester.md).
The tester holds it in `sessionStorage` only, so a data-plane credential does not
outlive the browser tab or get inherited by the next person at a shared desk.

## Capabilities

Reading the list needs `apikey:read`; creating and the lifecycle verbs need
`apikey:manage`. Without the read capability the screen says the list could not be
read — it does not report an empty fleet.

See also: [Add and rotate API keys](../guides/add-and-rotate-api-keys.md).
