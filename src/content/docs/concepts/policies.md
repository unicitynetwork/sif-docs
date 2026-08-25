---
title: Policies
description: How detector outputs become verdicts.
---

A **policy** is the named set of behaviour that turns detector outputs into a verdict. The primary use of a policy is to determine which detectors will be run, and in which order, when a new request is examined. A second objective is to score the detection signals into an unambiguous classifier verdict (e.g., block, modify, allow ...).

## How a request's policy is chosen

Which policy governs a request depends on whether the key that called is
bound to an **agent class** (see [Fleet › Agents](../dashboard/fleet-agents.md)):

```
key IS in a class   (class-led)
  1. the class's policy   -> the only source
     request also sends policy_id -> refused (see below)

key is NOT in a class   (caller-led)
  1. request's policy_id  -> the only source; unknown id = 400
     request omits policy_id -> refused (see below)
```

"Refused" here is gated on the tenant's `class_policy_enforcement` rollout
dial, and only bites once that dial reaches `block` — see [Guard endpoint →
Agent classes and `policy_id`](../api/guard-endpoint.md#agent-classes-and-policy_id)
for the two exact 400s and what happens before `block`.

`api_keys.policy_id` — a key's own assigned tier — is **deprecated**, not
dropped: the column still exists and still holds values, but a classed key no
longer consults it. It remains the fallback for a caller-led key that omits
`policy_id` and still has a tier set (below `block`), and it is what an
unclassed key falls back to before the tenant default.

A class can only bind a policy that belongs to its own tenant — the foreign
key is `(tenant_id, policy_id)`, not a bare policy id, so a class can never
point at another tenant's policy even under row-level security.

- Every API key is bound to at most one policy directly (`api_keys.policy_id`); a classed key's effective policy comes from its class instead.
- Multiple keys can share a policy, whether directly or through a shared class.

## What a policy contains

Note that the detector names mentioned below may change as new detectors are added/removed. Look at the detectors pane on the dashboard to see what detectors are available.

```toml
[[policies]]
name = "default"
fail_mode = "allow"
global_timeout_ms = 200
short_circuit = true
short_circuit_threshold = 0.95
aggregation_mode = "max"

[policies.thresholds]
prompt_injection  = { flag = 0.5, block = 0.8  }
jailbreak         = { flag = 0.5, block = 0.85 }
pii               = { flag = 0.7, block = 0.95 }
data_exfiltration = { flag = 0.6, block = 0.85 }

[policies.detectors]
regex               = { enabled = true,  weight = 1.0 }
yara                = { enabled = true,  weight = 1.0 }
pii_scanner         = { enabled = true,  weight = 1.0 }
prompt_injection_ml = { enabled = false, weight = 1.2 }
```

Top-level keys:

| Key | Meaning |
|---|---|
| `fail_mode` | Verdict when a detector errors. `allow` (silent), `flag` (record but pass), or `block` (most defensive) |
| `global_timeout_ms` | Maximum wall-clock for the whole detection pipeline. Detectors that exceed are killed and treated as a fail |
| `short_circuit` | If `true`, evaluation stops once any detector exceeds `short_circuit_threshold` |
| `short_circuit_threshold` | The early-exit cut. Only consulted when `short_circuit = true` |
| `aggregation_mode` | How per-detector scores combine: `max`, `weighted_sum` |

Nested:

| Key | Meaning |
|---|---|
| `thresholds` | Per-category `flag` and `block` thresholds |
| `detectors` | Which detectors run, with optional weights for `weighted_sum` aggregation |

## How a verdict is decided

1. Run the enabled detectors against the request. Each emits detections with `(category, confidence)` pairs.
2. Group detections by category. For each category, take the highest confidence — that's the per-category score.
3. Per the `aggregation_mode`, combine per-category scores into the overall `risk_score`:
   - `max` — the highest category score wins.
   - `weighted_sum` — `sum(score × weight) / sum(weight)`.
4. Compare each per-category score against its own thresholds:
   - If any category's score `≥ block_threshold`, the verdict is `block`.
   - Else if any category's score `≥ flag_threshold`, the verdict is `flag`.
   - Else `allow`.

`modify` happens when a detector (typically PII redaction) returns a rewritten message list — the verdict is `modify` regardless of the threshold check, and the response carries the modified messages.

## The default policy

Every gateway boots with at least one policy named `default`. API keys that don't specify a policy fall back to it. The default policy has conservative thresholds suitable for a generic deployment.

For specific applications, **don't edit the default**. Instead, create a named policy and bind your keys to it. This keeps the default predictable for new keys.

## Editing

Edits take effect on the next request. There is no propagation delay and no restart.

Common edits:

| Goal | Field |
|---|---|
| Reduce false-positive blocks | Raise category block thresholds |
| Catch more low-confidence threats | Lower category flag thresholds |
| Cap latency | Lower `global_timeout_ms`; enable short-circuit |
| Treat detector errors more conservatively | Change `fail_mode` from `allow` to `flag` or `block` |
| Add a new detector to the policy | Add an entry under `[policies.detectors]` |

The dashboard [Guardrails › Policies](../dashboard/guardrails-policies.md) is the recommended edit surface. The same data is reachable via `PATCH /manage/policies/{id}` for scripted changes (`{id}` is the policy's UUID, not its `policy_id` name).

## Related

- [The guard pipeline](the-guard-pipeline.md) — where the policy is consulted during a request.
- [Detectors](detectors.md) — what `[policies.detectors]` refers to.
- [How-to → Tune a policy threshold](../guides/tune-a-policy-threshold.md) — the iterative tuning loop.
- [Fleet › Agents](../dashboard/fleet-agents.md) — agent classes, the unit of policy for classed keys.
- [Guard endpoint → Agent classes and `policy_id`](../api/guard-endpoint.md#agent-classes-and-policy_id) — the wire-level rule and the rollout dial.
