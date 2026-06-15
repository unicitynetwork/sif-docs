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
  "request_id": "req_a8f3c2e1",
  "action": "allow",
  "flagged": false,
  "risk_score": 0.02,
  "detections": [],
  "latency_ms": 8,
  "policy_applied": "default"
}
```

## Response — Block

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
      "message_index": 1
    }
  ],
  "latency_ms": 12,
  "policy_applied": "default"
}
```

## Response — Modify

```json
{
  "request_id": "req_c1f9a3d7",
  "action": "modify",
  "flagged": true,
  "risk_score": 0.65,
  "detections": [
    {"detector": "pii_scanner", "category": "pii", "confidence": 0.99, "evidence": "Credit card number detected"}
  ],
  "modified_messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user",   "content": "My card is [REDACTED] — when does it expire?"}
  ],
  "latency_ms": 11,
  "policy_applied": "default"
}
```

When `action == "modify"`, forward `modified_messages` to the LLM provider, not the original `messages`. See [How-to → Handle blocked requests](../guides/handle-blocked-requests.md).

## Response fields

| Field | Always present | Meaning |
|---|---|---|
| `request_id` | yes | Unique correlation ID |
| `action` | yes | One of `allow`, `flag`, `modify`, `block` |
| `flagged` | yes | `true` for any non-`allow` action |
| `risk_score` | yes | Combined score, `[0, 1]` |
| `detections` | when `return_detections != false` | Array of detection objects |
| `modified_messages` | only when `action == modify` | Rewritten message list |
| `latency_ms` | yes | Wall-clock latency of this call |
| `policy_applied` | yes | Name of the policy that produced the verdict |

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
