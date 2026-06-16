---
title: Guard endpoint (beta)
description: POST /api/v1/guard — the primary detection endpoint.
---

> **Status: beta.** The request shape is stable; the response may add fields before 1.0. Existing fields will not be removed or renamed.

The single endpoint that screens a prompt and returns a verdict.

## Request

```http
POST /api/v1/guard
Authorization: Bearer semd_...
Content-Type: application/json
```

### Body

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user",   "content": "What's the weather today?"}
  ],
  "config": {
    "policy": "default",
    "return_detections": true
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `messages` | array | yes | One or more messages. `role` is `"system"`, `"user"`, or `"assistant"`. `content` is a string |
| `config.policy` | string | no | Overrides the key's bound policy. Most callers omit this |
| `config.return_detections` | bool | no | If `false`, the response omits `detections`. Default `true` |

Messages are evaluated together as a single context. Request-side rules run on `user` messages; if the most recent message is `assistant`, response-side rules run too.

## Response — Allow

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "request_id": "019ed01f-eb73-7f21-8cbf-c82798df3c94",
  "action": "allow",
  "blocked": false,
  "risk_score": 0.02,
  "processing_time_ms": 8
}
```

Fields the schema defines but `serde` omits when empty / null on this call: `detections`, `policy_applied`, `degraded`, `timestamp`, `versions`, `modified_content`. A clean low-risk call therefore returns the minimal envelope above.

## Response — Block

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

:::caution[Alpha regression: detections currently empty in live responses]
On the current build, `detections` is **not** being populated even on high-confidence blocks (it serialises to omitted because the vec is empty). The block decision itself is correct — `action`, `blocked`, and `risk_score` are reliable. Tracked on the gateway side; the schema above is the post-alpha contract.
:::

## Response — Modify

```json
{
  "request_id": "019ed01f-c1f9-a3d7-…",
  "action": "modify",
  "blocked": false,
  "risk_score": 0.65,
  "detections": [
    {
      "category": "pii",
      "confidence": 0.99,
      "description": "Credit card number detected",
      "rule_id": "PII-CC-001"
    }
  ],
  "processing_time_ms": 11,
  "policy_applied": "default",
  "modified_content": "You are a helpful assistant.\nMy card is [REDACTED] — when does it expire?"
}
```

When `action == "modify"`, the redactor returns the combined request as a single string in `modified_content` (preprocessed + redacted). Forward that to the LLM provider rather than the original `messages`. See [How-to → Handle blocked requests](../guides/handle-blocked-requests.md).

## Response fields

Grounded in [`crates/semd-core/src/types/response.rs::GuardResponse`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-core/src/types/response.rs).

| Field | Always present | Meaning |
|---|---|---|
| `request_id` | yes | Server-generated UUIDv7 |
| `action` | yes | One of `allow`, `flag`, `modify`, `block` |
| `blocked` | yes | `true` iff `action == "block"`. Convenience for client logic |
| `risk_score` | yes | Combined score, `[0.0, 1.0]` |
| `processing_time_ms` | yes | Server-side latency in ms |
| `detections` | omitted when empty | Array of `Detection` objects |
| `policy_applied` | omitted when null | Name of the policy used for thresholds |
| `degraded` | omitted when null | `true` if part of the pipeline failed (fail-open) |
| `timestamp` | omitted when null | UTC processing timestamp |
| `versions` | omitted when null | Model / ruleset versions used |
| `modified_content` | only when `action == modify` | Preprocessed + redacted form of the combined request, as a single string |

See [Verdict shapes reference](../reference/verdict-shapes.md) for the full field-by-field, including the `Detection` sub-shape.

## Errors

See [Authentication](authentication.md) for `401`/`403`/`429`.

| Status | `error` value | Meaning |
|---|---|---|
| `400` | `invalid_messages` | Missing or malformed messages array |
| `400` | `too_many_messages` | Message count exceeds the policy's `max_messages` |
| `413` | `payload_too_large` | Total body size exceeds the configured limit |
| `503` | `pipeline_timeout` | Detection pipeline did not complete within `global_timeout_ms` |
| `503` | `degraded` | Required detector is degraded and the policy's `fail_mode` is `block` |

## Related

- [Concepts → The guard pipeline](../concepts/the-guard-pipeline.md) — what happens between request and response.
- [Batch guard](batch-guard.md) — multiple prompts in one request.
- [How-to → Integrate with an LLM app](../guides/integrate-with-an-llm-app.md) — usage patterns.
