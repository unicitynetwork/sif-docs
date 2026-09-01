---
title: Policies
description: How detector outputs become verdicts.
---

A **policy** is what turns findings into a verdict. It does two things: it says
**what gets checked**, by attaching rulesets, and it says **what the numbers
mean**, by carrying three thresholds. Everything else on it — the order
detectors run in, how long they get, what happens when one fails — is detail in
service of those two.

## How a request's policy is chosen

Which policy governs a request depends on whether the key that called is
bound to an **agent class** (see [Fleet › Agents](../dashboard/fleet-agents.md)):

```
key IS in a class   (class-led)
  1. its classes' policies -> the only source; every policy each class
     attaches, de-duplicated, and possibly none
     request also sends policy_id -> refused (see below)

key is NOT in a class   (caller-led)
  1. request's policy_id   -> the only source; unknown id = 400
     request omits policy_id -> refused (see below)
```

"Refused" here is gated on the tenant's `class_policy_enforcement` rollout
dial, and only bites once that dial reaches `block` — see [Guard endpoint →
Agent classes and `policy_id`](../api/guard-endpoint.md#agent-classes-and-policy_id)
for the two exact 400s and what happens before `block`.

`api_keys.policy_id` — a key's own assigned tier — is **gone**: migration
`120260828231927` dropped the column, and a key carries no policy of its own.
A class attaches **any number** of policies — none, one, or several — and a
class-led key runs the policies of every class it is in, de-duplicated. A key
whose classes attach nothing resolves to zero policies and is checked by
nothing; a class attaching a policy that is not in the store refuses the
request rather than quietly running the rest of the set.

A class can only bind a policy that belongs to its own tenant — the foreign
key is `(tenant_id, policy_id)`, not a bare policy id, so a class can never
point at another tenant's policy even under row-level security.

- No API key is bound to a policy directly; a key's policies come from the classes it is in, or from the `policy_id` it names on each call.
- Multiple keys can share a policy, whether through a shared class or by naming it on the request.

## What a policy contains

A policy holds two things: **which rulesets it attaches**, and **the three
numbers it screens their findings against**.

```
POLICY
  ├── rulesets[]      ordered. flattened before anything runs.
  └── decision band   flag / modify / block. Three numbers.
```

Everything else on it is execution detail — how long to allow, what to do when
a detector fails, and in what order to run things.

| Key | Meaning |
|---|---|
| `rulesets` | Ordered. **These bound what runs**: a policy that attaches nothing checks nothing, and a policy whose rules never name a model never loads one |
| `decision_band` | `flag`, `modify`, `block` — three risk thresholds, in that order. Omitted means the daemon's configured defaults |
| `fail_mode` | What an unscreened request becomes. `open` serves the combiner's verdict; `closed` blocks, because "could not be fully checked" is not "clean" |
| `global_timeout_ms` | Wall clock for the whole pipeline. Exceeding it is a fail, governed by `fail_mode` |
| `stages` | The **order** eligible detectors run in, and where the cascade may exit early. Cheap checks first, models only when the cheap ones were uncertain |
| `series_mode` | `exhaustive` runs every stage; `early_return` stops at the first stage that decides |
| `detectors` | Per-detector weights and an on/off switch, for detectors the rulesets already made eligible |

:::note[Rulesets gate, stages order]
These answer different questions and it matters which does what. The attached
rulesets say **what this policy is entitled to check**. `stages` say **in what
order**, so an expensive model runs only after a cheap check left the answer
uncertain. A stage naming detectors the rulesets never asked for simply drops
out, shortening the cascade rather than widening it.
:::

There are no per-category thresholds and no aggregation mode. Both existed
once; a category is now something a rule declares for grouping and reporting,
not a place to hang a number. Differentiation lives on the rule, which owns its
own score, severity and sensitivity.

## How a verdict is decided

**Every policy that applies is evaluated on its own**, against its own rules,
its own band and its own fail mode. The verdicts then combine.

1. **Resolve the policies.** A class-led key runs every policy its classes
   attach, de-duplicated. A caller-led key runs the one it named.
2. **Run each policy's own plan.** Its attached rulesets are flattened into one
   effective rule list; that list decides which detectors are eligible; its
   `stages` decide the order. Each detector emits `(category, confidence)`
   signals — never a decision.
3. **Score, per policy.** The signals that policy produced combine into one
   risk score.
4. **Screen against that policy's band.** At or above `block` it is a block; at
   or above `modify`, a modify; at or above `flag`, a flag; otherwise allow.
   A fail-closed policy that could not fully screen the request blocks here
   regardless of score.
5. **Combine.** Among the policies in **enforce** mode, the strictest verdict
   is served. A **monitor** policy's verdict never changes the outcome — its
   findings are still recorded, which is the point of monitor mode.

`modify` also happens when a detector returns a rewritten message list
(typically PII redaction), whatever the score — the response carries the
modified messages.

:::note[Bands are not merged]
Each policy screens its own findings against its own band. Nothing averages or
minimises the three numbers across policies, because a merged band describes a
threshold no policy actually enforced — and a finding contributed only by a
monitor policy could then block, under a threshold nobody chose.
:::

## The default policy

Every gateway boots with at least one policy named `default`. Since migration 036 a caller-led request that names no policy is refused rather than falling back to it — the `default` policy is reached only where the tenant sits below `block` on the enforcement dial, or has `caller_led_policy_fallback` turned on. A class-led key never falls back to it at all. The default policy has conservative thresholds suitable for a generic deployment.

For specific applications, **don't edit the default**. Instead, create a named policy and bind your keys to it. This keeps the default predictable for new keys.

## Editing

Edits take effect on the next request. There is no propagation delay and no restart.

Common edits:

| Goal | Field |
|---|---|
| Reduce false-positive blocks | Raise `block` in the decision band |
| Catch more low-confidence threats | Lower `flag` in the decision band |
| Check more, or less | Attach or detach a ruleset — this is the control that decides what runs |
| Cap latency | Lower `global_timeout_ms`; put the cheap detectors in an earlier stage with an exit band |
| Treat unscreened requests conservatively | Change `fail_mode` from `open` to `closed` |
| See a finding without acting on it | Put the policy in **monitor** mode rather than loosening the band |

The dashboard [Guardrails › Policies](../dashboard/guardrails-policies.md) is the recommended edit surface. The same data is reachable via `PATCH /manage/policies/{id}` for scripted changes (`{id}` is the policy's UUID, not its `policy_id` name).

## Related

- [The guard pipeline](the-guard-pipeline.md) — where the policy is consulted during a request.
- [Detectors](detectors.md) — what `[policies.detectors]` refers to.
- [How-to → Tune a policy threshold](../guides/tune-a-policy-threshold.md) — the iterative tuning loop.
- [Fleet › Agents](../dashboard/fleet-agents.md) — agent classes, the unit of policy for classed keys.
- [Guard endpoint → Agent classes and `policy_id`](../api/guard-endpoint.md#agent-classes-and-policy_id) — the wire-level rule and the rollout dial.
