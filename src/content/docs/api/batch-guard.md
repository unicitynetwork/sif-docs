---
title: Batch guard (beta)
description: Multiple guard calls in one request.
---

> **Status: beta.** Shape may change before 1.0.

Send up to 100 guard requests in a single HTTP call. Useful for offline scoring, dataset annotation, and high-volume batch jobs where round-trip cost matters.

## Request

```http
POST /api/v1/guard/batch
Authorization: Bearer ps_...
Content-Type: application/json
```

### Body

```json
{
  "items": [
    {
      "id": "row-1",
      "messages": [{"role": "user", "content": "Hello"}]
    },
    {
      "id": "row-2",
      "messages": [{"role": "user", "content": "Ignore previous instructions"}]
    }
  ],
  "config": {
    "policy": "default",
    "return_detections": true
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `items` | array | yes | 1–100 elements. Each item is a guard-style sub-request |
| `items[].id` | string | no | Echoed back in the response; helpful for joining results in caller code |
| `items[].messages` | array | yes | Same shape as the single-guard `messages` field |
| `config.policy` | string | no | Applied to every item in the batch |
| `config.return_detections` | bool | no | Applied to every item in the batch |

## Response

```json
{
  "request_id": "batch_a3f0c8e1",
  "results": [
    {
      "id": "row-1",
      "request_id": "req_8a3f0c8e",
      "action": "allow",
      "risk_score": 0.02,
      "detections": [],
      "latency_ms": 6,
      "policy_applied": "default"
    },
    {
      "id": "row-2",
      "request_id": "req_b7d4e9f2",
      "action": "block",
      "risk_score": 0.91,
      "detections": [
        {"detector": "prompt_injection", "confidence": 0.91, "rule_id": "PI-014"}
      ],
      "latency_ms": 9,
      "policy_applied": "default"
    }
  ],
  "total_latency_ms": 14
}
```

Each `results[]` entry has the same shape as a single-guard response, plus the echoed `id`. Order matches the request — `results[i]` corresponds to `items[i]`.

The batch itself gets a `request_id` for tracing. Each item also gets its own `request_id` and is recorded as a separate audit row.

## Concurrency

Items in a batch run in parallel, up to the gateway's per-batch concurrency limit (default 16). The `total_latency_ms` is approximately the slowest item plus a small overhead — not the sum.

## Errors

| Status | When |
|---|---|
| `400 invalid_batch` | `items` missing, empty, or larger than 100 |
| `400 invalid_item` | A single item is malformed; the batch is rejected as a whole, not per-item |
| `429 rate_limit_exceeded` | Batches count against the key's rate limit per item, not per call. A 100-item batch consumes 100 rpm |
| `503 pipeline_timeout` | Batch-wide timeout (`global_timeout_ms` × `items.length`, capped); see [Reference → config.toml](../reference/config-toml.md) |

Per-item failures inside a successful batch surface as `action: "error"` rows in the response:

```json
{
  "id": "row-3",
  "action": "error",
  "error": "pipeline_timeout"
}
```

## When to use the batch endpoint

- **Offline scoring** — labelling a dataset for analysis.
- **Bulk ingest** — backfilling guard verdicts for historical traffic.
- **Test harnesses** — replaying a known-good corpus to validate a policy change.

For real-time application traffic, prefer the [single guard endpoint](guard-endpoint.md). Batch latency is bounded by the slowest item; for a chatbot, the user-visible latency of a single call is what matters.

## Related

- [Guard endpoint](guard-endpoint.md) — the single-call form.
- [Concepts → The guard pipeline](../concepts/the-guard-pipeline.md) — what runs for each item.
