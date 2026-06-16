---
title: Verdict shapes
description: JSON shapes for every action — single, batch, and streaming.
---

This page is grounded in the Rust source: [`crates/semd-core/src/types/response.rs`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-core/src/types/response.rs) defines `GuardResponse` and `Detection`; [`Action`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-core/src/types/response.rs) defines the enum. Field names below match `serde` exactly.

## Single guard response

```json
{
  "request_id": "019ed01f-eeb3-7540-8959-c1142415dc57",
  "action": "block",
  "blocked": true,
  "risk_score": 1.0,
  "detections": [
    {
      "category": "direct_injection",
      "confidence": 0.91,
      "description": "Instruction override pattern detected",
      "rule_id": "PI-014"
    }
  ],
  "processing_time_ms": 12,
  "policy_applied": "default",
  "timestamp": "2026-06-16T11:10:14.574Z"
}
```

Several fields are present in the schema but **omitted from the wire when empty / null** via `skip_serializing_if`:

- `detections` — omitted when the array is empty
- `policy_applied`, `degraded`, `timestamp`, `versions`, `modified_content` — omitted when `None`

A minimal real `allow` response can therefore be as small as:

```json
{
  "request_id": "...",
  "action": "allow",
  "blocked": false,
  "risk_score": 0.0,
  "processing_time_ms": 4
}
```

:::caution[Alpha regression: detections array currently empty]
The struct documents `detections: [Detection]`; the live alpha build is **not** populating it even on high-confidence blocks. The block decision is correct (`action` and `risk_score` are right); the detector evidence array is empty. Tracked on the gateway side. Schema above is the post-alpha contract.
:::

## Batch guard response

:::caution[Alpha: shape pending]
There is no `BatchGuardResponse` struct in `crates/semd-core/src/types/` at the time of writing — the batch endpoint's response wrapper is not yet stabilised against a Rust type. The per-item shape will follow `GuardResponse`. Treat the wrapper below as illustrative only.
:::

```json
{
  "request_id": "batch_…",
  "results": [
    { "id": "row-1", /* GuardResponse fields */ },
    { "id": "row-2", /* GuardResponse fields */ }
  ]
}
```

Each `results[]` item is expected to be a `GuardResponse` plus the echoed request-side `id`.

## WebSocket verdict event

:::caution[Alpha: shape pending]
There is no `VerdictEvent` / `WsEvent` struct in the workspace at the time of writing. Frame shape is not yet locked. Treat the example below as a placeholder until the streaming envelope stabilises.
:::

```json
{
  "type": "verdict",
  "request_id": "019ed01f-…",
  "timestamp": "2026-06-16T11:10:14.574Z",
  "action": "block",
  "risk_score": 1.0,
  "policy_applied": "default"
}
```

The streaming envelope will at minimum carry `type`, `request_id`, `timestamp`, `action`, and `risk_score`. Whether it carries `detections`, `blocked`, `policy_applied`, or richer event fields is yet to be confirmed against code.

## Field-by-field (single response, from `GuardResponse`)

| Field | Type | Always sent? | Notes |
|---|---|---|---|
| `request_id` | string | ✓ | Server-generated UUIDv7. Correlate with the dashboard / audit log. |
| `action` | enum: `allow` / `flag` / `modify` / `block` | ✓ | Policy decision. |
| `blocked` | bool | ✓ | `true` iff `action == "block"`. Convenience for client logic. |
| `risk_score` | float `[0.0, 1.0]` | ✓ | Combined risk across all detectors. |
| `detections` | array of `Detection` | omitted when empty | See shape below. |
| `processing_time_ms` | int (u64) | ✓ | Server-side latency in ms. |
| `policy_applied` | string \| absent | omitted when `null` | Name of the policy used to make the threshold decision. |
| `degraded` | bool \| absent | omitted when `null` | `true` if part of the pipeline failed and the response is best-effort (fail-open). |
| `timestamp` | ISO-8601 string \| absent | omitted when `null` | Server-side processing timestamp (UTC). |
| `versions` | object \| absent | omitted when `null` | Model / ruleset versions used. Shape: `AnalysisVersions`. |
| `modified_content` | string \| absent | omitted when `null` | Set only when `action == "modify"`. Single string (the preprocessed + redacted form of the combined request). |

## `action` values

| Value | When |
|---|---|
| `allow` | All per-category scores below `flag_threshold` |
| `flag` | At least one category at or above `flag_threshold`, none at or above `block_threshold` |
| `modify` | A detector rewrote the request (e.g. PII redaction). Forward `modified_content` instead of the raw request. |
| `block` | At least one category at or above `block_threshold` |

## Detection shape (from `crates/semd-core/src/types/response.rs::Detection`)

```json
{
  "category": "direct_injection",
  "confidence": 0.91,
  "description": "Instruction override pattern detected",
  "rule_id": "PI-014"
}
```

| Field | Type | Always sent? | Notes |
|---|---|---|---|
| `category` | string | ✓ | Threat category (e.g. `direct_injection`, `pii`, `jailbreak`). |
| `confidence` | float `[0.0, 1.0]` | ✓ | Confidence in the detection. |
| `description` | string | ✓ | Human-readable summary of what was detected. |
| `rule_id` | string \| absent | omitted when `null` | Rule that fired, for rule-based detectors. ML detectors omit this. |

The on-the-wire `Detection` is intentionally minimal — no `evidence` blob, no `message_index`, no `span`. Anything beyond these four fields is part of the persisted audit row, not the live response.

## Related

- [HTTP API → Guard endpoint](../api/guard-endpoint.md) — request shape for the single form.
- [HTTP API → Batch guard](../api/batch-guard.md) — request shape for batch.
- [HTTP API → Events WebSocket](../api/events-websocket.md) — frame format.
- [Concepts → Threats and verdicts](../concepts/threats-and-verdicts.md) — what's persisted alongside the verdict.
