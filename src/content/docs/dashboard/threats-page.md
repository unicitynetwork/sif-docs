---
title: Threats page
description: Every non-allow verdict, with filters and a detail panel.
---

The Threats page (`/threats`) is the operator's queue — every request that was blocked, modified, or flagged. Use it to review what the gateway is catching, validate rule behaviour against real traffic, and find specific events for investigation.

## What you see

### Action filter

A row of buttons across the top:

| Filter | Includes |
|---|---|
| **All** | Every non-allow verdict |
| **Blocked** | `action: block` only |
| **Modified** | `action: modify` only — the gateway altered the prompt before forwarding |
| **Flagged** | `action: flag` only — the verdict was recorded but the request was allowed through |

`allow` verdicts are intentionally excluded. To browse all traffic, including allowed requests, use the audit endpoints directly (see [HTTP API → Management endpoints](../api/management-endpoints.md)).

### Event table

| Column | Meaning |
|---|---|
| **Time** | Server-side timestamp when the request was processed |
| **Action** | `block` / `modify` / `flag` badge, colour-coded |
| **Risk** | The combined risk score in `[0, 1]`; the column is shaded by severity — red ≥ 0.8, amber ≥ 0.5, otherwise muted |
| **Detections** | The detector families that fired, in order of contribution |

Rows are populated by three parallel queries against `GET /manage/audit/entries?action=…&page_size=50` — one per action — so the per-action filters always have populated data even when one action dominates the recent traffic.

### Detail panel

Click any row to open the detail panel on the right. It shows:

- The full request envelope: headers (with sensitive values redacted), full message list, request ID
- Every detector that ran, with its score, matched rule ID, and evidence snippet
- The policy that was applied and the threshold values it used
- The final verdict and why it was chosen (which detector or combiner caused the action)

## What it does not show

- **Allowed requests.** Use the audit-stats endpoint or [How-to → Monitor production traffic](../guides/monitor-production-traffic.md) for the full picture.
- **The model response.** The page shows what the *gateway* saw; if response-side detection is enabled, the response verdict appears as a separate event linked by `request_id`.

## Related pages

- [Overview page](overview-page.md) — the live feed shows the most recent of these events.
- [Concepts → Threats and verdicts](../concepts/threats-and-verdicts.md) — what gets persisted vs. what does not.
- [How-to → Tune a policy threshold](../guides/tune-a-policy-threshold.md) — when there are too many false positives or false negatives here.
