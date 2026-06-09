---
title: Tune a policy threshold
description: Adjust block and flag thresholds to fix false positives or false negatives.
---

The right thresholds depend on the traffic, the risk tolerance, and the cost of a false positive vs. a false negative. This guide is the closed-loop recipe for finding them.

## Before tuning — confirm the failure mode

Open the [Threats page](../dashboard/threats-page.md) and filter by the action you're concerned about.

| Symptom | What you're seeing | What to do |
|---|---|---|
| **Too many `block` rows on legitimate prompts** | False positives | Raise the block threshold for the offending category |
| **Block events for the right reasons but flagging fine ones** | Flag threshold too low | Raise the flag threshold |
| **Real attacks showing as `allow`** | False negatives | Lower the flag and/or block threshold; check that the detector is actually enabled |

Click into a representative row. The detail panel shows which detector fired, the rule that matched, and the score. That score is what you're tuning against.

## Make the change

1. Open the [Policies page](../dashboard/policies-page.md).
2. Click the policy attached to the API key that produced the false positive (visible in the Threats detail panel as `policy_applied`).
3. In the threshold map, find the entry for the offending category (e.g. `prompt_injection: { flag: 0.5, block: 0.8 }`).
4. Adjust the value by 0.05–0.10 in the direction that matches the symptom. Save.

Changes take effect immediately. There is no restart, no propagation delay, and no need to re-deploy any client code.

## Validate

Re-send the prompt that triggered the original verdict — through the same API key.

```bash
curl -X POST http://localhost:8080/api/v1/guard \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ps_your_key" \
  -d '{ "messages": [{"role":"user","content":"<the borderline prompt>"}] }'
```

The verdict should reflect the new threshold. If not, double-check:

- You edited the policy bound to the API key you tested with — [Settings page](../dashboard/settings-page.md) shows the binding.
- The detector that fired is named in the threshold key (`category` in the verdict) — if it isn't, you're tuning the wrong threshold.

## Tune iteratively, not aggressively

Move thresholds in increments of 0.05–0.10. Larger jumps tend to overshoot — what looked like five false positives becomes five new false negatives. A common workflow:

1. Save a small adjustment.
2. Watch the [Threats page](../dashboard/threats-page.md) for an hour of real traffic (or replay a known-good corpus through the gateway).
3. Adjust again only after you have evidence the previous change had the intended effect.

## Use a separate policy for experiments

For high-volume production keys, do *not* tune thresholds directly. Instead:

1. Clone the policy: copy the current settings into a new policy with a name like `default-experimental`.
2. Mint a low-traffic API key bound to the experimental policy via [Settings → Create key](../dashboard/settings-page.md).
3. Tune against that key.
4. Promote by editing the production policy to match, once the experimental one is stable.

This protects production traffic from the inevitable false-start changes.

## Threshold reference

The mapping between risk score and verdict, for a single category:

| Score range | Verdict if `flag_threshold = 0.5`, `block_threshold = 0.8` |
|---|---|
| `[0.0, 0.5)` | allow |
| `[0.5, 0.8)` | flag |
| `[0.8, 1.0]` | block |

When multiple categories fire, the policy's aggregation mode decides the final risk score — `max` is the default. See [Concepts → Policies](../concepts/policies.md).

## Related

- [Policies page](../dashboard/policies-page.md) — the editing surface.
- [Concepts → Policies](../concepts/policies.md) — aggregation modes, fail mode, short-circuit.
- [How-to → Handle blocked requests](handle-blocked-requests.md) — UX for the verdicts that survive your tuning.
