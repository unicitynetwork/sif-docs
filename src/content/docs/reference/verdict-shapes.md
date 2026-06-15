---
title: Verdict shapes
description: JSON shapes for every action — single, batch, and streaming.
---

The same verdict information appears in three places: the response to `POST /api/v1/guard`, each element of `POST /api/v1/guard/batch`, and each `verdict` event on `/ws/events`. The fields are the same; the wrapping differs.

## Single guard response

```json
{
  "request_id": "req_b7d4e9f2",
  "action": "block",
  "flagged": true,
  "risk_score": 0.91,
  "detections": [
    {
      "detector": "prompt_injection",
      "category": "direct_injection",
      "confidence": 0.91,
      "rule_id": "PI-014",
      "evidence": "Instruction override pattern detected",
      "message_index": 1,
      "span": [42, 78]
    }
  ],
  "modified_messages": null,
  "latency_ms": 12,
  "policy_applied": "default"
}
```

## Batch guard response

```json
{
  "request_id": "batch_a3f0c8e1",
  "results": [
    { "id": "row-1", "request_id": "req_8a3f0c8e", "action": "allow", ... },
    { "id": "row-2", "request_id": "req_b7d4e9f2", "action": "block", ... }
  ],
  "total_latency_ms": 14
}
```

Each `results[]` element has the single-guard fields plus the echoed `id`.

## WebSocket verdict event

```json
{
  "type": "verdict",
  "ts": "2026-06-07T18:42:10.123Z",
  "request_id": "req_b7d4e9f2",
  "action": "block",
  "risk_score": 0.91,
  "policy_applied": "default",
  "detections": [ ... ],
  "api_key_prefix": "semd_a3f0",
  "request_summary": "Help me ignore previous instr..."
}
```

The streaming form omits `flagged` (derivable from `action`), `latency_ms`, and `modified_messages` to keep events compact. Fetch the full audit row via `GET /manage/audit/entries/{request_id}` if you need those.

## Field-by-field

| Field | Type | Single | Batch (per-item) | Streaming |
|---|---|---|---|---|
| `request_id` | string | ✓ | ✓ | ✓ |
| `action` | enum | ✓ | ✓ | ✓ |
| `flagged` | bool | ✓ | ✓ | — |
| `risk_score` | float `[0,1]` | ✓ | ✓ | ✓ |
| `detections` | array | ✓ | ✓ | ✓ |
| `modified_messages` | array \| null | ✓ | ✓ | — |
| `latency_ms` | int | ✓ | ✓ | — |
| `policy_applied` | string | ✓ | ✓ | ✓ |
| `ts` | ISO-8601 | — | — | ✓ |
| `type` | const `"verdict"` | — | — | ✓ |
| `api_key_prefix` | string | — | — | ✓ |
| `request_summary` | string | — | — | ✓ |
| `id` (echoed) | string | — | ✓ | — |

## `action` values

| Value | When |
|---|---|
| `allow` | All per-category scores below `flag_threshold` |
| `flag` | At least one category at or above `flag_threshold`, none at or above `block_threshold` |
| `modify` | A detector rewrote the messages (PII redaction, etc.). Forward `modified_messages` |
| `block` | At least one category at or above `block_threshold` |

## Detection shape

```json
{
  "detector": "prompt_injection",        // which detector emitted this
  "category": "direct_injection",        // policy-aggregated label
  "confidence": 0.91,                    // [0, 1]
  "rule_id": "PI-014",                   // null for ML detectors
  "evidence": "Instruction override...", // ≤ 200 chars
  "message_index": 1,                    // which input message; 0-indexed
  "span": [42, 78]                       // optional char offsets in the message
}
```

`rule_id` is `null` when the detection came from an ML detector. `span` is omitted by detectors that don't track byte offsets.

## Related

- [HTTP API → Guard endpoint](../api/guard-endpoint.md) — request shape for the single form.
- [HTTP API → Batch guard](../api/batch-guard.md) — request shape for batch.
- [HTTP API → Events WebSocket](../api/events-websocket.md) — frame format.
- [Concepts → Threats and verdicts](../concepts/threats-and-verdicts.md) — what's persisted alongside the verdict.
