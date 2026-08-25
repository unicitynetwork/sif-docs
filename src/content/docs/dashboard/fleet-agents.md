---
title: Fleet › Agents
description: The classes of software calling the guard, and the policy each one owns.
sidebar:
  order: 3
---

Fleet › Agents (`/fleet/agents`) is the registry of **agent classes** — the
software calling the guard, grouped by what it is rather than which key it
holds.

A class is the unit of policy. Every key bound to a class resolves its
policy through that class, and changing the class's policy changes it for
every key bound to it, in one write.

## Why a class and not just a key

Keys are operational: they get rotated, split, replaced. A class outlives
them. If `payments-bot` rotates its key every 30 days, a question asked about
the key spans 30 days; the same question asked about the class spans the
whole history.

The class is recorded on every audit row at the moment of the call, so it
stays durable even after the key that carried it is gone.

## The two modes

Every key is in exactly one of two modes:

| | Class-led | Caller-led |
|---|---|---|
| How | The key is bound to an agent class | The key carries no class |
| Where the policy comes from | The class's policy — the only source | The request's `policy_id`, or the key's own tier, or the tenant default |
| Sending `policy_id` on the request | Refused — the class already decided | Required, once enforcement reaches `block` |

See [Guard endpoint → Agent classes and `policy_id`](../api/guard-endpoint.md#agent-classes-and-policy_id)
for the wire-level detail: the exact two refusals, and the rollout dial that
gates them so turning this on cannot break an existing caller.

## Why there is no per-key exception inside a class

A class cannot hold two policies. If one key bound to a class needs
different rules than the rest, it does not get a carve-out — it belongs in a
different class, or in none. That constraint is what makes "change the
policy, every key follows" true without a footnote.

## The class table

One row per registered class: the class, its policy, when a key carrying it
was last seen, and how many keys carry it. Every row action targets the
class, not however many keys it holds — changing the policy, editing, or
retiring is the same one write whether the class has one key or five.

- **Change policy…** — the action this page exists for.
- **Edit…** — display name, description, owner, and tags. The slug itself
  never changes, because `audit_log.agent_class` joins on it by string.
- **Retire…** — see below.
- **View keys** — jumps to [Fleet › Keys](fleet-keys.md) filtered to the class.
- **What it decided…** — jumps to [Activity › Audit](activity-audit.md)
  filtered to the class.

Changing a class's policy takes effect on every bound key's very next call.
The binding is read fresh from the database at authentication, not from a
cached snapshot, so there is no propagation delay and no restart.

## Creating a class

**New class…**, above the table, registers a class before any key or
request has used it — a service being set up ahead of time does not have
to wait for traffic to enrol it. It asks for a slug (path-like, for example
`eng/code-reviewer`), a display name, and a policy.

This is a separate action from registering a class that traffic has already
found — see "the enrolment queue" below. Both end up creating the same kind
of row; they exist independently because a class can become known to SIF
either way, and neither flow should have to wait on the other.

## Retire, not delete

There is no way to delete a class. Retiring marks it withdrawn — it drops
out of the pick-list an operator sees when binding a key on [Fleet ›
Keys](fleet-keys.md#binding-a-key-to-an-agent-class) — but it does not cut
off the keys already bound to it: they keep resolving through the retired
class's policy exactly as before. Retirement is a lifecycle state, not a
deletion, so `audit_log.agent_class` stays joinable against a class that is
no longer active. Unbinding a key from a retired class is a separate,
explicit action on [Fleet › Keys](fleet-keys.md).

## The unclassed list and the enrolment queue

Below the class table, two lists cover what the registry itself does not:

- **Caller-led keys** — keys with no class. Each must name a `policy_id` on
  every call once enforcement reaches `block`.
- **Seen in traffic, not registered** — class names the audit log has
  observed in the **last 30 days** (up to 500 classes) that have no row in
  the registry yet. A class not listed here may simply not have called
  recently — absence is not proof nothing unregistered exists. This is how a
  class enrols itself before anyone formally registers it: software starts
  asserting a class name (or a key gets bound to one) before an operator has
  created it, it shows up here with a call count, and **Register this
  class** opens the create form pre-filled with that name. That is why the
  registry deliberately keeps no foreign key from `audit_log.agent_class`
  back to the registry table — an unregistered class has to stay recordable
  for this list to work.

  Each entry also says whether it has been **verified** or only
  **claimed**. A call authenticates its agent class when the *key itself*
  is bound to that class; a caller-led key can instead claim a class as
  part of the call, which SIF records but never checks against anything.
  If every call for a name arrived that second way, the row carries a
  **claimed, not verified** badge — the name is real traffic, but nothing
  has confirmed that the software calling itself that name is what it
  says it is. Registering the class does not change this: an unverified
  name stays unverified after it has a registry row. Binding the key
  itself, where that's an option, is what turns a claim into something
  verified.

## Capabilities

Reading the registry needs `registry:read`; creating, changing, editing, or
retiring a class needs `registry:write`. Reading the caller-led key list needs
`apikey:read` — a capability most viewer accounts don't hold, so most
viewers see that section's error state, not its loading one, and it says
plainly what could not be read rather than claiming no key needs a policy.

## Related

- [Guard endpoint → Agent classes and `policy_id`](../api/guard-endpoint.md#agent-classes-and-policy_id) — the wire-level rule and the rollout dial.
- [Fleet › Keys](fleet-keys.md) — bind or clear a key's class from its **Edit…** action.
- [Concepts → Policies](../concepts/policies.md#how-a-requests-policy-is-chosen) — the full resolution order, with the class inserted.
- [Concepts → API keys and tenancy](../concepts/api-keys-and-tenancy.md#key--policy-binding) — what `api_keys.policy_id` still does once a key is classed (nothing).
