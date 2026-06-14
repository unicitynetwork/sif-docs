---
title: Policies
description: How detector outputs become verdicts.
---

A **policy** is the named set of behaviour that turns detector outputs into a verdict. The primary use of a policy is to determine which detectors will be run, and in which order, when a new request is examined. A second objective is to score the detection signals into an unambiguous classifier verdict (e.g., block, modify, allow ...).

- The request API call sets the policy ID to be used on an individual request (otherwise a default policy is assigned).
- Every API key is bound to exactly one policy.
- Multiple keys can share a policy.

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

The dashboard [Policies page](../dashboard/policies-page.md) is the recommended edit surface. The same data is reachable via `PUT /manage/policies/{name}` for scripted changes.

## Related

- [The guard pipeline](the-guard-pipeline.md) — where the policy is consulted during a request.
- [Detectors](detectors.md) — what `[policies.detectors]` refers to.
- [How-to → Tune a policy threshold](../guides/tune-a-policy-threshold.md) — the iterative tuning loop.
