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

Request shape from [`crates/semd-core/src/types/request.rs::GuardRequest`](https://github.com/unicitynetwork/semanticd/blob/main/crates/semd-core/src/types/request.rs):

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user",   "content": "What's the weather today?"}
  ],
  "policy_id": "default",
  "config": {
    "return_detections": true,
    "threshold": null,
    "categories": []
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `messages` | array | yes | One or more messages. `role` is `"system"`, `"user"`, or `"assistant"`. `content` is a string. |
| `policy_id` | string | no | Top-level field — **not** `config.policy`. Overrides the key's bound policy. Most callers omit. |
| `config.return_detections` | bool | no | Include the `detections` array in the response. Default `false` in code; SDK defaults to `true`. |
| `config.threshold` | float \| null | no | Per-call risk-score override. `null` ⇒ use the policy threshold. |
| `config.categories` | array of string | no | If non-empty, only run detectors emitting these categories. Empty ⇒ run all enabled. |

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

Schema-present-but-omitted-when-empty/null on a clean low-risk call: `detections`, `policy_applied`, `degraded`, `timestamp`, `versions`, `modified_content`. So a real `allow` response can be as small as the envelope above.

## Response — Block

```json
{
  "request_id": "019ed01f-eeb3-7540-8959-c1142415dc57",
  "action": "block",
  "blocked": true,
  "risk_score": 1.0,
  "detections": [
    {
      "category": "injection",
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
On the current build, `detections` is not being populated even on high-confidence blocks (the vec is empty, so `serde` omits the field entirely). The block decision itself is correct — `action`, `blocked`, and `risk_score` are reliable. Schema above is the post-alpha contract.
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

When `action == "modify"`, the redactor returns the combined request as a single string in `modified_content` (preprocessed + redacted). Forward that to the LLM, not the original `messages`. See [How-to → Handle blocked requests](../guides/handle-blocked-requests.md).

## Response fields

Grounded in `crates/semd-core/src/types/response.rs::GuardResponse`.

| Field | Always present | Meaning |
|---|---|---|
| `request_id` | yes | Server-generated UUIDv7 |
| `action` | yes | One of `allow`, `flag`, `modify`, `block` |
| `blocked` | yes | `true` iff `action == "block"` |
| `risk_score` | yes | Combined score `[0.0, 1.0]` |
| `processing_time_ms` | yes | Server-side latency in ms |
| `detections` | omitted when empty | Array of `Detection` objects (`category`, `confidence`, `description`, `rule_id`) |
| `policy_applied` | omitted when null | Name of the policy used for thresholds |
| `degraded` | omitted when null | `true` if part of the pipeline failed (fail-open) |
| `timestamp` | omitted when null | UTC processing timestamp |
| `versions` | omitted when null | Model / ruleset versions used (`AnalysisVersions` shape) |
| `modified_content` | only when `action == modify` | Preprocessed + redacted form of the combined request, as a single string |

See [Verdict shapes reference](../reference/verdict-shapes.md) for the full field-by-field and the `Detection` sub-shape.

## Errors

Every error follows the envelope at [Reference → API error codes](../reference/api-error-codes.md):

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "messages array is empty",
    "request_id": "019ed01f-…"
  }
}
```

| HTTP status | `error.code` | Typical cause for this endpoint |
|---|---|---|
| `400` | `INVALID_REQUEST` | Missing / malformed `messages`, unknown role, invalid `policy_id`, oversize message count |
| `401` | `UNAUTHORIZED` | Missing or invalid API key |
| `403` | `FORBIDDEN` | Key is suspended / revoked |
| `413` | `PAYLOAD_TOO_LARGE` | Body exceeds `server.request_body_limit` |
| `429` | `RATE_LIMITED` | Key exceeded `rate_limit_rpm`; `error.retry_after_ms` set |
| `500` | `INTERNAL_ERROR` | Detector exception or generic gateway failure |
| `503` | `SERVICE_UNAVAILABLE` | Dependency unreachable, pipeline timeout, or shutdown in progress |

The seven-code catalogue is fixed; finer-grained cause is in `error.message`. See [Reference → API error codes](../reference/api-error-codes.md) for fail-open behaviour (`action` / `degraded` top-level fields).

## Related

- [Concepts → The guard pipeline](../concepts/the-guard-pipeline.md) — what happens between request and response.
- [Batch guard](batch-guard.md) — multiple prompts in one request.
- [How-to → Integrate with an LLM app](../guides/integrate-with-an-llm-app.md) — usage patterns.
