---
title: Policies page
description: Edit how detector outputs become verdicts.
---

The Policies page (`/policies`) lets you inspect and edit the named policies that turn detector outputs into verdicts. Every API key is bound to exactly one policy.

## What you see

### Policy table

| Column | Meaning |
|---|---|
| **Name** | The policy identifier (e.g. `default`, `strict`, `lenient`) |
| **Fail mode** | What the gateway does if a detector errors during evaluation: `allow`, `block`, or `flag` |
| **Global timeout (ms)** | Maximum wall-clock time the whole detection pipeline may take; detectors that exceed it are skipped and counted as a fail |
| **Short circuit** | Whether to stop evaluating remaining detectors once the running risk score exceeds the short-circuit threshold |
| **Default** | Whether this policy is the fallback for keys without an explicit binding |

Backed by `GET /manage/policies`. Edits are saved via `PUT /manage/policies/{id}`.

### Policy detail

Click a row for the full detail view:

- **Enabled detectors** — which detector families this policy runs. Each entry has its own weight, score floor, and category-specific thresholds.
- **Threshold map** — per-category block and flag thresholds (e.g. `prompt_injection: { flag: 0.5, block: 0.8 }`).
- **Aggregation mode** — how individual detector scores combine into the overall risk score (`max`, `weighted_sum`, etc.).
- **Short-circuit threshold** — the score above which evaluation stops early.
- **Bound API keys** — which keys reference this policy.

## Editing a policy

The dashboard supports editing the threshold map and the short-circuit threshold inline; rebuilding the enabled detector set requires a `PUT /manage/policies/{id}` with a full body.

Changes apply immediately. Every API key bound to the policy sees the new behaviour on its next request. There is no restart and no propagation delay.

## When to edit each field

| Symptom | Field to adjust |
|---|---|
| Too many false-positive blocks | Raise category block thresholds |
| Real threats slipping through | Lower category flag thresholds or enable an additional detector |
| Long-tail latency spikes | Lower the global timeout or enable short-circuit |
| Quiet detector failures masking risk | Change fail mode from `allow` to `flag` so errors surface in the dashboard |

## Related pages

- [Concepts → Policies](../concepts/policies.md) — the underlying model in detail.
- [How-to → Tune a policy threshold](../guides/tune-a-policy-threshold.md) — a step-by-step recipe for the most common edit.
- [Settings page](settings-page.md) — bind API keys to a policy.
